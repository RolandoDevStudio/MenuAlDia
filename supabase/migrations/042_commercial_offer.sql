-- Commercial offer per tenant (founding / custom promos).
-- Run AFTER 041_increment_menu_view_hit.sql

alter table public.restaurants
  add column if not exists commercial_offer_kind text not null default 'none',
  add column if not exists commercial_offer_label text not null default '',
  add column if not exists commercial_free_months integer not null default 0,
  add column if not exists commercial_monthly_price numeric(12, 2),
  add column if not exists commercial_duration text not null default 'lifetime',
  add column if not exists commercial_duration_months integer,
  add column if not exists commercial_starts_at timestamptz,
  add column if not exists commercial_ends_at date;

alter table public.restaurants
  drop constraint if exists restaurants_commercial_offer_kind_check;

alter table public.restaurants
  add constraint restaurants_commercial_offer_kind_check
  check (commercial_offer_kind in ('none', 'founding', 'custom'));

alter table public.restaurants
  drop constraint if exists restaurants_commercial_duration_check;

alter table public.restaurants
  add constraint restaurants_commercial_duration_check
  check (commercial_duration in ('lifetime', 'months'));

alter table public.restaurants
  drop constraint if exists restaurants_commercial_free_months_check;

alter table public.restaurants
  add constraint restaurants_commercial_free_months_check
  check (commercial_free_months >= 0 and commercial_free_months <= 12);

comment on column public.restaurants.commercial_offer_kind is
  'none | founding | custom — recurring promo terms (not platform coupons).';
comment on column public.restaurants.commercial_monthly_price is
  'Frozen monthly MXN for current deal; null when kind=none.';
comment on column public.restaurants.commercial_ends_at is
  'When duration=months; null if lifetime.';
