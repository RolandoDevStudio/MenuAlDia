-- Menú al Día — platform hardening: 3 giros, addons, combos, geo, soft delete, CMS
-- Run AFTER 003_superadmin_audit_verticals.sql

-- ---------------------------------------------------------------------------
-- 1. Geo on restaurants
-- ---------------------------------------------------------------------------

alter table public.restaurants
  add column if not exists city text not null default '',
  add column if not exists state text not null default '';

-- ---------------------------------------------------------------------------
-- 2. Soft delete on dishes
-- ---------------------------------------------------------------------------

alter table public.dishes
  add column if not exists archived_at timestamptz null;

create index if not exists dishes_archived_at_idx
  on public.dishes (restaurant_id)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- 3. Remap business_type → restaurante | servicios | productos
-- ---------------------------------------------------------------------------

update public.restaurants set business_type = 'servicios' where business_type = 'estetica';
update public.restaurants set business_type = 'productos' where business_type = 'tienda';
update public.restaurants
set business_type = 'restaurante'
where business_type is null
   or business_type not in ('restaurante', 'servicios', 'productos');

alter table public.restaurants drop constraint if exists restaurants_business_type_check;
alter table public.restaurants
  add constraint restaurants_business_type_check
  check (business_type in ('restaurante', 'servicios', 'productos'));

-- ---------------------------------------------------------------------------
-- 4. dish_addons (per-product extras)
-- ---------------------------------------------------------------------------

