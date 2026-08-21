-- Day-open switch independent of subscription is_active

alter table public.restaurants
  add column if not exists accepting_orders boolean not null default true;
