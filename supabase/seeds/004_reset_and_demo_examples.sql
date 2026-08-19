-- =============================================================================
-- RESET + demos alineados al producto actual (post migración 004)
-- Ejecutar en Supabase SQL Editor DESPUÉS de 001→004 (en ese orden).
-- Re-ejecutable.
-- =============================================================================
-- Qué hace:
--   1) NO elimina tablas del producto (todas se usan: dishes, combos, CRM, etc.).
--   2) Borra TODOS los tenants/ejemplos y datos relacionados.
--   3) Conserva usuarios Auth y vuelve a enlazar roles super_admin.
--   4) Inserta demos nuevos para los 3 giros + Pro + vencido + addons/combos/CMS.
--
-- Demos:
--   /demo-restaurante → restaurante · plan daily · menú del día · combo · addons
--   /demo-estetica    → servicios · plan catalog · servicios/paquetes
--   /demo-productos   → productos · plan daily · colección express
--   /demo-pro         → restaurante · plan pro · CRM (customers/orders)
--   /demo-vencido     → oculto al público (RLS)
--   /demo             → redirect app a /demo-restaurante
--   /demo-fonda       → redirect 301 → /demo-restaurante (compat)
--
-- Login demo (ajusta el UUID si tu Auth es otro):
--   email: lasdelbarrio@demo.com
--   user:  f230e363-82a5-4ee6-acc8-a58272986d60
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0a) Precondición: migración 004 debe existir
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.combos') is null
     or to_regclass('public.combo_items') is null
     or to_regclass('public.dish_addons') is null
     or to_regclass('public.platform_settings') is null then
    raise exception
      'Falta la migración 004. Ejecuta primero supabase/migrations/004_platform_hardening.sql y luego este seed.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 0b) Guardar super_admins (Auth UUID) antes de borrar tenants
-- ---------------------------------------------------------------------------

drop table if exists public._seed_super_admins;
create table public._seed_super_admins (user_id uuid primary key);

insert into public._seed_super_admins (user_id)
select distinct user_id
from public.restaurant_members
where role = 'super_admin'
on conflict do nothing;

-- Si aún no hay membership, usa el UUID conocido de local (comenta si no aplica)
insert into public._seed_super_admins (user_id)
select 'f230e363-82a5-4ee6-acc8-a58272986d60'::uuid
where not exists (select 1 from public._seed_super_admins)
  and exists (
    select 1 from auth.users where id = 'f230e363-82a5-4ee6-acc8-a58272986d60'
  )
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 1) Borrar ejemplos / tenants (cascade limpia hijos)
--    Conservamos: platform_settings, plan_templates, auth.users
-- ---------------------------------------------------------------------------

-- Rompe members y borra tenants (cascade limpia categorías, dishes, combos, CRM, etc.)
delete from public.restaurant_members;
delete from public.restaurants;

-- Limpieza residual solo si la tabla existe (por si un entorno viejo no cascadea)
do $$
declare
  t text;
begin
  foreach t in array array[
    'combo_items',
    'combos',
    'dish_addons',
    'daily_menu_sides',
    'daily_menu_dishes',
    'daily_menu_selections',
    'dishes',
    'categories',
    'order_logs',
    'orders',
    'customers',
    'tenant_payments',
    'audit_logs'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('delete from public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2) CMS / precios (platform_settings) — upsert canónico
-- ---------------------------------------------------------------------------

insert into public.platform_settings (key, value, updated_at) values
(
  'plan_prices',
  '{
    "catalog": { "monthly": 199, "annual": 1990 },
    "daily": { "monthly": 349, "annual": 3490 },
    "pro": { "monthly": 599, "annual": 5990 }
  }'::jsonb,
  now()
),
(
  'landing_content',
  '{
    "heroTitle": "Tu menú digital, pedidos por WhatsApp",
    "heroSubtitle": "Actualiza el menú, genera flyers y recibe pedidos sin comisiones de delivery.",
    "contactBlurb": "Cuéntanos de tu negocio y te armamos el plan."
  }'::jsonb,
  now()
)
on conflict (key) do update
set value = excluded.value, updated_at = now();

