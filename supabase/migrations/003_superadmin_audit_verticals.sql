-- Menú al Día — giros, owner_name, tenant_payments, audit_logs, plan_templates
-- Run AFTER 002_saas_plans_theme_crm.sql

-- ---------------------------------------------------------------------------
-- 1. Extend restaurants
-- ---------------------------------------------------------------------------

alter table public.restaurants
  add column if not exists business_type text not null default 'restaurante',
  add column if not exists owner_name text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'restaurants_business_type_check'
  ) then
    alter table public.restaurants
      add constraint restaurants_business_type_check
      check (business_type in ('restaurante', 'estetica', 'tienda', 'servicios'));
  end if;
end $$;

update public.restaurants
set business_type = 'estetica'
where slug = 'demo-estetica';

update public.restaurants
set business_type = 'restaurante'
where slug in ('demo-fonda', 'demo-pro', 'demo-vencido')
   or coalesce(business_type, '') = '';

-- ---------------------------------------------------------------------------
-- 2. tenant_payments
-- ---------------------------------------------------------------------------

create table if not exists public.tenant_payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  amount numeric(12, 2) not null default 0,
  currency text not null default 'MXN',
  paid_at timestamptz not null default now(),
  method text not null default 'transfer'
    check (method in ('transfer', 'cash', 'card', 'other')),
  plan_type text not null default 'catalog'
    check (plan_type in ('catalog', 'daily', 'pro')),
  period_days int not null default 30,
  reference text not null default '',
  notes text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists tenant_payments_restaurant_id_idx
  on public.tenant_payments (restaurant_id);
create index if not exists tenant_payments_paid_at_idx
  on public.tenant_payments (paid_at desc);

alter table public.tenant_payments enable row level security;

drop policy if exists "tenant_payments_super_admin_all" on public.tenant_payments;
create policy "tenant_payments_super_admin_all"
  on public.tenant_payments for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "tenant_payments_member_select" on public.tenant_payments;
