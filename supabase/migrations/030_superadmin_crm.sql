-- Menú al Día — CRM superadmin: origen, sesiones de soporte, audit de catálogo
-- Run AFTER 029_founding_partner_notes.sql

-- ---------------------------------------------------------------------------
-- 1. Acquisition source
-- ---------------------------------------------------------------------------

alter table public.restaurants
  add column if not exists acquisition_source text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'restaurants_acquisition_source_check'
  ) then
    alter table public.restaurants
      add constraint restaurants_acquisition_source_check
      check (
        acquisition_source in ('', 'landing', 'dur_local', 'redes', 'boca_a_boca', 'otro')
      );
  end if;
end $$;

comment on column public.restaurants.acquisition_source is
  'How the tenant found Menu al Dia: landing | dur_local | redes | boca_a_boca | otro';

-- ---------------------------------------------------------------------------
-- 2. Catalog timestamps (inactivity / health)
-- ---------------------------------------------------------------------------

alter table public.dishes
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.categories
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists dishes_touch_updated_at on public.dishes;
create trigger dishes_touch_updated_at
before update on public.dishes
for each row execute function public.touch_row_updated_at();

drop trigger if exists categories_touch_updated_at on public.categories;
create trigger categories_touch_updated_at
before update on public.categories
for each row execute function public.touch_row_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Support access tokens
-- ---------------------------------------------------------------------------

create table if not exists public.support_access_tokens (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  session_expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists support_access_tokens_restaurant_idx
  on public.support_access_tokens (restaurant_id, session_expires_at desc);

alter table public.support_access_tokens enable row level security;

drop policy if exists "support_access_tokens_super_admin_all" on public.support_access_tokens;
create policy "support_access_tokens_super_admin_all"
  on public.support_access_tokens for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create or replace function public.support_session_active(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.support_access_tokens t
    where t.restaurant_id = p_restaurant_id
      and t.used_at is not null
      and t.session_expires_at is not null
      and t.session_expires_at > now()
  );
$$;

revoke all on function public.support_session_active(uuid) from public;
grant execute on function public.support_session_active(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Audit catalog writes during an active support session
-- ---------------------------------------------------------------------------

create or replace function public.audit_support_catalog_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  rec record;
  action_name text;
  label text;
  verb text;
begin
  rec := coalesce(new, old);

  if tg_table_name in ('dishes', 'categories') then
    rid := rec.restaurant_id;
    label := coalesce(rec.name, tg_table_name);
  elsif tg_table_name = 'combos' then
    rid := rec.restaurant_id;
    label := coalesce(rec.title, 'combo');
  elsif tg_table_name = 'combo_items' then
    select c.restaurant_id, c.title into rid, label
    from public.combos c
    where c.id = rec.combo_id;
  elsif tg_table_name = 'dish_addons' then
    select d.restaurant_id, d.name into rid, label
    from public.dishes d
    where d.id = rec.dish_id;
  elsif tg_table_name in ('daily_menu_dishes', 'daily_menu_sides') then
    select s.restaurant_id into rid
    from public.daily_menu_selections s
    where s.id = rec.daily_menu_id;
    label := 'menú del día';
  elsif tg_table_name = 'daily_menu_selections' then
    rid := rec.restaurant_id;
    label := 'menú del día';
  end if;

  if rid is null then
    return coalesce(new, old);
  end if;
  if not public.is_super_admin() then
    return coalesce(new, old);
  end if;
  if not public.support_session_active(rid) then
    return coalesce(new, old);
  end if;

  action_name := case tg_op
    when 'INSERT' then 'create'
    when 'DELETE' then 'delete'
    else 'update'
  end;
  verb := case tg_op
    when 'INSERT' then 'creó'
    when 'DELETE' then 'eliminó'
    else 'actualizó'
  end;

  insert into public.audit_logs (
    restaurant_id,
    actor_user_id,
    actor_label,
    action,
    field_name,
    summary
  ) values (
    rid,
    auth.uid(),
    'Soporte',
    action_name,
    tg_table_name,
    'Soporte ' || verb || ' ' || coalesce(label, tg_table_name)
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists dishes_audit_support on public.dishes;
create trigger dishes_audit_support
after insert or update or delete on public.dishes
for each row execute function public.audit_support_catalog_change();

drop trigger if exists categories_audit_support on public.categories;
create trigger categories_audit_support
after insert or update or delete on public.categories
for each row execute function public.audit_support_catalog_change();

drop trigger if exists combos_audit_support on public.combos;
create trigger combos_audit_support
after insert or update or delete on public.combos
for each row execute function public.audit_support_catalog_change();

drop trigger if exists combo_items_audit_support on public.combo_items;
create trigger combo_items_audit_support
after insert or update or delete on public.combo_items
for each row execute function public.audit_support_catalog_change();

drop trigger if exists dish_addons_audit_support on public.dish_addons;
create trigger dish_addons_audit_support
after insert or update or delete on public.dish_addons
for each row execute function public.audit_support_catalog_change();

drop trigger if exists daily_menu_dishes_audit_support on public.daily_menu_dishes;
create trigger daily_menu_dishes_audit_support
after insert or update or delete on public.daily_menu_dishes
for each row execute function public.audit_support_catalog_change();

drop trigger if exists daily_menu_sides_audit_support on public.daily_menu_sides;
create trigger daily_menu_sides_audit_support
after insert or update or delete on public.daily_menu_sides
for each row execute function public.audit_support_catalog_change();

drop trigger if exists daily_menu_selections_audit_support on public.daily_menu_selections;
create trigger daily_menu_selections_audit_support
after insert or update or delete on public.daily_menu_selections
for each row execute function public.audit_support_catalog_change();
