-- =============================================================================
-- Seed de ejemplos para revisar Menú al Día en local / staging
-- Requisitos: ya corriste 001_init.sql + 002_saas_plans_theme_crm.sql
-- Ejecutar en Supabase SQL Editor (todo el archivo, una sola vez o re-ejecutable)
-- =============================================================================
-- Qué agrega:
--   • demo-pro          → plan pro (CRM: customers + orders)
--   • demo-vencido      → is_active=false / suscripción vencida (anon NO lo ve)
--   • order_logs        → en demo-fonda y demo-pro
--   • customers/orders  → solo en demo-pro
--
-- Ya existen de migraciones:
--   • demo-fonda   (daily)  id a0000000-…0001
--   • demo-estetica (catalog) id a0000000-…0002
--
-- Members (owner/staff/super_admin): ver bloque al final — requiere UUID de Auth.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Tenant PRO (para Pedidos / Clientes / Métricas / CSV)
-- ---------------------------------------------------------------------------

insert into public.restaurants (
  id, slug, name, slogan, phone_whatsapp, address, maps_url, schedule_text,
  shipping_cost, free_shipping, plan_type, is_active, subscription_end_date, theme_config
) values (
  'a0000000-0000-4000-8000-000000000003',
  'demo-pro',
  'Taquería El Güero Pro',
  'Tacos al pastor y CRM',
  '5215587654321',
  'Calle Juárez 88, Centro',
  'https://maps.google.com/?q=Calle+Juarez+88',
  'Lun–Dom 13:00–23:00',
  25,
  false,
  'pro',
  true,
  now() + interval '365 days',
  '{
    "preset": "moderno_verde",
    "colors": {
      "primary": "#2f6b4f",
      "bg": "#f4f7f5",
      "card": "#ffffff",
      "text": "#14201a"
    },
    "font": "sans_clean",
    "photoFrame": "floating_shadow"
  }'::jsonb
)
on conflict (slug) do update set
  plan_type = excluded.plan_type,
  is_active = excluded.is_active,
  subscription_end_date = excluded.subscription_end_date,
  theme_config = excluded.theme_config,
  name = excluded.name,
  slogan = excluded.slogan;

-- ---------------------------------------------------------------------------
-- 2) Tenant VENCIDO (smoke test RLS: /demo-vencido → 404 para anon)
-- ---------------------------------------------------------------------------

insert into public.restaurants (
  id, slug, name, slogan, phone_whatsapp, address, schedule_text,
  shipping_cost, free_shipping, plan_type, is_active, subscription_end_date, theme_config
) values (
  'a0000000-0000-4000-8000-000000000004',
  'demo-vencido',
  'Fonda Suspendida',
  'No debería verse en público',
  '5215500000000',
  'Calle Cerrada 1',
  'Cerrado',
  0,
  true,
  'daily',
  false,
  now() - interval '7 days',
  '{
    "preset": "fonda_calida",
    "colors": {
      "primary": "#c45c26",
      "bg": "#faf6f1",
      "card": "#ffffff",
      "text": "#1c1410"
    },
    "font": "display_bebas",
    "photoFrame": "rounded_modern"
  }'::jsonb
)
on conflict (slug) do update set
  is_active = false,
  subscription_end_date = now() - interval '7 days';

-- ---------------------------------------------------------------------------
-- 3) Categorías + platillos + menú del día (demo-pro)
-- ---------------------------------------------------------------------------

insert into public.categories (id, restaurant_id, name, sort_order, is_fixed_catalog) values
  ('b0000000-0000-4000-8000-000000000031', 'a0000000-0000-4000-8000-000000000003', 'Menú del Día', 0, false),
  ('b0000000-0000-4000-8000-000000000032', 'a0000000-0000-4000-8000-000000000003', 'Guarniciones', 1, false),
  ('b0000000-0000-4000-8000-000000000033', 'a0000000-0000-4000-8000-000000000003', 'Tacos', 2, true),
  ('b0000000-0000-4000-8000-000000000034', 'a0000000-0000-4000-8000-000000000003', 'Bebidas', 3, true)
on conflict (id) do nothing;