-- ---------------------------------------------------------------------------
-- 3) Plantillas giro × plan (3×3)
-- ---------------------------------------------------------------------------

delete from public.plan_templates;

insert into public.plan_templates (
  business_type, plan_type, slug_key, name, theme_config, snapshot, is_active
) values
(
  'restaurante', 'catalog', 'tpl-rest-catalog', 'Restaurante · Catálogo',
  '{"preset":"fonda_calida","colors":{"primary":"#c45c26","bg":"#faf6f1","card":"#ffffff","text":"#1c1410"},"font":"display_bebas","photoFrame":"rounded_modern"}'::jsonb,
  '{"categories":[],"dishes":[],"daily_menu":null}'::jsonb, true
),
(
  'restaurante', 'daily', 'tpl-rest-daily', 'Restaurante · Menú al Día',
  '{"preset":"fonda_calida","colors":{"primary":"#c45c26","bg":"#faf6f1","card":"#ffffff","text":"#1c1410"},"font":"display_bebas","photoFrame":"rounded_modern"}'::jsonb,
  '{"categories":[],"dishes":[],"daily_menu":null}'::jsonb, true
),
(
  'restaurante', 'pro', 'tpl-rest-pro', 'Restaurante · Pro',
  '{"preset":"moderno_verde","colors":{"primary":"#2f6b4f","bg":"#f4f7f5","card":"#ffffff","text":"#14201a"},"font":"sans_clean","photoFrame":"floating_shadow"}'::jsonb,
  '{"categories":[],"dishes":[],"daily_menu":null}'::jsonb, true
),
(
  'servicios', 'catalog', 'tpl-serv-catalog', 'Servicios · Catálogo',
  '{"preset":"estetica_suave","colors":{"primary":"#8b5a6b","bg":"#faf7f8","card":"#ffffff","text":"#2a1f24"},"font":"display_bebas","photoFrame":"circle_avatar"}'::jsonb,
  '{"categories":[],"dishes":[],"daily_menu":null}'::jsonb, true
),
(
  'servicios', 'daily', 'tpl-serv-daily', 'Servicios · Promoción',
  '{"preset":"estetica_suave","colors":{"primary":"#8b5a6b","bg":"#faf7f8","card":"#ffffff","text":"#2a1f24"},"font":"display_bebas","photoFrame":"circle_avatar"}'::jsonb,
  '{"categories":[],"dishes":[],"daily_menu":null}'::jsonb, true
),
(
  'servicios', 'pro', 'tpl-serv-pro', 'Servicios · Pro',
  '{"preset":"estetica_suave","colors":{"primary":"#8b5a6b","bg":"#faf7f8","card":"#ffffff","text":"#2a1f24"},"font":"display_bebas","photoFrame":"circle_avatar"}'::jsonb,
  '{"categories":[],"dishes":[],"daily_menu":null}'::jsonb, true
),
(
  'productos', 'catalog', 'tpl-prod-catalog', 'Productos · Catálogo',
  '{"preset":"moderno_verde","colors":{"primary":"#2f6b4f","bg":"#f4f7f5","card":"#ffffff","text":"#14201a"},"font":"sans_clean","photoFrame":"rounded_modern"}'::jsonb,
  '{"categories":[],"dishes":[],"daily_menu":null}'::jsonb, true
),
(
  'productos', 'daily', 'tpl-prod-daily', 'Productos · Oferta',
  '{"preset":"moderno_verde","colors":{"primary":"#2f6b4f","bg":"#f4f7f5","card":"#ffffff","text":"#14201a"},"font":"sans_clean","photoFrame":"rounded_modern"}'::jsonb,
  '{"categories":[],"dishes":[],"daily_menu":null}'::jsonb, true
),
(
  'productos', 'pro', 'tpl-prod-pro', 'Productos · Pro',
  '{"preset":"moderno_verde","colors":{"primary":"#2f6b4f","bg":"#f4f7f5","card":"#ffffff","text":"#14201a"},"font":"sans_clean","photoFrame":"floating_shadow"}'::jsonb,
  '{"categories":[],"dishes":[],"daily_menu":null}'::jsonb, true
);

