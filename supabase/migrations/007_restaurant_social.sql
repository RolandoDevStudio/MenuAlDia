-- Social links + delivery preference for restaurants

alter table public.restaurants
  add column if not exists instagram_url text,
  add column if not exists facebook_url text,
  add column if not exists tiktok_url text,
  add column if not exists offers_delivery boolean not null default true;
