-- Sliply Pro Phase 1. All client-accessible tables use RLS; auth.uid() is the trust boundary.
create extension if not exists pgcrypto;
create type public.sliply_plan as enum ('free', 'pro');
create type public.payment_status as enum ('draft', 'pending', 'paid', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '', plan public.sliply_plan not null default 'free',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.companies (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0), address text not null default '', telephone text, email text,
  registration_number text, logo_path text, authorized_name text, authorized_designation text, theme_color text not null default '#0b1f3a',
  reference_prefix text not null default 'PS' check (reference_prefix ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'), default_currency text not null default 'LKR',
  default_paper_size text not null default 'a4' check (default_paper_size in ('a4','a5','b5','letter')),
  default_orientation text not null default 'portrait' check (default_orientation in ('portrait','landscape')),
  show_sliply_branding boolean not null default true, is_default boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz
);
create unique index one_default_company_per_user on public.companies(user_id) where is_default and archived_at is null;
create index companies_user_active on public.companies(user_id, archived_at);

create table public.recipients (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0), identification text, role text, address text, email text, telephone text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz
);
create index recipients_user_active_name on public.recipients(user_id, archived_at, name);

create table public.payment_slips (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id), recipient_id uuid references public.recipients(id),
  reference text not null, payment_date date not null, title text not null, payment_method text not null,
  bank_name text, transaction_reference text, notes text, manual_adjustment numeric(18,2) not null default 0,
  currency text not null, seal_text text, paper_size text not null check (paper_size in ('a4','a5','b5','letter')),
  orientation text not null check (orientation in ('portrait','landscape')), status public.payment_status not null default 'draft',
  paid_at timestamptz, paid_reference text, company_snapshot jsonb not null, recipient_snapshot jsonb not null,
  subtotal numeric(18,2) not null, final_total numeric(18,2) not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
  unique(user_id, reference)
);
create index payment_slips_user_filters on public.payment_slips(user_id, archived_at, payment_date desc, status);
create index payment_slips_company on public.payment_slips(user_id, company_id);
create index payment_slips_recipient on public.payment_slips(user_id, recipient_id);