-- ---------------------------------------------------------------------------
-- 4) DEMO RESTAURANTE — /demo-restaurante (plan daily)
-- ---------------------------------------------------------------------------

insert into public.restaurants (
  id, slug, name, slogan, phone_whatsapp, address, maps_url, city, state,
  schedule_text, shipping_cost, free_shipping, plan_type, is_active,
  subscription_end_date, theme_config, business_type, owner_name
) values (
  'a0000000-0000-4000-8000-000000000001',
  'demo-restaurante',
  'Cocina Doña Lupita',
  'Sabor casero del barrio',
  '5215512345678',
  'Calle Morelos 123, Centro',
  'https://maps.google.com/?q=Calle+Morelos+123+Monterrey',
  'Monterrey',
  'Nuevo León',
  'Lun–Sáb 12:00–17:00',
  0,
  true,
  'daily',
  true,
  now() + interval '365 days',
  '{
    "preset": "fonda_calida",
    "colors": {"primary":"#c45c26","bg":"#faf6f1","card":"#ffffff","text":"#1c1410"},
    "font": "display_bebas",
    "photoFrame": "rounded_modern",
    "bannerUrl": null,
    "backgroundImageUrl": null,
    "useBackgroundImage": false
  }'::jsonb,
  'restaurante',
  'Lupita Hernández'
);

insert into public.categories (id, restaurant_id, name, sort_order, is_fixed_catalog) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Menú del Día', 0, false),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Guarniciones', 1, false),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Entradas', 2, true),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Bebidas', 3, true),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'Postres', 4, true);

insert into public.dishes (
  id, restaurant_id, category_id, name, description, price, is_side, is_active, sort_order, archived_at
) values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'Milanesa de res', 'Empanizada, incluye 2 guarniciones del día', 100, false, true, 1, null),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'Pollo en mole', 'Mole casero con tortillas', 100, false, true, 2, null),
  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'Tinga de pollo', 'Con tostadas o arroz', 100, false, true, 3, null),
  ('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002',
   'Arroz rojo', '', 0, true, true, 1, null),
  ('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002',
   'Frijoles refritos', '', 0, true, true, 2, null),
  ('c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002',
   'Ensalada fresca', '', 0, true, true, 3, null),
  ('c0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003',
   'Sopa del día', 'Consumo o crema', 35, false, true, 1, null),
  ('c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004',
   'Agua de sabor', '1 Litro', 25, false, true, 1, null),
  ('c0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004',
   'Refresco', 'Lata 355 ml', 20, false, true, 2, null),
  ('c0000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000005',
   'Flan napolitano', '', 30, false, true, 1, null);

-- Addons por platillo (modelo nuevo)
insert into public.dish_addons (id, dish_id, name, price_delta, sort_order, is_active) values
  ('aa000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Extra queso', 15, 0, true),
  ('aa000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Aguacate', 20, 1, true),
  ('aa000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'Tortillas extras', 10, 0, true),
  ('aa000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000009', 'Vaso con hielo', 0, 0, true);

insert into public.daily_menu_selections (id, restaurant_id, package_price, max_sides, menu_date)
values (
  'd0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  100, 2,
  (timezone('America/Mexico_City', now()))::date
);

insert into public.daily_menu_dishes (daily_menu_id, dish_id) values
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002');

insert into public.daily_menu_sides (daily_menu_id, dish_id) values
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000005'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000006');

-- Combo Express → /demo-restaurante?c=combo-familiar
insert into public.combos (
  id, restaurant_id, slug, title, description, photo_url, fixed_price, is_active, sort_order
) values (
  'cb000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'combo-familiar',
  'Combo Familiar',
  'Milanesa + agua de sabor a precio especial. Ideal para difundir por WhatsApp.',
  null,
  115,
  true,
  0
);

