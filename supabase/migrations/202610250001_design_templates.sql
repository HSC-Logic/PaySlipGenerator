alter table public.payment_slips add column design_template text not null default 'classic' check (design_template in ('classic', 'minimal', 'modern'));
