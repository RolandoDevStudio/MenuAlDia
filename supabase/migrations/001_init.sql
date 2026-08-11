-- Menú al Día — schema + RLS + Storage + seed demo
-- IMPORTANTE: en el SQL Editor de Supabase, selecciona TODO este archivo
-- (desde la primera línea hasta el final) y pulsa Run UNA sola vez.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  slogan text not null default 'Sabor casero',
  logo_url text,
  phone_whatsapp text not null default '',
  address text not null default '',
  maps_url text,
  schedule_text text not null default '',
  shipping_cost numeric(10, 2) not null default 0,
  free_shipping boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.restaurant_members (
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  primary key (user_id, restaurant_id)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_fixed_catalog boolean not null default true
);

create index if not exists categories_restaurant_id_idx on public.categories (restaurant_id);

create table if not exists public.dishes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  name text not null,
  description text not null default '',
  photo_url text,
  price numeric(10, 2) not null default 0,
  is_side boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create index if not exists dishes_restaurant_id_idx on public.dishes (restaurant_id);
create index if not exists dishes_category_id_idx on public.dishes (category_id);

create table if not exists public.daily_menu_selections (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique references public.restaurants (id) on delete cascade,
  package_price numeric(10, 2) not null default 100,
  max_sides int not null default 2,
  menu_date date not null default (timezone('America/Mexico_City', now()))::date,
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_menu_dishes (
  daily_menu_id uuid not null references public.daily_menu_selections (id) on delete cascade,
  dish_id uuid not null references public.dishes (id) on delete cascade,
  primary key (daily_menu_id, dish_id)
);

create table if not exists public.daily_menu_sides (
  daily_menu_id uuid not null references public.daily_menu_selections (id) on delete cascade,
  dish_id uuid not null references public.dishes (id) on delete cascade,
  primary key (daily_menu_id, dish_id)
);

create table if not exists public.order_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_logs_restaurant_id_idx on public.order_logs (restaurant_id);
create index if not exists order_logs_created_at_idx on public.order_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_restaurant_member(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurant_members m
    where m.restaurant_id = p_restaurant_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.touch_daily_menu_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists daily_menu_selections_updated_at on public.daily_menu_selections;
create trigger daily_menu_selections_updated_at
before update on public.daily_menu_selections
for each row execute function public.touch_daily_menu_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.restaurants enable row level security;
alter table public.restaurant_members enable row level security;
alter table public.categories enable row level security;
alter table public.dishes enable row level security;
alter table public.daily_menu_selections enable row level security;
alter table public.daily_menu_dishes enable row level security;
alter table public.daily_menu_sides enable row level security;
alter table public.order_logs enable row level security;

drop policy if exists "restaurants_public_select" on public.restaurants;
drop policy if exists "restaurants_member_update" on public.restaurants;
drop policy if exists "restaurants_member_insert" on public.restaurants;
drop policy if exists "members_select_own" on public.restaurant_members;
drop policy if exists "members_insert_own" on public.restaurant_members;
drop policy if exists "categories_public_select" on public.categories;
drop policy if exists "categories_member_all" on public.categories;
drop policy if exists "dishes_public_select" on public.dishes;
drop policy if exists "dishes_member_all" on public.dishes;
drop policy if exists "daily_menu_public_select" on public.daily_menu_selections;
drop policy if exists "daily_menu_member_all" on public.daily_menu_selections;
drop policy if exists "daily_menu_dishes_public_select" on public.daily_menu_dishes;
drop policy if exists "daily_menu_dishes_member_all" on public.daily_menu_dishes;
drop policy if exists "daily_menu_sides_public_select" on public.daily_menu_sides;
drop policy if exists "daily_menu_sides_member_all" on public.daily_menu_sides;
drop policy if exists "order_logs_anon_insert" on public.order_logs;
drop policy if exists "order_logs_member_select" on public.order_logs;

create policy "restaurants_public_select"
  on public.restaurants for select
  to anon, authenticated
  using (true);

create policy "restaurants_member_update"
  on public.restaurants for update
  to authenticated
  using (public.is_restaurant_member(id))
  with check (public.is_restaurant_member(id));

create policy "restaurants_member_insert"
  on public.restaurants for insert
  to authenticated
  with check (public.is_restaurant_member(id));

create policy "members_select_own"
  on public.restaurant_members for select
  to authenticated
  using (user_id = auth.uid());

create policy "members_insert_own"
  on public.restaurant_members for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "categories_public_select"
  on public.categories for select
  to anon, authenticated
  using (true);

create policy "categories_member_all"
  on public.categories for all
  to authenticated
  using (public.is_restaurant_member(restaurant_id))
  with check (public.is_restaurant_member(restaurant_id));

create policy "dishes_public_select"
  on public.dishes for select
  to anon, authenticated
  using (true);

create policy "dishes_member_all"
  on public.dishes for all
  to authenticated
  using (public.is_restaurant_member(restaurant_id))
  with check (public.is_restaurant_member(restaurant_id));

create policy "daily_menu_public_select"
  on public.daily_menu_selections for select
  to anon, authenticated
  using (true);

create policy "daily_menu_member_all"
  on public.daily_menu_selections for all
  to authenticated
  using (public.is_restaurant_member(restaurant_id))
  with check (public.is_restaurant_member(restaurant_id));

create policy "daily_menu_dishes_public_select"
  on public.daily_menu_dishes for select
  to anon, authenticated
  using (true);

create policy "daily_menu_dishes_member_all"
  on public.daily_menu_dishes for all
  to authenticated
  using (
    exists (
      select 1 from public.daily_menu_selections dms
      where dms.id = daily_menu_id
        and public.is_restaurant_member(dms.restaurant_id)
    )
  )
  with check (
    exists (
      select 1 from public.daily_menu_selections dms
      where dms.id = daily_menu_id
        and public.is_restaurant_member(dms.restaurant_id)
    )
  );

create policy "daily_menu_sides_public_select"
  on public.daily_menu_sides for select
  to anon, authenticated
  using (true);

create policy "daily_menu_sides_member_all"
  on public.daily_menu_sides for all
  to authenticated
  using (
    exists (
      select 1 from public.daily_menu_selections dms
      where dms.id = daily_menu_id
        and public.is_restaurant_member(dms.restaurant_id)
    )
  )
  with check (
    exists (
      select 1 from public.daily_menu_selections dms
      where dms.id = daily_menu_id
        and public.is_restaurant_member(dms.restaurant_id)
    )
  );

create policy "order_logs_anon_insert"
  on public.order_logs for insert
  to anon, authenticated
  with check (true);

create policy "order_logs_member_select"
  on public.order_logs for select
  to authenticated
  using (public.is_restaurant_member(restaurant_id));

-- ---------------------------------------------------------------------------
-- Storage bucket dish-photos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dish-photos',
  'dish-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "dish_photos_public_read" on storage.objects;
drop policy if exists "dish_photos_member_insert" on storage.objects;
drop policy if exists "dish_photos_member_update" on storage.objects;
drop policy if exists "dish_photos_member_delete" on storage.objects;

create policy "dish_photos_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'dish-photos');

create policy "dish_photos_member_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'dish-photos'
    and public.is_restaurant_member((storage.foldername(name))[1]::uuid)
  );

create policy "dish_photos_member_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'dish-photos'
    and public.is_restaurant_member((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'dish-photos'
    and public.is_restaurant_member((storage.foldername(name))[1]::uuid)
  );

create policy "dish_photos_member_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'dish-photos'
    and public.is_restaurant_member((storage.foldername(name))[1]::uuid)
  );

-- ---------------------------------------------------------------------------
-- Seed demo (/demo)
-- ---------------------------------------------------------------------------

insert into public.restaurants (
  id, slug, name, slogan, phone_whatsapp, address, maps_url, schedule_text, shipping_cost, free_shipping
) values (
  'a0000000-0000-4000-8000-000000000001',
  'demo',
  'Cocina Doña Lupita',
  'Sabor casero',
  '5215512345678',
  'Calle Morelos 123, Centro',
  'https://maps.google.com/?q=Calle+Morelos+123',
  'Lun–Sáb 12:00–17:00',
  0,
  true
) on conflict (slug) do nothing;

insert into public.categories (id, restaurant_id, name, sort_order, is_fixed_catalog) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Menú del Día', 0, false),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Guarniciones', 1, false),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Entradas', 2, true),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Bebidas', 3, true),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'Postres', 4, true),
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'A la carta', 5, true)
on conflict (id) do nothing;