insert into public.combo_items (combo_id, dish_id, quantity, sort_order) values
  ('cb000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 1, 0),
  ('cb000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000009', 1, 1);

-- ---------------------------------------------------------------------------
-- 5) DEMO SERVICIOS — /demo-estetica (plan catalog)
-- ---------------------------------------------------------------------------

insert into public.restaurants (
  id, slug, name, slogan, phone_whatsapp, address, maps_url, city, state,
  schedule_text, shipping_cost, free_shipping, plan_type, is_active,
  subscription_end_date, theme_config, business_type, owner_name
) values (
  'a0000000-0000-4000-8000-000000000002',
  'demo-estetica',
  'Estética Bella Luna',
  'Belleza y cuidado personal',
  '5215512345679',
  'Av. Reforma 45, Centro',
  'https://maps.google.com/?q=Av+Reforma+45+Monterrey',
  'San Pedro',
  'Nuevo León',
  'Mar–Sáb 10:00–19:00',
  0,
  true,
  'catalog',
  true,
  now() + interval '365 days',
  '{
    "preset": "estetica_suave",
    "colors": {"primary":"#8b5a6b","bg":"#faf7f8","card":"#ffffff","text":"#2a1f24"},
    "font": "display_bebas",
    "photoFrame": "circle_avatar",
    "bannerUrl": null,
    "backgroundImageUrl": null,
    "useBackgroundImage": false
  }'::jsonb,
  'servicios',
  'Luna Méndez'
);

insert into public.categories (id, restaurant_id, name, sort_order, is_fixed_catalog) values
  ('b0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000002', 'Cabello', 0, true),
  ('b0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000002', 'Uñas', 1, true),
  ('b0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000002', 'Paquetes', 2, true);

insert into public.dishes (
  id, restaurant_id, category_id, name, description, price, is_side, is_active, sort_order
) values
  ('c0000000-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000011',
   'Corte de cabello', 'Incluye lavado', 180, false, true, 1),
  ('c0000000-0000-4000-8000-000000000022', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000011',
   'Tinte completo', 'Marcas profesionales', 450, false, true, 2),
  ('c0000000-0000-4000-8000-000000000023', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000012',
   'Manicure', 'Gel o tradicional', 150, false, true, 1),
  ('c0000000-0000-4000-8000-000000000024', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000012',
   'Pedicure spa', 'Con exfoliación', 220, false, true, 2),
  ('c0000000-0000-4000-8000-000000000025', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000013',
   'Día de spa', 'Facial + manicure', 450, false, true, 1);

insert into public.dish_addons (id, dish_id, name, price_delta, sort_order, is_active) values
  ('aa000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000021', 'Tratamiento keratina express', 80, 0, true),
  ('aa000000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000023', 'Diseño en uñas', 40, 0, true);

-- ---------------------------------------------------------------------------
-- 6) DEMO PRODUCTOS — /demo-productos (plan daily + colección)
-- ---------------------------------------------------------------------------

insert into public.restaurants (
  id, slug, name, slogan, phone_whatsapp, address, maps_url, city, state,
  schedule_text, shipping_cost, free_shipping, plan_type, is_active,
  subscription_end_date, theme_config, business_type, owner_name
) values (
  'a0000000-0000-4000-8000-000000000005',
  'demo-productos',
  'Abarrotes Don Pepe',
  'Todo para tu casa',
  '5218187654321',
  'Calle Hidalgo 50',
  'https://maps.google.com/?q=Calle+Hidalgo+50+Guadalupe',
  'Guadalupe',
  'Nuevo León',
  'Lun–Dom 8:00–21:00',
  35,
  false,
  'daily',
  true,
  now() + interval '365 days',
  '{
    "preset": "moderno_verde",
    "colors": {"primary":"#2f6b4f","bg":"#f4f7f5","card":"#ffffff","text":"#14201a"},
    "font": "sans_clean",
    "photoFrame": "rounded_modern",
    "bannerUrl": null,
    "backgroundImageUrl": null,
    "useBackgroundImage": false
  }'::jsonb,
  'productos',
  'José Pérez'
);