insert into public.dishes (
  id, restaurant_id, category_id, name, description, price, is_side, is_active, sort_order
) values
  ('c0000000-0000-4000-8000-000000000031', 'a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000031',
   'Pastor del día', 'Con piña y cilantro', 95, false, true, 1),
  ('c0000000-0000-4000-8000-000000000032', 'a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000031',
   'Suadero', 'Estilo DF', 95, false, true, 2),
  ('c0000000-0000-4000-8000-000000000033', 'a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000032',
   'Cebolla asada', '', 0, true, true, 1),
  ('c0000000-0000-4000-8000-000000000034', 'a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000032',
   'Salsa verde', '', 0, true, true, 2),
  ('c0000000-0000-4000-8000-000000000035', 'a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000033',
   'Orden pastor (5)', 'Tortilla maíz', 85, false, true, 1),
  ('c0000000-0000-4000-8000-000000000036', 'a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000033',
   'Orden bistec (5)', '', 90, false, true, 2),
  ('c0000000-0000-4000-8000-000000000037', 'a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000034',
   'Agua de horchata', '1 L', 30, false, true, 1),
  ('c0000000-0000-4000-8000-000000000038', 'a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000034',
   'Refresco', '355 ml', 20, false, true, 2)
on conflict (id) do nothing;

insert into public.daily_menu_selections (id, restaurant_id, package_price, max_sides, menu_date)
values (
  'd0000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-000000000003',
  95,
  2,
  (timezone('America/Mexico_City', now()))::date
)
on conflict (restaurant_id) do update set
  package_price = excluded.package_price,
  max_sides = excluded.max_sides,
  menu_date = excluded.menu_date;

insert into public.daily_menu_dishes (daily_menu_id, dish_id) values
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000031'),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000032')
on conflict (daily_menu_id, dish_id) do nothing;

insert into public.daily_menu_sides (daily_menu_id, dish_id) values
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000033'),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000034')
on conflict (daily_menu_id, dish_id) do nothing;

-- Categoría mínima para el vencido (solo para que exista algo en DB)
insert into public.categories (id, restaurant_id, name, sort_order, is_fixed_catalog) values
  ('b0000000-0000-4000-8000-000000000041', 'a0000000-0000-4000-8000-000000000004', 'Oculto', 0, true)
on conflict (id) do nothing;

insert into public.dishes (id, restaurant_id, category_id, name, description, price, is_side, is_active, sort_order)
values (
  'c0000000-0000-4000-8000-000000000041',
  'a0000000-0000-4000-8000-000000000004',
  'b0000000-0000-4000-8000-000000000041',
  'Platillo oculto',
  'No visible en público',
  50,
  false,
  true,
  1
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4) order_logs (best-effort; planes daily y pro)
-- ---------------------------------------------------------------------------

delete from public.order_logs
where id in (
  'e0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000002',
  'e0000000-0000-4000-8000-000000000003'
);

insert into public.order_logs (id, restaurant_id, payload, created_at) values
(
  'e0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001', -- demo-fonda
  '{
    "customer_name": "María Pérez",
    "address": "Calle Morelos 10",
    "payment": "cash",
    "cash_amount": 200,
    "items": [
      {"name": "Menú: Milanesa de res", "quantity": 1, "unit_price": 100, "side_names": ["Arroz rojo", "Frijoles refritos"]}
    ],
    "subtotal": 100,
    "shipping": 0,
    "total": 100
  }'::jsonb,
  now() - interval '2 hours'
),
(
  'e0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000003', -- demo-pro
  '{
    "customer_name": "Carlos Ruiz",
    "phone": "5511112233",
    "address": "Av. Juárez 20 Depto 3",
    "payment": "transfer",
    "items": [
      {"name": "Orden pastor (5)", "quantity": 2, "unit_price": 85},
      {"name": "Agua de horchata", "quantity": 1, "unit_price": 30}
    ],
    "subtotal": 200,
    "shipping": 25,
    "total": 225
  }'::jsonb,
  now() - interval '1 day'
),
(
  'e0000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-000000000003',
  '{
    "customer_name": "Ana López",
    "phone": "5522223344",
    "address": "Col. Centro, Calle 5 #12",
    "payment": "cash",
    "cash_amount": 500,
    "items": [
      {"name": "Menú: Pastor del día", "quantity": 2, "unit_price": 95, "side_names": ["Cebolla asada"]}
    ],
    "subtotal": 190,
    "shipping": 25,
    "total": 215
  }'::jsonb,
  now() - interval '3 hours'
);

