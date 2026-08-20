-- Per-item fulfillment: purchase and/or book (Servicios mixed catalogs)

alter table public.dishes
  add column if not exists allow_purchase boolean not null default true,
  add column if not exists allow_booking boolean not null default false;

alter table public.combos
  add column if not exists allow_purchase boolean not null default true,
  add column if not exists allow_booking boolean not null default false;

comment on column public.dishes.allow_purchase is
  'Customer can add to cart / order (products or bookable+buy packages)';
comment on column public.dishes.allow_booking is
  'Customer can request appointment via WhatsApp (Cita Express)';
comment on column public.combos.allow_purchase is
  'Package can be purchased via cart';
comment on column public.combos.allow_booking is
  'Package can be booked via Cita Express';

-- Servicios tenants: enable booking on existing catalog (purchase stays on)
update public.dishes d
set allow_booking = true
from public.restaurants r
where d.restaurant_id = r.id
  and r.business_type = 'servicios'
  and d.archived_at is null;

update public.combos c
set allow_booking = true
from public.restaurants r
where c.restaurant_id = r.id
  and r.business_type = 'servicios'
  and c.archived_at is null;