insert into public.categories (id, restaurant_id, name, sort_order, is_fixed_catalog) values
  ('b0000000-0000-4000-8000-000000000051', 'a0000000-0000-4000-8000-000000000005', 'Oferta del Día', 0, false),
  ('b0000000-0000-4000-8000-000000000052', 'a0000000-0000-4000-8000-000000000005', 'Abarrotes', 1, true),
  ('b0000000-0000-4000-8000-000000000053', 'a0000000-0000-4000-8000-000000000005', 'Limpieza', 2, true),
  ('b0000000-0000-4000-8000-000000000054', 'a0000000-0000-4000-8000-000000000005', 'Bebidas', 3, true);

insert into public.dishes (
  id, restaurant_id, category_id, name, description, price, is_side, is_active, sort_order
) values
  ('c0000000-0000-4000-8000-000000000051', 'a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000051',
   'Huevo blanco (kg)', 'Oferta del día', 42, false, true, 1),
  ('c0000000-0000-4000-8000-000000000052', 'a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000052',
   'Aceite 1L', 'Vegetal', 48, false, true, 1),
  ('c0000000-0000-4000-8000-000000000053', 'a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000052',
   'Arroz 1kg', 'Grano largo', 28, false, true, 2),
  ('c0000000-0000-4000-8000-000000000054', 'a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000053',
   'Jabón líquido', '1 L', 35, false, true, 1),
  ('c0000000-0000-4000-8000-000000000055', 'a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000054',
   'Refresco 2L', '', 32, false, true, 1);

insert into public.dish_addons (id, dish_id, name, price_delta, sort_order, is_active) values
  ('aa000000-0000-4000-8000-000000000051', 'c0000000-0000-4000-8000-000000000052', 'Bolsa reutilizable', 5, 0, true);

insert into public.daily_menu_selections (id, restaurant_id, package_price, max_sides, menu_date)
values (
  'd0000000-0000-4000-8000-000000000005',
  'a0000000-0000-4000-8000-000000000005',
  65, 0,
  (timezone('America/Mexico_City', now()))::date
);

insert into public.daily_menu_dishes (daily_menu_id, dish_id) values
  ('d0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000051'),
  ('d0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000053');

insert into public.combos (
  id, restaurant_id, slug, title, description, fixed_price, is_active, sort_order
) values (
  'cb000000-0000-4000-8000-000000000005',
  'a0000000-0000-4000-8000-000000000005',
  'despensa-basica',
  'Despensa básica',
  'Aceite + arroz + refresco. Link viral para Status.',
  95,
  true,
  0
);

insert into public.combo_items (combo_id, dish_id, quantity, sort_order) values
  ('cb000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000052', 1, 0),
  ('cb000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000053', 1, 1),
  ('cb000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000055', 1, 2);

-- ---------------------------------------------------------------------------
-- 7) DEMO PRO — /demo-pro (CRM)
-- ---------------------------------------------------------------------------

insert into public.restaurants (
  id, slug, name, slogan, phone_whatsapp, address, maps_url, city, state,
  schedule_text, shipping_cost, free_shipping, plan_type, is_active,
  subscription_end_date, theme_config, business_type, owner_name
) values (
  'a0000000-0000-4000-8000-000000000003',
  'demo-pro',
  'Taquería El Güero Pro',
  'Tacos al pastor y CRM',
  '5215587654321',
  'Calle Juárez 88, Centro',
  'https://maps.google.com/?q=Calle+Juarez+88+Monterrey',
  'Monterrey',
  'Nuevo León',
  'Lun–Dom 13:00–23:00',
  25,
  false,
  'pro',
  true,
  now() + interval '365 days',
  '{
    "preset": "moderno_verde",
    "colors": {"primary":"#2f6b4f","bg":"#f4f7f5","card":"#ffffff","text":"#14201a"},
    "font": "sans_clean",
    "photoFrame": "floating_shadow",
    "bannerUrl": null,
    "backgroundImageUrl": null,
    "useBackgroundImage": false
  }'::jsonb,
  'restaurante',
  'Güero Ramírez'
);

