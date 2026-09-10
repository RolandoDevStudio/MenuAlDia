-- Single RPC: increment daily + hourly menu view counters (Mexico City)

create or replace function public.increment_menu_view_hit(p_restaurant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ts timestamptz;
  v_day date;
  v_hour smallint;
begin
  if p_restaurant_id is null then
    return;
  end if;
  if not exists (
    select 1 from public.restaurants r
    where r.id = p_restaurant_id and r.is_active is not false
  ) then
    return;
  end if;

  v_ts := timezone('America/Mexico_City', now());
  v_day := v_ts::date;
  v_hour := extract(hour from v_ts)::smallint;

  insert into public.menu_view_days (restaurant_id, view_date, views)
  values (p_restaurant_id, v_day, 1)
  on conflict (restaurant_id, view_date)
  do update set views = public.menu_view_days.views + 1;

  insert into public.menu_view_hours (restaurant_id, view_date, hour, views)
  values (p_restaurant_id, v_day, v_hour, 1)
  on conflict (restaurant_id, view_date, hour)
  do update set views = public.menu_view_hours.views + 1;
end;
$$;

revoke all on function public.increment_menu_view_hit(uuid) from public;
grant execute on function public.increment_menu_view_hit(uuid) to anon, authenticated;
