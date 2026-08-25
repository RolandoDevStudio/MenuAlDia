-- Socios fundadores + notas internas (superadmin).
-- Run AFTER 028_show_powered_by.sql

alter table public.restaurants
  add column if not exists is_founding_partner boolean not null default false,
  add column if not exists internal_notes text not null default '';

comment on column public.restaurants.is_founding_partner is
  'Founding partner (early adopter). Shown as badge in tenant admin; filterable in superadmin Tenants.';

comment on column public.restaurants.internal_notes is
  'Internal notes for superadmin only. Never expose to tenant admin or public menu.';