insert into public.categories (id, restaurant_id, name, sort_order, is_fixed_catalog) values
  ('b0000000-0000-4000-8000-000000000031', 'a0000000-0000-4000-8000-000000000003', 'Menú del Día', 0, false),
  ('b0000000-0000-4000-8000-000000000032', 'a0000000-0000-4000-8000-000000000003', 'Guarniciones', 1, false),
  ('b0000000-0000-4000-8000-000000000033', 'a0000000-0000-4000-8000-000000000003', 'Tacos', 2, true),
  ('b0000000-0000-4000-8000-000000000034', 'a0000000-0000-4000-8000-000000000003', 'Bebidas', 3, true);

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
   'Agua de horchata', '1 L', 30, false, true, 1);

insert into public.dish_addons (id, dish_id, name, price_delta, sort_order, is_active) values
  ('aa000000-0000-4000-8000-000000000031', 'c0000000-0000-4000-8000-000000000035', 'Con queso', 15, 0, true),
  ('aa000000-0000-4000-8000-000000000032', 'c0000000-0000-4000-8000-000000000035', 'Doble carne', 25, 1, true);

insert into public.daily_menu_selections (id, restaurant_id, package_price, max_sides, menu_date)
values (
  'd0000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-000000000003',
  95, 2,
  (timezone('America/Mexico_City', now()))::date
);

insert into public.daily_menu_dishes (daily_menu_id, dish_id) values
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000031'),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000032');

insert into public.daily_menu_sides (daily_menu_id, dish_id) values
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000033'),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000034');

insert into public.combos (
  id, restaurant_id, slug, title, description, fixed_price, is_active, sort_order
) values (
  'cb000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-000000000003',
  'combo-pastor',
  'Combo Pastor + Horchata',
  'Orden pastor y agua. Perfecto para Status.',
  105,
  true,
  0
);

insert into public.combo_items (combo_id, dish_id, quantity, sort_order) values
  ('cb000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000035', 1, 0),
  ('cb000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000037', 1, 1);

-- CRM
insert into public.customers (
  id, restaurant_id, name, phone, address, orders_count, last_order_at, created_at
) values
(
  'ca000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000003',
  'Carlos Ruiz', '5511112233', 'Av. Juárez 20 Depto 3',
  2, now() - interval '1 day', now() - interval '14 days'
),
(
  'ca000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000003',
  'Ana López', '5522223344', 'Col. Centro, Calle 5 #12',
  1, now() - interval '3 hours', now() - interval '3 hours'
);

insert into public.orders (
  id, restaurant_id, customer_id, payload, total, status, created_at
) values
(
  'f0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000003',
  'ca000000-0000-4000-8000-000000000001',
  '{"customer_name":"Carlos Ruiz","phone":"5511112233","address":"Av. Juárez 20 Depto 3","payment_method":"transfer","items":[{"name":"Orden pastor (5)","quantity":2,"unitPrice":85},{"name":"Agua de horchata","quantity":1,"unitPrice":30}],"subtotal":200,"shipping":25,"total":225}'::jsonb,
  225, 'submitted', now() - interval '1 day'
),
(
  'f0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000003',
  'ca000000-0000-4000-8000-000000000002',
  '{"customer_name":"Ana López","phone":"5522223344","address":"Col. Centro","payment_method":"cash","cash_amount":500,"items":[{"name":"Menú: Pastor del día","quantity":2,"unitPrice":95,"addons":[{"name":"Con queso","priceDelta":15}]}],"subtotal":220,"shipping":25,"total":245}'::jsonb,
  245, 'submitted', now() - interval '3 hours'
);

