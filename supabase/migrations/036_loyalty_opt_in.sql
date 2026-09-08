-- Loyalty program opt-in + 6-month TTL on private CRM photos.

alter table public.restaurants
  add column if not exists loyalty_enabled boolean not null default false;

update public.restaurants r
   set loyalty_enabled = true
 where exists (
   select 1 from public.customers c
    where c.restaurant_id = r.id
      and (c.visit_count > 0 or c.visits_toward_reward > 0)
 );

alter table public.customer_photos
  add column if not exists expires_at timestamptz;

update public.customer_photos
   set expires_at = created_at + interval '6 months'
 where expires_at is null;

alter table public.customer_photos
  alter column expires_at set default (now() + interval '6 months');

alter table public.customer_photos
  alter column expires_at set not null;

create index if not exists customer_photos_expires_at_idx
  on public.customer_photos (expires_at);
