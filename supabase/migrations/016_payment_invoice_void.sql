-- Invoice lifecycle + soft-void for tenant_payments

alter table public.tenant_payments
  add column if not exists invoice_status text not null default 'global',
  add column if not exists invoice_folio text not null default '',
  add column if not exists invoice_at timestamptz,
  add column if not exists voided_at timestamptz,
  add column if not exists void_reason text not null default '';

alter table public.tenant_payments
  drop constraint if exists tenant_payments_invoice_status_check;

alter table public.tenant_payments
  add constraint tenant_payments_invoice_status_check
  check (invoice_status in ('global', 'pending', 'issued', 'cancelled'));

-- Backfill from legacy needs_invoice flag
update public.tenant_payments
set invoice_status = 'pending'
where needs_invoice = true
  and invoice_status = 'global'
  and voided_at is null;

comment on column public.tenant_payments.invoice_status is
  'global | pending | issued | cancelled — accountant CFDI queue';
comment on column public.tenant_payments.invoice_folio is
  'Optional CFDI folio / UUID after accountant issues invoice';
comment on column public.tenant_payments.voided_at is
  'Soft-void: excluded from finance totals; does not auto-revert subscription_end_date';