insert into public.order_logs (id, restaurant_id, payload, created_at) values
(
  'e0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  '{"customer_name":"María Pérez","address":"Calle Morelos 10","payment_method":"cash","cash_amount":200,"items":[{"name":"Milanesa de res","quantity":1,"unitPrice":100,"addons":[{"name":"Extra queso","priceDelta":15}]}],"subtotal":115,"shipping":0,"total":115}'::jsonb,
  now() - interval '2 hours'
),
(
  'e0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000003',
  '{"customer_name":"Carlos Ruiz","phone":"5511112233","address":"Av. Juárez 20","payment_method":"transfer","items":[{"name":"Orden pastor (5)","quantity":2,"unitPrice":85}],"subtotal":170,"shipping":25,"total":195}'::jsonb,
  now() - interval '1 day'
);

insert into public.tenant_payments (
  id, restaurant_id, amount, currency, paid_at, method, plan_type, period_days, reference, notes
) values (
  'ab000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000003',
  599, 'MXN', now() - interval '20 days', 'transfer', 'pro', 30,
  'SPEI-DEMO-001', 'Pago demo Pro'
);

-- ---------------------------------------------------------------------------
-- 8) DEMO VENCIDO — /demo-vencido (no público)
-- ---------------------------------------------------------------------------

insert into public.restaurants (
  id, slug, name, slogan, phone_whatsapp, address, city, state,
  schedule_text, shipping_cost, free_shipping, plan_type, is_active,
  subscription_end_date, theme_config, business_type, owner_name
) values (
  'a0000000-0000-4000-8000-000000000004',
  'demo-vencido',
  'Negocio Suspendido',
  'No debería verse en público',
  '5215500000000',
  'Calle Cerrada 1',
  'Monterrey',
  'Nuevo León',
  'Cerrado',
  0, true, 'daily', false,
  now() - interval '7 days',
  '{"preset":"fonda_calida","colors":{"primary":"#c45c26","bg":"#faf6f1","card":"#ffffff","text":"#1c1410"},"font":"display_bebas","photoFrame":"rounded_modern"}'::jsonb,
  'restaurante',
  'Suspendido'
);

insert into public.categories (id, restaurant_id, name, sort_order, is_fixed_catalog) values
  ('b0000000-0000-4000-8000-000000000041', 'a0000000-0000-4000-8000-000000000004', 'Oculto', 0, true);

insert into public.dishes (id, restaurant_id, category_id, name, description, price, is_side, is_active, sort_order)
values (
  'c0000000-0000-4000-8000-000000000041',
  'a0000000-0000-4000-8000-000000000004',
  'b0000000-0000-4000-8000-000000000041',
  'Platillo oculto', 'No visible en público', 50, false, true, 1
);

-- ---------------------------------------------------------------------------
-- 9) Members: super_admin + owners de demos
-- ---------------------------------------------------------------------------

-- Super admin → anclado a demo-restaurante (entrada a /super-admin)
insert into public.restaurant_members (user_id, restaurant_id, role)
select sa.user_id, 'a0000000-0000-4000-8000-000000000001'::uuid, 'super_admin'
from public._seed_super_admins sa
on conflict (user_id, restaurant_id) do update set role = 'super_admin';

-- Owner en demos principales (mismo usuario local, si existe)
insert into public.restaurant_members (user_id, restaurant_id, role)
select 'f230e363-82a5-4ee6-acc8-a58272986d60'::uuid, r.id, 'owner'
from (values
  ('a0000000-0000-4000-8000-000000000002'::uuid),
  ('a0000000-0000-4000-8000-000000000003'::uuid),
  ('a0000000-0000-4000-8000-000000000005'::uuid)
) as r(id)
where exists (
  select 1 from auth.users u where u.id = 'f230e363-82a5-4ee6-acc8-a58272986d60'
)
on conflict (user_id, restaurant_id) do update set role = excluded.role;

drop table if exists public._seed_super_admins;
-- =============================================================================
-- Checklist:
--   /demo-restaurante?c=combo-familiar
--   /demo-restaurante?p=c0000000-0000-4000-8000-000000000001
--   /demo-estetica
--   /demo-productos?c=despensa-basica
--   /demo-pro  (+ admin CRM)
--   /demo-vencido → 404 público
--   /super-admin → CMS + tenants
-- =============================================================================