create table public.payment_items (
  id uuid primary key default gen_random_uuid(), payment_slip_id uuid not null references public.payment_slips(id) on delete cascade,
  description text not null, quantity numeric(18,4) not null check (quantity > 0), rate numeric(18,2) not null check (rate >= 0),
  display_order integer not null check (display_order >= 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(payment_slip_id, display_order)
);
create table public.payment_adjustments (
  id uuid primary key default gen_random_uuid(), payment_slip_id uuid not null references public.payment_slips(id) on delete cascade,
  label text not null, kind text not null check (kind in ('discount','tax','service','delivery','charge')),
  mode text not null check (mode in ('percentage','fixed')), value numeric(18,4) not null check (value >= 0),
  display_order integer not null check (display_order >= 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(payment_slip_id, display_order)
);
create table public.reference_sequences (
  user_id uuid not null references auth.users(id) on delete cascade, company_id uuid not null references public.companies(id) on delete cascade,
  sequence_year integer not null check (sequence_year between 2000 and 9999), last_value bigint not null default 0 check (last_value >= 0),
  updated_at timestamptz not null default now(), primary key(company_id, sequence_year)
);

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger companies_touch before update on public.companies for each row execute function public.touch_updated_at();
create trigger recipients_touch before update on public.recipients for each row execute function public.touch_updated_at();
create trigger slips_touch before update on public.payment_slips for each row execute function public.touch_updated_at();

create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into profiles(id, display_name) values(new.id, coalesce(new.raw_user_meta_data->>'display_name','')); return new; end $$;
create trigger auth_user_profile after insert on auth.users for each row execute function public.create_profile();

-- Atomic row lock/upsert prevents concurrent clients from issuing the same company/year sequence.
create or replace function public.reserve_payment_reference(p_company_id uuid) returns text
language plpgsql security invoker set search_path = public as $$
declare v_prefix text; v_year integer := extract(year from current_date); v_value bigint;
begin
  select reference_prefix into v_prefix from companies where id=p_company_id and user_id=auth.uid() and archived_at is null;
  if v_prefix is null then raise exception 'Company not found'; end if;
  insert into reference_sequences(user_id,company_id,sequence_year,last_value) values(auth.uid(),p_company_id,v_year,1)
  on conflict(company_id,sequence_year) do update set last_value=reference_sequences.last_value+1, updated_at=now()
  returning last_value into v_value;
  return v_prefix||'-'||v_year||'-'||lpad(v_value::text,4,'0');
end $$;

create or replace function public.payment_dashboard_summary() returns jsonb
language sql security invoker set search_path = public stable as $$
  select jsonb_build_object(
    'currentMonth', count(*) filter(where payment_date >= date_trunc('month', current_date)::date),
    'draft', count(*) filter(where status='draft'),
    'pending', count(*) filter(where status='pending'),
    'paid', count(*) filter(where status='paid')
  ) from payment_slips where user_id=auth.uid() and archived_at is null
$$;

-- Atomic save keeps the parent, items, and adjustments in one transaction.
create or replace function public.save_payment_slip(p_slip_id uuid, p_payment jsonb, p_items jsonb, p_adjustments jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid := coalesce(p_slip_id, gen_random_uuid()); v_company uuid := (p_payment->>'company_id')::uuid;
begin
  if not exists(select 1 from companies where id=v_company and user_id=auth.uid()) then raise exception 'Invalid company'; end if;
  if nullif(p_payment->>'recipient_id','') is not null and not exists(select 1 from recipients where id=(p_payment->>'recipient_id')::uuid and user_id=auth.uid()) then raise exception 'Invalid recipient'; end if;
  if p_slip_id is not null and not exists(select 1 from payment_slips where id=p_slip_id and user_id=auth.uid()) then raise exception 'Payment not found'; end if;
  insert into payment_slips(id,user_id,company_id,recipient_id,reference,payment_date,title,payment_method,bank_name,transaction_reference,notes,manual_adjustment,currency,seal_text,paper_size,orientation,status,paid_at,paid_reference,company_snapshot,recipient_snapshot,subtotal,final_total)
  values(v_id,auth.uid(),v_company,nullif(p_payment->>'recipient_id','')::uuid,p_payment->>'reference',(p_payment->>'payment_date')::date,p_payment->>'title',p_payment->>'payment_method',p_payment->>'bank_name',p_payment->>'transaction_reference',p_payment->>'notes',coalesce((p_payment->>'manual_adjustment')::numeric,0),p_payment->>'currency',p_payment->>'seal_text',p_payment->>'paper_size',p_payment->>'orientation',(p_payment->>'status')::payment_status,case when p_payment->>'status'='paid' then coalesce(nullif(p_payment->>'paid_at','')::timestamptz,now()) else nullif(p_payment->>'paid_at','')::timestamptz end,p_payment->>'paid_reference',p_payment->'company_snapshot',p_payment->'recipient_snapshot',(p_payment->>'subtotal')::numeric,(p_payment->>'final_total')::numeric)
  on conflict(id) do update set company_id=excluded.company_id,recipient_id=excluded.recipient_id,reference=excluded.reference,payment_date=excluded.payment_date,title=excluded.title,payment_method=excluded.payment_method,bank_name=excluded.bank_name,transaction_reference=excluded.transaction_reference,notes=excluded.notes,manual_adjustment=excluded.manual_adjustment,currency=excluded.currency,seal_text=excluded.seal_text,paper_size=excluded.paper_size,orientation=excluded.orientation,status=excluded.status,paid_at=excluded.paid_at,paid_reference=excluded.paid_reference,company_snapshot=excluded.company_snapshot,recipient_snapshot=excluded.recipient_snapshot,subtotal=excluded.subtotal,final_total=excluded.final_total;
  delete from payment_items where payment_slip_id=v_id;
  insert into payment_items(payment_slip_id,description,quantity,rate,display_order) select v_id,x->>'description',(x->>'quantity')::numeric,(x->>'rate')::numeric,ord-1 from jsonb_array_elements(p_items) with ordinality as a(x,ord);
  delete from payment_adjustments where payment_slip_id=v_id;
  insert into payment_adjustments(payment_slip_id,label,kind,mode,value,display_order) select v_id,x->>'label',x->>'kind',x->>'mode',(x->>'value')::numeric,ord-1 from jsonb_array_elements(p_adjustments) with ordinality as a(x,ord);
  return v_id;
end $$;

alter table public.profiles enable row level security; alter table public.companies enable row level security; alter table public.recipients enable row level security;
alter table public.payment_slips enable row level security; alter table public.payment_items enable row level security; alter table public.payment_adjustments enable row level security; alter table public.reference_sequences enable row level security;
create policy profiles_read_self on public.profiles for select using(id=auth.uid());
-- Plan is intentionally absent from client update policy; users may only change display_name.
create policy profiles_update_name on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
revoke update on public.profiles from authenticated;
grant update(display_name) on public.profiles to authenticated;
create policy companies_owner_all on public.companies for all using(user_id=auth.uid()) with check(user_id=auth.uid() and (show_sliply_branding or exists(select 1 from profiles p where p.id=auth.uid() and p.plan='pro')));
create policy recipients_owner_all on public.recipients for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy slips_owner_all on public.payment_slips for all using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from companies c where c.id=company_id and c.user_id=auth.uid()) and (recipient_id is null or exists(select 1 from recipients r where r.id=recipient_id and r.user_id=auth.uid())));
create policy items_owner_all on public.payment_items for all using(exists(select 1 from payment_slips p where p.id=payment_slip_id and p.user_id=auth.uid())) with check(exists(select 1 from payment_slips p where p.id=payment_slip_id and p.user_id=auth.uid()));
create policy adjustments_owner_all on public.payment_adjustments for all using(exists(select 1 from payment_slips p where p.id=payment_slip_id and p.user_id=auth.uid())) with check(exists(select 1 from payment_slips p where p.id=payment_slip_id and p.user_id=auth.uid()));
create policy sequences_owner_all on public.reference_sequences for all using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from companies c where c.id=company_id and c.user_id=auth.uid()));
grant execute on function public.reserve_payment_reference(uuid) to authenticated;
grant execute on function public.payment_dashboard_summary() to authenticated;
grant execute on function public.save_payment_slip(uuid,jsonb,jsonb,jsonb) to authenticated;
