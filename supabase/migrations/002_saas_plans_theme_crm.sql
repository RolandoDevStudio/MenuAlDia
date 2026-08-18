-- Menú al Día — SaaS: plans, subscription gate, theme, CRM, super_admin
-- Run AFTER 001_init.sql in Supabase SQL Editor

-- ---------------------------------------------------------------------------
-- 1. Extend restaurants
-- ---------------------------------------------------------------------------

alter table public.restaurants
  add column if not exists plan_type text not null default 'catalog',
  add column if not exists is_active boolean not null default true,
  add column if not exists subscription_end_date timestamptz not null default (now() + interval '30 days'),
  add column if not exists theme_config jsonb not null default '{
    "preset": "fonda_calida",
    "colors": {
      "primary": "#c45c26",
      "bg": "#faf6f1",
      "card": "#ffffff",
      "text": "#1c1410"
    },
    "font": "display_bebas",
    "photoFrame": "rounded_modern"
  }'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'restaurants_plan_type_check'
  ) then
    alter table public.restaurants
      add constraint restaurants_plan_type_check
      check (plan_type in ('catalog', 'daily', 'pro'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Expand roles (drop old check, add new)
-- ---------------------------------------------------------------------------

alter table public.restaurant_members drop constraint if exists restaurant_members_role_check;
alter table public.restaurant_members
  add constraint restaurant_members_role_check
  check (role in ('owner', 'staff', 'super_admin'));

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurant_members m
    where m.user_id = auth.uid()
      and m.role = 'super_admin'
  );
$$;

create or replace function public.restaurant_is_publicly_readable(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurants r
    where r.id = p_id
      and r.is_active = true
      and r.subscription_end_date > now()
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Replace public SELECT policies (subscription gate)
-- ---------------------------------------------------------------------------

drop policy if exists "restaurants_public_select" on public.restaurants;
create policy "restaurants_public_select"
  on public.restaurants for select
  to anon, authenticated
  using (
    public.restaurant_is_publicly_readable(id)
    or public.is_restaurant_member(id)
    or public.is_super_admin()
  );

drop policy if exists "restaurants_super_admin_update" on public.restaurants;
create policy "restaurants_super_admin_update"
  on public.restaurants for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "restaurants_super_admin_insert" on public.restaurants;
create policy "restaurants_super_admin_insert"
  on public.restaurants for insert
  to authenticated
  with check (public.is_super_admin());

drop policy if exists "categories_public_select" on public.categories;
create policy "categories_public_select"
  on public.categories for select
  to anon, authenticated
  using (
    public.restaurant_is_publicly_readable(restaurant_id)
    or public.is_restaurant_member(restaurant_id)
    or public.is_super_admin()
  );

drop policy if exists "dishes_public_select" on public.dishes;
create policy "dishes_public_select"
  on public.dishes for select
  to anon, authenticated
  using (
    public.restaurant_is_publicly_readable(restaurant_id)
    or public.is_restaurant_member(restaurant_id)
    or public.is_super_admin()
  );

drop policy if exists "daily_menu_public_select" on public.daily_menu_selections;
create policy "daily_menu_public_select"
  on public.daily_menu_selections for select
  to anon, authenticated
  using (
    public.restaurant_is_publicly_readable(restaurant_id)
    or public.is_restaurant_member(restaurant_id)
    or public.is_super_admin()
  );

drop policy if exists "daily_menu_dishes_public_select" on public.daily_menu_dishes;
create policy "daily_menu_dishes_public_select"
  on public.daily_menu_dishes for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.daily_menu_selections dms
      where dms.id = daily_menu_id
        and (
          public.restaurant_is_publicly_readable(dms.restaurant_id)
          or public.is_restaurant_member(dms.restaurant_id)
          or public.is_super_admin()
        )
    )
  );

drop policy if exists "daily_menu_sides_public_select" on public.daily_menu_sides;
create policy "daily_menu_sides_public_select"
  on public.daily_menu_sides for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.daily_menu_selections dms
      where dms.id = daily_menu_id
        and (
          public.restaurant_is_publicly_readable(dms.restaurant_id)
          or public.is_restaurant_member(dms.restaurant_id)
          or public.is_super_admin()
        )
    )
  );

-- Super-admin can manage all categories/dishes/daily for clone
drop policy if exists "categories_super_admin_all" on public.categories;
create policy "categories_super_admin_all"
  on public.categories for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "dishes_super_admin_all" on public.dishes;
create policy "dishes_super_admin_all"
  on public.dishes for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "daily_menu_super_admin_all" on public.daily_menu_selections;