create table if not exists public.dish_addons (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references public.dishes (id) on delete cascade,
  name text not null,
  price_delta numeric(10, 2) not null default 0,
  sort_order int not null default 0,
  is_active boolean not null default true,
  archived_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists dish_addons_dish_id_idx on public.dish_addons (dish_id);
create index if not exists dish_addons_active_idx
  on public.dish_addons (dish_id)
  where archived_at is null and is_active = true;

alter table public.dish_addons enable row level security;

drop policy if exists "dish_addons_public_select" on public.dish_addons;
create policy "dish_addons_public_select"
  on public.dish_addons for select
  using (
    exists (
      select 1 from public.dishes d
      where d.id = dish_id
        and d.archived_at is null
        and (
          public.restaurant_is_publicly_readable(d.restaurant_id)
          or public.is_restaurant_member(d.restaurant_id)
        )
    )
  );

drop policy if exists "dish_addons_member_all" on public.dish_addons;
create policy "dish_addons_member_all"
  on public.dish_addons for all
  to authenticated
  using (
    exists (
      select 1 from public.dishes d
      where d.id = dish_id
        and (
          public.is_restaurant_member(d.restaurant_id)
          or public.is_super_admin()
        )
    )
  )
  with check (
    exists (
      select 1 from public.dishes d
      where d.id = dish_id
        and (
          public.is_restaurant_member(d.restaurant_id)
          or public.is_super_admin()
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Combos / colecciones express
-- ---------------------------------------------------------------------------

create table if not exists public.combos (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  slug text not null,
  title text not null,
  description text not null default '',
  photo_url text,
  fixed_price numeric(10, 2),
  is_active boolean not null default true,
  sort_order int not null default 0,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (restaurant_id, slug)
);

create index if not exists combos_restaurant_id_idx on public.combos (restaurant_id);
create index if not exists combos_public_idx
  on public.combos (restaurant_id, slug)
  where archived_at is null and is_active = true;

create table if not exists public.combo_items (
  combo_id uuid not null references public.combos (id) on delete cascade,
  dish_id uuid not null references public.dishes (id) on delete cascade,
  quantity int not null default 1 check (quantity >= 1),
  sort_order int not null default 0,
  primary key (combo_id, dish_id)
);

create index if not exists combo_items_dish_id_idx on public.combo_items (dish_id);

alter table public.combos enable row level security;
alter table public.combo_items enable row level security;

drop policy if exists "combos_public_select" on public.combos;
create policy "combos_public_select"
  on public.combos for select
  using (
    public.restaurant_is_publicly_readable(restaurant_id)
    or public.is_restaurant_member(restaurant_id)
    or public.is_super_admin()
  );

drop policy if exists "combos_member_all" on public.combos;
create policy "combos_member_all"
  on public.combos for all
  to authenticated
  using (public.is_restaurant_member(restaurant_id) or public.is_super_admin())
  with check (public.is_restaurant_member(restaurant_id) or public.is_super_admin());

drop policy if exists "combo_items_public_select" on public.combo_items;
create policy "combo_items_public_select"
  on public.combo_items for select
  using (
    exists (
      select 1 from public.combos c
      where c.id = combo_id
        and (
          public.restaurant_is_publicly_readable(c.restaurant_id)
          or public.is_restaurant_member(c.restaurant_id)
          or public.is_super_admin()
        )
    )
  );

drop policy if exists "combo_items_member_all" on public.combo_items;
create policy "combo_items_member_all"
  on public.combo_items for all
  to authenticated
  using (
    exists (
      select 1 from public.combos c
      where c.id = combo_id
        and (public.is_restaurant_member(c.restaurant_id) or public.is_super_admin())
    )
  )
  with check (
    exists (
      select 1 from public.combos c
      where c.id = combo_id
        and (public.is_restaurant_member(c.restaurant_id) or public.is_super_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- 6. platform_settings (landing CMS + plan prices)
-- ---------------------------------------------------------------------------

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

drop policy if exists "platform_settings_public_select" on public.platform_settings;
create policy "platform_settings_public_select"
  on public.platform_settings for select
  using (true);

drop policy if exists "platform_settings_super_admin_all" on public.platform_settings;
create policy "platform_settings_super_admin_all"
  on public.platform_settings for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

insert into public.platform_settings (key, value) values
  (
    'plan_prices',
    '{
      "catalog": { "monthly": 199, "annual": 1990 },
      "daily": { "monthly": 349, "annual": 3490 },
      "pro": { "monthly": 599, "annual": 5990 }
    }'::jsonb
  ),
  (
    'landing_content',
    '{
      "heroTitle": "Tu menú digital, pedidos por WhatsApp",
      "heroSubtitle": "Actualiza el menú, genera flyers y recibe pedidos sin comisiones de delivery.",
      "contactBlurb": "Cuéntanos de tu negocio y te armamos el plan."
    }'::jsonb
  )
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 7. plan_templates: 3×3 matrix (drop legacy estetica/tienda rows)
-- ---------------------------------------------------------------------------

delete from public.plan_templates
where business_type in ('estetica', 'tienda');

update public.plan_templates
set business_type = 'servicios'
where business_type = 'estetica';

update public.plan_templates
set business_type = 'productos'
where business_type = 'tienda';

alter table public.plan_templates drop constraint if exists plan_templates_business_type_check;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'plan_templates_business_type_check'
  ) then
    alter table public.plan_templates
      add constraint plan_templates_business_type_check
      check (business_type in ('restaurante', 'servicios', 'productos'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Demo seed: one combo on demo-fonda (if dishes exist)
-- ---------------------------------------------------------------------------

do $$
declare
  rid uuid;
  d1 uuid;
  d2 uuid;
  cid uuid;
begin
  select id into rid from public.restaurants
  where slug in ('demo-restaurante', 'demo-fonda')
  limit 1;
  if rid is null then
    return;
  end if;

  select id into d1 from public.dishes
  where restaurant_id = rid and is_side = false and archived_at is null
  order by sort_order limit 1;

  select id into d2 from public.dishes
  where restaurant_id = rid and is_side = false and archived_at is null and id <> d1
  order by sort_order limit 1;

  if d1 is null or d2 is null then
    return;
  end if;

  insert into public.combos (id, restaurant_id, slug, title, description, fixed_price, is_active)
  values (
    'b0000000-0000-4000-8000-000000000001',
    rid,
    'combo-familiar',
    'Combo Familiar',
    'Dos platillos a precio especial. Ideal para compartir por WhatsApp.',
    180,
    true
  )
  on conflict (restaurant_id, slug) do update
    set title = excluded.title,
        description = excluded.description,
        fixed_price = excluded.fixed_price,
        is_active = true,
        archived_at = null;

  select id into cid from public.combos
  where restaurant_id = rid and slug = 'combo-familiar';

  insert into public.combo_items (combo_id, dish_id, quantity, sort_order) values
    (cid, d1, 1, 0),
    (cid, d2, 1, 1)
  on conflict (combo_id, dish_id) do nothing;
end $$;
