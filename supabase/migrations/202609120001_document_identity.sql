alter table public.payment_slips
  add column document_type text not null default 'payment-slip'
    check (document_type in ('payment-slip','invoice','quotation','other')),
  add column custom_document_type text,
  add column custom_payment_method text;

-- Existing rows retain payment-slip through the column default. Replace the
-- atomic save function so new identity fields remain in the same transaction.
create or replace function public.save_payment_slip(p_slip_id uuid, p_payment jsonb, p_items jsonb, p_adjustments jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid := coalesce(p_slip_id, gen_random_uuid()); v_company uuid := (p_payment->>'company_id')::uuid;
begin
  if not exists(select 1 from companies where id=v_company and user_id=auth.uid()) then raise exception 'Invalid company'; end if;
  if nullif(p_payment->>'recipient_id','') is not null and not exists(select 1 from recipients where id=(p_payment->>'recipient_id')::uuid and user_id=auth.uid()) then raise exception 'Invalid recipient'; end if;
  if p_slip_id is not null and not exists(select 1 from payment_slips where id=p_slip_id and user_id=auth.uid()) then raise exception 'Payment not found'; end if;
  insert into payment_slips(id,user_id,company_id,recipient_id,reference,payment_date,document_type,custom_document_type,title,payment_method,custom_payment_method,bank_name,transaction_reference,notes,manual_adjustment,currency,seal_text,paper_size,orientation,status,paid_at,paid_reference,company_snapshot,recipient_snapshot,subtotal,final_total)
  values(v_id,auth.uid(),v_company,nullif(p_payment->>'recipient_id','')::uuid,p_payment->>'reference',(p_payment->>'payment_date')::date,coalesce(p_payment->>'document_type','payment-slip'),p_payment->>'custom_document_type',p_payment->>'title',p_payment->>'payment_method',p_payment->>'custom_payment_method',p_payment->>'bank_name',p_payment->>'transaction_reference',p_payment->>'notes',coalesce((p_payment->>'manual_adjustment')::numeric,0),p_payment->>'currency',p_payment->>'seal_text',p_payment->>'paper_size',p_payment->>'orientation',(p_payment->>'status')::payment_status,case when p_payment->>'status'='paid' then coalesce(nullif(p_payment->>'paid_at','')::timestamptz,now()) else nullif(p_payment->>'paid_at','')::timestamptz end,p_payment->>'paid_reference',p_payment->'company_snapshot',p_payment->'recipient_snapshot',(p_payment->>'subtotal')::numeric,(p_payment->>'final_total')::numeric)
  on conflict(id) do update set company_id=excluded.company_id,recipient_id=excluded.recipient_id,reference=excluded.reference,payment_date=excluded.payment_date,document_type=excluded.document_type,custom_document_type=excluded.custom_document_type,title=excluded.title,payment_method=excluded.payment_method,custom_payment_method=excluded.custom_payment_method,bank_name=excluded.bank_name,transaction_reference=excluded.transaction_reference,notes=excluded.notes,manual_adjustment=excluded.manual_adjustment,currency=excluded.currency,seal_text=excluded.seal_text,paper_size=excluded.paper_size,orientation=excluded.orientation,status=excluded.status,paid_at=excluded.paid_at,paid_reference=excluded.paid_reference,company_snapshot=excluded.company_snapshot,recipient_snapshot=excluded.recipient_snapshot,subtotal=excluded.subtotal,final_total=excluded.final_total;
  delete from payment_items where payment_slip_id=v_id;
  insert into payment_items(payment_slip_id,description,quantity,rate,display_order) select v_id,x->>'description',(x->>'quantity')::numeric,(x->>'rate')::numeric,ord-1 from jsonb_array_elements(p_items) with ordinality as a(x,ord);
  delete from payment_adjustments where payment_slip_id=v_id;
  insert into payment_adjustments(payment_slip_id,label,kind,mode,value,display_order) select v_id,x->>'label',x->>'kind',x->>'mode',(x->>'value')::numeric,ord-1 from jsonb_array_elements(p_adjustments) with ordinality as a(x,ord);
  return v_id;
end $$;
