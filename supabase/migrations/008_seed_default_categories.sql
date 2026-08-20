-- Default category seeds when a tenant has none (onboarding).
-- Called after clone/template apply; no-op if categories already exist.

create or replace function public.seed_default_categories(p_restaurant_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bt text;
  v_count int;
  v_inserted int := 0;
begin
  select business_type into v_bt
  from public.restaurants
  where id = p_restaurant_id;

  if v_bt is null then
    raise exception 'restaurant not found';
  end if;

  -- Legacy aliases
  if v_bt = 'estetica' then v_bt := 'servicios'; end if;
  if v_bt = 'tienda' then v_bt := 'productos'; end if;
  if v_bt not in ('restaurante', 'servicios', 'productos') then
    v_bt := 'restaurante';
  end if;

  select count(*) into v_count
  from public.categories
  where restaurant_id = p_restaurant_id;

  if v_count > 0 then
    return 0;
  end if;

  if v_bt = 'productos' then
    insert into public.categories (restaurant_id, name, sort_order, is_fixed_catalog)
    values
      (p_restaurant_id, 'Novedades', 0, true),
      (p_restaurant_id, 'Más Vendidos', 1, true),
      (p_restaurant_id, 'General', 2, true);
    get diagnostics v_inserted = row_count;
  elsif v_bt = 'servicios' then
    insert into public.categories (restaurant_id, name, sort_order, is_fixed_catalog)
    values
      (p_restaurant_id, 'Servicios', 0, true),
      (p_restaurant_id, 'Paquetes', 1, true),
      (p_restaurant_id, 'Adicionales', 2, true);
    get diagnostics v_inserted = row_count;
  else
    insert into public.categories (restaurant_id, name, sort_order, is_fixed_catalog)
    values
      (p_restaurant_id, 'Entradas', 0, true),
      (p_restaurant_id, 'Platillos Fuertes', 1, true),
      (p_restaurant_id, 'Bebidas', 2, true),
      (p_restaurant_id, 'Guarniciones', 3, false);
    get diagnostics v_inserted = row_count;
  end if;

  return v_inserted;
end;
$$;

revoke all on function public.seed_default_categories(uuid) from public;
grant execute on function public.seed_default_categories(uuid) to service_role;
grant execute on function public.seed_default_categories(uuid) to authenticated;
