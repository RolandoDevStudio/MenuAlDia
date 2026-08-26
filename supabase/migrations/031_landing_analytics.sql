-- Platform landing analytics (marketing site `/`, not tenant menus)
-- Calendar days: America/Mexico_City

create table if not exists public.platform_landing_view_days (
  view_date date primary key,
  views int not null default 0 check (views >= 0)
);

alter table public.platform_landing_view_days enable row level security;

drop policy if exists "platform_landing_view_days_sa_select" on public.platform_landing_view_days;
create policy "platform_landing_view_days_sa_select"
  on public.platform_landing_view_days for select
  to authenticated
  using (public.is_super_admin());

create table if not exists public.platform_landing_event_days (
  view_date date not null,
  event_key text not null,
  count int not null default 0 check (count >= 0),
  primary key (view_date, event_key)
);

create index if not exists platform_landing_event_days_key_idx
  on public.platform_landing_event_days (event_key, view_date);

alter table public.platform_landing_event_days enable row level security;

drop policy if exists "platform_landing_event_days_sa_select" on public.platform_landing_event_days;
create policy "platform_landing_event_days_sa_select"
  on public.platform_landing_event_days for select
  to authenticated
  using (public.is_super_admin());

create or replace function public.increment_landing_view()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
begin
  v_day := (timezone('America/Mexico_City', now()))::date;

  insert into public.platform_landing_view_days (view_date, views)
  values (v_day, 1)
  on conflict (view_date)
  do update set views = public.platform_landing_view_days.views + 1;
end;
$$;

revoke all on function public.increment_landing_view() from public;
grant execute on function public.increment_landing_view() to anon, authenticated;

create or replace function public.increment_landing_event(p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
begin
  if p_key not in (
    'wa_nav',
    'wa_breath',
    'wa_form',
    'wa_fab',
    'wa_plan_catalog',
    'wa_plan_daily',
    'wa_plan_pro',
    'demo_open'
  ) then
    return;
  end if;

  v_day := (timezone('America/Mexico_City', now()))::date;

  insert into public.platform_landing_event_days (view_date, event_key, count)
  values (v_day, p_key, 1)
  on conflict (view_date, event_key)
  do update set count = public.platform_landing_event_days.count + 1;
end;
$$;

revoke all on function public.increment_landing_event(text) from public;
grant execute on function public.increment_landing_event(text) to anon, authenticated;
