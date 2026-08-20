-- CRM loyalty + private preference photos (Pro)

alter table public.customers
  add column if not exists notes text not null default '',
  add column if not exists allergies_alert text not null default '',
  add column if not exists favorite_service text not null default '',
  add column if not exists birthday date,
  add column if not exists tags text[] not null default '{}',
  add column if not exists visit_count int not null default 0,
  add column if not exists visits_toward_reward int not null default 0,
  add column if not exists last_visit_at timestamptz,
  add column if not exists rewards_redeemed int not null default 0;

alter table public.restaurants
  add column if not exists loyalty_goal int not null default 10,
  add column if not exists loyalty_reward_label text not null default 'Recompensa gratis';

create table if not exists public.customer_visits (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  created_at timestamptz not null default now(),
  note text not null default ''
);

create index if not exists customer_visits_customer_id_idx
  on public.customer_visits (customer_id, created_at desc);

create index if not exists customer_visits_restaurant_id_idx
  on public.customer_visits (restaurant_id, created_at desc);

alter table public.customer_visits enable row level security;

drop policy if exists "customer_visits_member_all" on public.customer_visits;
create policy "customer_visits_member_all"
  on public.customer_visits for all
  to authenticated
  using (public.is_restaurant_member(restaurant_id) or public.is_super_admin())
  with check (public.is_restaurant_member(restaurant_id) or public.is_super_admin());

create table if not exists public.customer_photos (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists customer_photos_customer_id_idx
  on public.customer_photos (customer_id, created_at desc);

alter table public.customer_photos enable row level security;

drop policy if exists "customer_photos_member_all" on public.customer_photos;
create policy "customer_photos_member_all"
  on public.customer_photos for all
  to authenticated
  using (public.is_restaurant_member(restaurant_id) or public.is_super_admin())
  with check (public.is_restaurant_member(restaurant_id) or public.is_super_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'crm-photos',
  'crm-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "crm_photos_member_select" on storage.objects;
drop policy if exists "crm_photos_member_insert" on storage.objects;
drop policy if exists "crm_photos_member_update" on storage.objects;
drop policy if exists "crm_photos_member_delete" on storage.objects;

create policy "crm_photos_member_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'crm-photos'
    and (
      public.is_restaurant_member((storage.foldername(name))[1]::uuid)
      or public.is_super_admin()
    )
  );

create policy "crm_photos_member_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'crm-photos'
    and (
      public.is_restaurant_member((storage.foldername(name))[1]::uuid)
      or public.is_super_admin()
    )
  );

create policy "crm_photos_member_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'crm-photos'
    and (
      public.is_restaurant_member((storage.foldername(name))[1]::uuid)
      or public.is_super_admin()
    )
  )
  with check (
    bucket_id = 'crm-photos'
    and (
      public.is_restaurant_member((storage.foldername(name))[1]::uuid)
      or public.is_super_admin()
    )
  );

create policy "crm_photos_member_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'crm-photos'
    and (
      public.is_restaurant_member((storage.foldername(name))[1]::uuid)
      or public.is_super_admin()
    )
  );