create policy "tenant_payments_member_select"
  on public.tenant_payments for select
  to authenticated
  using (public.is_restaurant_member(restaurant_id) or public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 3. audit_logs
-- ---------------------------------------------------------------------------

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_label text not null default '',
  action text not null default 'update',
  field_name text,
  old_value text,
  new_value text,
  summary text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_restaurant_id_idx
  on public.audit_logs (restaurant_id);
create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_super_admin_all" on public.audit_logs;
create policy "audit_logs_super_admin_all"
  on public.audit_logs for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "audit_logs_member_select" on public.audit_logs;
create policy "audit_logs_member_select"
  on public.audit_logs for select
  to authenticated
  using (public.is_restaurant_member(restaurant_id) or public.is_super_admin());

drop policy if exists "audit_logs_member_insert" on public.audit_logs;
create policy "audit_logs_member_insert"
  on public.audit_logs for insert
  to authenticated
  with check (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- 4. plan_templates
-- ---------------------------------------------------------------------------

create table if not exists public.plan_templates (
  id uuid primary key default gen_random_uuid(),
  business_type text not null
    check (business_type in ('restaurante', 'estetica', 'tienda', 'servicios')),
  plan_type text not null
    check (plan_type in ('catalog', 'daily', 'pro')),
  slug_key text not null unique,
  name text not null,
  theme_config jsonb not null default '{
    "preset": "fonda_calida",
    "colors": {
      "primary": "#c45c26",
      "bg": "#faf6f1",
      "card": "#ffffff",
      "text": "#1c1410"
    },
    "font": "display_bebas",
    "photoFrame": "rounded_modern"
  }'::jsonb,
  snapshot jsonb not null default '{"categories":[],"dishes":[],"daily_menu":null}'::jsonb,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (business_type, plan_type)
);

alter table public.plan_templates enable row level security;

drop policy if exists "plan_templates_super_admin_all" on public.plan_templates;
create policy "plan_templates_super_admin_all"
  on public.plan_templates for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "plan_templates_authenticated_select" on public.plan_templates;
create policy "plan_templates_authenticated_select"
  on public.plan_templates for select
  to authenticated
  using (is_active = true or public.is_super_admin());

insert into public.plan_templates (business_type, plan_type, slug_key, name, theme_config)
values
  ('restaurante', 'catalog', 'restaurante-catalog', 'Restaurante · Catálogo',
   '{"preset":"fonda_calida","colors":{"primary":"#c45c26","bg":"#faf6f1","card":"#ffffff","text":"#1c1410"},"font":"display_bebas","photoFrame":"rounded_modern"}'::jsonb),
  ('restaurante', 'daily', 'restaurante-daily', 'Restaurante · Menú al Día',
   '{"preset":"fonda_calida","colors":{"primary":"#c45c26","bg":"#faf6f1","card":"#ffffff","text":"#1c1410"},"font":"display_bebas","photoFrame":"rounded_modern"}'::jsonb),
  ('restaurante', 'pro', 'restaurante-pro', 'Restaurante · Pro',
   '{"preset":"moderno_verde","colors":{"primary":"#2f6b4f","bg":"#f4f7f5","card":"#ffffff","text":"#14201a"},"font":"sans_clean","photoFrame":"floating_shadow"}'::jsonb),
  ('estetica', 'catalog', 'estetica-catalog', 'Estética · Catálogo',
   '{"preset":"estetica_suave","colors":{"primary":"#8b5a6b","bg":"#faf7f8","card":"#ffffff","text":"#2a1f24"},"font":"display_bebas","photoFrame":"circle_avatar"}'::jsonb),
  ('estetica', 'daily', 'estetica-daily', 'Estética · Daily',
   '{"preset":"estetica_suave","colors":{"primary":"#8b5a6b","bg":"#faf7f8","card":"#ffffff","text":"#2a1f24"},"font":"display_bebas","photoFrame":"circle_avatar"}'::jsonb),
  ('estetica', 'pro', 'estetica-pro', 'Estética · Pro',
   '{"preset":"estetica_suave","colors":{"primary":"#8b5a6b","bg":"#faf7f8","card":"#ffffff","text":"#2a1f24"},"font":"display_bebas","photoFrame":"circle_avatar"}'::jsonb),
  ('tienda', 'catalog', 'tienda-catalog', 'Tienda · Catálogo',
   '{"preset":"moderno_verde","colors":{"primary":"#2f6b4f","bg":"#f4f7f5","card":"#ffffff","text":"#14201a"},"font":"sans_clean","photoFrame":"rounded_modern"}'::jsonb),
  ('tienda', 'daily', 'tienda-daily', 'Tienda · Daily',
   '{"preset":"moderno_verde","colors":{"primary":"#2f6b4f","bg":"#f4f7f5","card":"#ffffff","text":"#14201a"},"font":"sans_clean","photoFrame":"rounded_modern"}'::jsonb),
  ('tienda', 'pro', 'tienda-pro', 'Tienda · Pro',
   '{"preset":"moderno_verde","colors":{"primary":"#2f6b4f","bg":"#f4f7f5","card":"#ffffff","text":"#14201a"},"font":"sans_clean","photoFrame":"rounded_modern"}'::jsonb),
  ('servicios', 'catalog', 'servicios-catalog', 'Servicios · Catálogo',
   '{"preset":"rustico_cafe","colors":{"primary":"#6b3e26","bg":"#f3ebe3","card":"#fff8f0","text":"#1c1410"},"font":"display_bebas","photoFrame":"rustic_ring"}'::jsonb),
  ('servicios', 'daily', 'servicios-daily', 'Servicios · Daily',
   '{"preset":"rustico_cafe","colors":{"primary":"#6b3e26","bg":"#f3ebe3","card":"#fff8f0","text":"#1c1410"},"font":"display_bebas","photoFrame":"rustic_ring"}'::jsonb),
  ('servicios', 'pro', 'servicios-pro', 'Servicios · Pro',
   '{"preset":"rustico_cafe","colors":{"primary":"#6b3e26","bg":"#f3ebe3","card":"#fff8f0","text":"#1c1410"},"font":"display_bebas","photoFrame":"rustic_ring"}'::jsonb)
on conflict (slug_key) do nothing;
