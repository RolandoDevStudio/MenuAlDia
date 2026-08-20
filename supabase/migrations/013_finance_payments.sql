-- Finance B1: payment receipts + invoice flag for accountant export

alter table public.tenant_payments
  add column if not exists receipt_url text,
  add column if not exists needs_invoice boolean not null default false;

comment on column public.tenant_payments.reference is
  'SPEI tracking key / bank reference when method = transfer';
comment on column public.tenant_payments.receipt_url is
  'Optional bank receipt image URL (Storage)';
comment on column public.tenant_payments.needs_invoice is
  'Subscriber requested CFDI for this payment (queue for accountant)';