insert into public.dishes (id, restaurant_id, category_id, name, description, price, is_side, is_active, sort_order) values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Milanesa de res', 'Empanizada con arroz o frijoles', 100, false, true, 1),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Pollo en mole', 'Mole casero con tortillas', 100, false, true, 2),
  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Tinga de pollo', 'Con tostadas o arroz', 100, false, true, 3),
  ('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Arroz rojo', '', 0, true, true, 1),
  ('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Frijoles refritos', '', 0, true, true, 2),
  ('c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Ensalada fresca', '', 0, true, true, 3),
  ('c0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Nopales', '', 0, true, true, 4),
  ('c0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'Sopa del día', 'Consumo o crema', 35, false, true, 1),
  ('c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'Agua de sabor', '1 Litro', 25, false, true, 1),
  ('c0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'Refresco', 'Lata 355 ml', 20, false, true, 2),
  ('c0000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000005', 'Flan napolitano', '', 30, false, true, 1),
  ('c0000000-0000-4000-8000-00000000000c', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'Chilaquiles', 'Rojos o verdes', 85, false, true, 1)
on conflict (id) do nothing;

insert into public.daily_menu_selections (id, restaurant_id, package_price, max_sides, menu_date)
values (
  'd0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  100,
  2,
  (timezone('America/Mexico_City', now()))::date
) on conflict (restaurant_id) do nothing;

insert into public.daily_menu_dishes (daily_menu_id, dish_id) values
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002')
on conflict (daily_menu_id, dish_id) do nothing;

insert into public.daily_menu_sides (daily_menu_id, dish_id) values
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000005'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000006'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000007')
on conflict (daily_menu_id, dish_id) do nothing;
