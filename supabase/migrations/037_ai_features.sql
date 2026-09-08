-- AI: usage, intent cache, image packs, restaurant-assets bucket

alter table public.restaurants
  add column if not exists ai_image_bonus integer not null default 0,
  add column if not exists ai_paused boolean not null default false;

comment on column public.restaurants.ai_image_bonus is
  'Extra AI image generations purchased/approved by superadmin.';
comment on column public.restaurants.ai_paused is
  'When true, tenant AI features are paused.';

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants (id) on delete set null,
  kind text not null
    check (kind in ('flyer', 'banner', 'background', 'scan', 'intent')),
  ok boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_restaurant_created_idx
  on public.ai_usage (restaurant_id, created_at desc);
create index if not exists ai_usage_kind_created_idx
  on public.ai_usage (kind, created_at desc);
create index if not exists ai_usage_created_idx
  on public.ai_usage (created_at desc);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage_service_all" on public.ai_usage;
-- No anon/authenticated policies: only service role (bypasses RLS).

create table if not exists public.ai_intent_cache (
  hash text primary key,
  result jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_intent_cache_expires_idx
  on public.ai_intent_cache (expires_at);

alter table public.ai_intent_cache enable row level security;

create table if not exists public.ai_image_pack_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  pack_size integer not null default 10,
  amount_mxn numeric(12, 2),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  notes text not null default '',
  created_by uuid,
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists ai_image_pack_requests_status_idx
  on public.ai_image_pack_requests (status, created_at desc);

alter table public.ai_image_pack_requests enable row level security;

drop policy if exists "ai_pack_member_select" on public.ai_image_pack_requests;
create policy "ai_pack_member_select"
  on public.ai_image_pack_requests for select
  to authenticated
  using (public.is_restaurant_member(restaurant_id));

drop policy if exists "ai_pack_member_insert" on public.ai_image_pack_requests;
create policy "ai_pack_member_insert"
  on public.ai_image_pack_requests for insert
  to authenticated
  with check (public.is_restaurant_member(restaurant_id));

insert into public.platform_settings (key, value)
values
  ('ai_paused', 'false'::jsonb),
  ('ai_daily_global_limit', '1200'::jsonb),
  ('ai_scan_monthly_limit', '8'::jsonb),
  ('ai_image_pack_size', '10'::jsonb),
  ('ai_image_pack_price_mxn', '99'::jsonb),
  (
    'ai_image_limits',
    '{"catalog":0,"daily":8,"pro":25}'::jsonb
  )
on conflict (key) do nothing;

-- Public bucket for AI-generated flyers/banners/backgrounds
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-assets',
  'restaurant-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "restaurant_assets_public_read" on storage.objects;
drop policy if exists "restaurant_assets_member_insert" on storage.objects;
drop policy if exists "restaurant_assets_member_update" on storage.objects;
drop policy if exists "restaurant_assets_member_delete" on storage.objects;

create policy "restaurant_assets_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'restaurant-assets');

create policy "restaurant_assets_member_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'restaurant-assets'
    and public.is_restaurant_member((storage.foldername(name))[1]::uuid)
  );

create policy "restaurant_assets_member_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'restaurant-assets'
    and public.is_restaurant_member((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'restaurant-assets'
    and public.is_restaurant_member((storage.foldername(name))[1]::uuid)
  );

create policy "restaurant_assets_member_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'restaurant-assets'
    and public.is_restaurant_member((storage.foldername(name))[1]::uuid)
  );

alter table public.flyers drop constraint if exists flyers_source_check;
alter table public.flyers
  add constraint flyers_source_check
  check (source in ('studio', 'upload', 'ai'));
