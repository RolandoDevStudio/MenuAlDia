-- Daily menu pageview counters (Mexico City calendar days)

create table if not exists public.menu_view_days (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  view_date date not null,
  views int not null default 0 check (views >= 0),
  primary key (restaurant_id, view_date)
);

create index if not exists menu_view_days_restaurant_idx
  on public.menu_view_days (restaurant_id);

alter table public.menu_view_days enable row level security;

drop policy if exists "menu_view_days_member_select" on public.menu_view_days;
create policy "menu_view_days_member_select"
  on public.menu_view_days for select
  to authenticated
  using (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  );

-- Increment today's view (America/Mexico_City) — callable by anon via API service role or RPC
create or replace function public.increment_menu_view(p_restaurant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
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

  v_day := (timezone('America/Mexico_City', now()))::date;

  insert into public.menu_view_days (restaurant_id, view_date, views)
  values (p_restaurant_id, v_day, 1)
  on conflict (restaurant_id, view_date)
  do update set views = public.menu_view_days.views + 1;
end;
$$;

revoke all on function public.increment_menu_view(uuid) from public;
grant execute on function public.increment_menu_view(uuid) to anon, authenticated;