-- ---------------------------------------------------------------------------
-- 5) customers + orders (solo Pro / CRM)
-- ---------------------------------------------------------------------------

delete from public.orders
where id in (
  'f0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000002',
  'f0000000-0000-4000-8000-000000000003'
);

delete from public.customers
where id in (
  'ca000000-0000-4000-8000-000000000001',
  'ca000000-0000-4000-8000-000000000002'
);

insert into public.customers (
  id, restaurant_id, name, phone, address, orders_count, last_order_at, created_at
) values
(
  'ca000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000003',
  'Carlos Ruiz',
  '5511112233',
  'Av. Juárez 20 Depto 3',
  2,
  now() - interval '1 day',
  now() - interval '14 days'
),
(
  'ca000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000003',
  'Ana López',
  '5522223344',
  'Col. Centro, Calle 5 #12',
  1,
  now() - interval '3 hours',
  now() - interval '3 hours'
);

insert into public.orders (
  id, restaurant_id, customer_id, payload, total, status, created_at
) values
(
  'f0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000003',
  'ca000000-0000-4000-8000-000000000001',
  '{
    "customer_name": "Carlos Ruiz",
    "phone": "5511112233",
    "address": "Av. Juárez 20 Depto 3",
    "payment": "transfer",
    "items": [
      {"name": "Orden pastor (5)", "quantity": 2, "unit_price": 85},
      {"name": "Agua de horchata", "quantity": 1, "unit_price": 30}
    ],
    "subtotal": 200,
    "shipping": 25,
    "total": 225
  }'::jsonb,
  225,
  'submitted',
  now() - interval '1 day'
),
(
  'f0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000003',
  'ca000000-0000-4000-8000-000000000001',
  '{
    "customer_name": "Carlos Ruiz",
    "phone": "5511112233",
    "address": "Av. Juárez 20 Depto 3",
    "payment": "cash",
    "cash_amount": 150,
    "items": [
      {"name": "Orden bistec (5)", "quantity": 1, "unit_price": 90}
    ],
    "subtotal": 90,
    "shipping": 25,
    "total": 115
  }'::jsonb,
  115,
  'submitted',
  now() - interval '6 days'
),
(
  'f0000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-000000000003',
  'ca000000-0000-4000-8000-000000000002',
  '{
    "customer_name": "Ana López",
    "phone": "5522223344",
    "address": "Col. Centro, Calle 5 #12",
    "payment": "cash",
    "cash_amount": 500,
    "items": [
      {"name": "Menú: Pastor del día", "quantity": 2, "unit_price": 95, "side_names": ["Cebolla asada"]}
    ],
    "subtotal": 190,
    "shipping": 25,
    "total": 215
  }'::jsonb,
  215,
  'submitted',
  now() - interval '3 hours'
);

-- Asegura que demo-fonda y demo-estetica sigan con planes correctos
update public.restaurants
set plan_type = 'daily', is_active = true, subscription_end_date = now() + interval '365 days'
where id = 'a0000000-0000-4000-8000-000000000001';

update public.restaurants
set plan_type = 'catalog', is_active = true, subscription_end_date = now() + interval '365 days'
where id = 'a0000000-0000-4000-8000-000000000002';

-- ---------------------------------------------------------------------------
-- 6) Members — lasdelbarrio@demo.com
-- ---------------------------------------------------------------------------

insert into public.restaurant_members (user_id, restaurant_id, role) values
  ('f230e363-82a5-4ee6-acc8-a58272986d60', 'a0000000-0000-4000-8000-000000000001', 'super_admin'), -- fonda + /super-admin
  ('f230e363-82a5-4ee6-acc8-a58272986d60', 'a0000000-0000-4000-8000-000000000002', 'owner'),       -- estética
  ('f230e363-82a5-4ee6-acc8-a58272986d60', 'a0000000-0000-4000-8000-000000000003', 'owner')        -- pro (CRM)
on conflict (user_id, restaurant_id) do update set role = excluded.role;

-- =============================================================================
-- Checklist rápido después de correr:
--   /demo-fonda     → menú del día + flyer (daily)
--   /demo-estetica  → solo catálogo (catalog)
--   /demo-pro       → menú + CRM en admin (pro)
--   /demo-vencido   → 404 público (RLS)
--   Login           → lasdelbarrio@demo.com en /admin/login o /super-admin
-- =============================================================================