create policy "daily_menu_super_admin_all"
  on public.daily_menu_selections for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "daily_menu_dishes_super_admin_all" on public.daily_menu_dishes;
create policy "daily_menu_dishes_super_admin_all"
  on public.daily_menu_dishes for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "daily_menu_sides_super_admin_all" on public.daily_menu_sides;
create policy "daily_menu_sides_super_admin_all"
  on public.daily_menu_sides for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "members_super_admin_all" on public.restaurant_members;
create policy "members_super_admin_all"
  on public.restaurant_members for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 5. CRM tables (Pro)
-- ---------------------------------------------------------------------------

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  phone text,
  address text not null default '',
  orders_count int not null default 0,
  last_order_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists customers_restaurant_id_idx on public.customers (restaurant_id);
create index if not exists customers_restaurant_phone_idx on public.customers (restaurant_id, phone);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  total numeric(10, 2) not null default 0,
  status text not null default 'submitted',
  created_at timestamptz not null default now()
);

create index if not exists orders_restaurant_id_idx on public.orders (restaurant_id);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

alter table public.customers enable row level security;
alter table public.orders enable row level security;

drop policy if exists "customers_member_all" on public.customers;
create policy "customers_member_all"
  on public.customers for all
  to authenticated
  using (public.is_restaurant_member(restaurant_id) or public.is_super_admin())
  with check (public.is_restaurant_member(restaurant_id) or public.is_super_admin());

drop policy if exists "customers_anon_insert" on public.customers;
create policy "customers_anon_insert"
  on public.customers for insert
  to anon, authenticated
  with check (
    public.restaurant_is_publicly_readable(restaurant_id)
    and exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.plan_type = 'pro'
    )
  );

drop policy if exists "orders_member_all" on public.orders;
create policy "orders_member_all"
  on public.orders for all
  to authenticated
  using (public.is_restaurant_member(restaurant_id) or public.is_super_admin())
  with check (public.is_restaurant_member(restaurant_id) or public.is_super_admin());

drop policy if exists "orders_anon_insert" on public.orders;
create policy "orders_anon_insert"
  on public.orders for insert
  to anon, authenticated
  with check (
    public.restaurant_is_publicly_readable(restaurant_id)
    and exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.plan_type = 'pro'
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Seed updates + demo tenants for landing
-- ---------------------------------------------------------------------------

update public.restaurants
set
  plan_type = 'daily',
  is_active = true,
  subscription_end_date = now() + interval '365 days',
  slug = case when slug = 'demo' then 'demo-fonda' else slug end,
  name = case when slug = 'demo' then 'Cocina Doña Lupita' else name end
where slug in ('demo', 'demo-fonda');

-- Ensure demo-fonda exists (if still named demo from older seed)
update public.restaurants
set slug = 'demo-fonda', plan_type = 'daily', is_active = true,
    subscription_end_date = now() + interval '365 days'
where id = 'a0000000-0000-4000-8000-000000000001';

insert into public.restaurants (
  id, slug, name, slogan, phone_whatsapp, address, maps_url, schedule_text,
  shipping_cost, free_shipping, plan_type, is_active, subscription_end_date, theme_config
) values (
  'a0000000-0000-4000-8000-000000000002',
  'demo-estetica',
  'Estética Bella Luna',
  'Belleza y cuidado',
  '5215512345679',
  'Av. Reforma 45, Centro',
  'https://maps.google.com/?q=Av+Reforma+45',
  'Mar–Sáb 10:00–19:00',
  0,
  true,
  'catalog',
  true,
  now() + interval '365 days',
  '{
    "preset": "estetica_suave",
    "colors": {
      "primary": "#8b5a6b",
      "bg": "#faf7f8",
      "card": "#ffffff",
      "text": "#2a1f24"
    },
    "font": "display_bebas",
    "photoFrame": "circle_avatar"
  }'::jsonb
) on conflict (slug) do nothing;

insert into public.categories (id, restaurant_id, name, sort_order, is_fixed_catalog) values
  ('b0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000002', 'Servicios', 0, true),
  ('b0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000002', 'Paquetes', 1, true)
on conflict (id) do nothing;

insert into public.dishes (id, restaurant_id, category_id, name, description, price, is_side, is_active, sort_order) values
  ('c0000000-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000011', 'Corte de cabello', 'Incluye lavado', 180, false, true, 1),
  ('c0000000-0000-4000-8000-000000000022', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000011', 'Manicure', 'Gel o tradicional', 150, false, true, 2),
  ('c0000000-0000-4000-8000-000000000023', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000012', 'Día de spa', 'Facial + manicure', 450, false, true, 1)
on conflict (id) do nothing;
