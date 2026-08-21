-- Analytics instrumentation: hours, WA clicks, dish engage, flyer landings

-- 1a. Hourly menu views
create table if not exists public.menu_view_hours (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  view_date date not null,
  hour smallint not null check (hour >= 0 and hour <= 23),
  views int not null default 0 check (views >= 0),
  primary key (restaurant_id, view_date, hour)
);

alter table public.menu_view_hours enable row level security;

drop policy if exists "menu_view_hours_member_select" on public.menu_view_hours;
create policy "menu_view_hours_member_select"
  on public.menu_view_hours for select
  to authenticated
  using (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  );

create or replace function public.increment_menu_view_hour(p_restaurant_id uuid)
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
  if p_restaurant_id is null then return; end if;
  if not exists (
    select 1 from public.restaurants r
    where r.id = p_restaurant_id and r.is_active is not false
  ) then return; end if;

  v_ts := timezone('America/Mexico_City', now());
  v_day := v_ts::date;
  v_hour := extract(hour from v_ts)::smallint;

  insert into public.menu_view_hours (restaurant_id, view_date, hour, views)
  values (p_restaurant_id, v_day, v_hour, 1)
  on conflict (restaurant_id, view_date, hour)
  do update set views = public.menu_view_hours.views + 1;
end;
$$;

revoke all on function public.increment_menu_view_hour(uuid) from public;
grant execute on function public.increment_menu_view_hour(uuid) to anon, authenticated;

-- 1b. WhatsApp click days
create table if not exists public.wa_click_days (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  view_date date not null,
  clicks int not null default 0 check (clicks >= 0),
  primary key (restaurant_id, view_date)
);

alter table public.wa_click_days enable row level security;

drop policy if exists "wa_click_days_member_select" on public.wa_click_days;
create policy "wa_click_days_member_select"
  on public.wa_click_days for select
  to authenticated
  using (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  );

create or replace function public.increment_wa_click(p_restaurant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
begin
  if p_restaurant_id is null then return; end if;
  if not exists (
    select 1 from public.restaurants r
    where r.id = p_restaurant_id and r.is_active is not false
  ) then return; end if;

  v_day := (timezone('America/Mexico_City', now()))::date;

  insert into public.wa_click_days (restaurant_id, view_date, clicks)
  values (p_restaurant_id, v_day, 1)
  on conflict (restaurant_id, view_date)
  do update set clicks = public.wa_click_days.clicks + 1;
end;
$$;

revoke all on function public.increment_wa_click(uuid) from public;
grant execute on function public.increment_wa_click(uuid) to anon, authenticated;

-- 1c. Dish engagement
create table if not exists public.dish_engagement_days (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  dish_id uuid not null references public.dishes (id) on delete cascade,
  view_date date not null,
  opens int not null default 0 check (opens >= 0),
  adds int not null default 0 check (adds >= 0),
  primary key (restaurant_id, dish_id, view_date)
);

create index if not exists dish_engagement_days_restaurant_date_idx
  on public.dish_engagement_days (restaurant_id, view_date);

alter table public.dish_engagement_days enable row level security;

drop policy if exists "dish_engagement_days_member_select" on public.dish_engagement_days;
create policy "dish_engagement_days_member_select"
  on public.dish_engagement_days for select
  to authenticated
  using (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  );

create or replace function public.increment_dish_engage(
  p_restaurant_id uuid,
  p_dish_id uuid,
  p_kind text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
begin
  if p_restaurant_id is null or p_dish_id is null then return; end if;
  if p_kind not in ('open', 'add') then return; end if;
  if not exists (
    select 1 from public.restaurants r
    where r.id = p_restaurant_id and r.is_active is not false
  ) then return; end if;

  v_day := (timezone('America/Mexico_City', now()))::date;

  insert into public.dish_engagement_days (restaurant_id, dish_id, view_date, opens, adds)
  values (
    p_restaurant_id,
    p_dish_id,
    v_day,
    case when p_kind = 'open' then 1 else 0 end,
    case when p_kind = 'add' then 1 else 0 end
  )
  on conflict (restaurant_id, dish_id, view_date)
  do update set
    opens = public.dish_engagement_days.opens
      + case when p_kind = 'open' then 1 else 0 end,
    adds = public.dish_engagement_days.adds
      + case when p_kind = 'add' then 1 else 0 end;
end;
$$;

revoke all on function public.increment_dish_engage(uuid, uuid, text) from public;
grant execute on function public.increment_dish_engage(uuid, uuid, text) to anon, authenticated;

-- 1d. Flyer landings + flyer_id on events
alter table public.flyer_events
  add column if not exists flyer_id uuid references public.flyers (id) on delete set null;

create table if not exists public.flyer_landing_days (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  flyer_id uuid not null references public.flyers (id) on delete cascade,
  view_date date not null,
  landings int not null default 0 check (landings >= 0),
  primary key (restaurant_id, flyer_id, view_date)
);

alter table public.flyer_landing_days enable row level security;

drop policy if exists "flyer_landing_days_member_select" on public.flyer_landing_days;
create policy "flyer_landing_days_member_select"
  on public.flyer_landing_days for select
  to authenticated
  using (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  );

create or replace function public.increment_flyer_landing(
  p_restaurant_id uuid,
  p_flyer_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
begin
  if p_restaurant_id is null or p_flyer_id is null then return; end if;
  if not exists (
    select 1 from public.flyers f
    where f.id = p_flyer_id
      and f.restaurant_id = p_restaurant_id
      and f.is_active = true
  ) then return; end if;

  v_day := (timezone('America/Mexico_City', now()))::date;

  insert into public.flyer_landing_days (restaurant_id, flyer_id, view_date, landings)
  values (p_restaurant_id, p_flyer_id, v_day, 1)
  on conflict (restaurant_id, flyer_id, view_date)
  do update set landings = public.flyer_landing_days.landings + 1;
end;
$$;

revoke all on function public.increment_flyer_landing(uuid, uuid) from public;
grant execute on function public.increment_flyer_landing(uuid, uuid) to anon, authenticated;
