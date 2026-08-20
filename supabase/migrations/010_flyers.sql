-- Flyers library + usage events + storage bucket

create table if not exists public.flyers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  title text not null default '',
  subtitle text not null default '',
  headline text not null default '',
  weekday_label text not null default '',
  aspect text not null default 'feed_4_5',
  price_mode text not null default 'package'
    check (price_mode in ('package', 'per_item')),
  package_price numeric(10, 2),
  options_json jsonb not null default '{}'::jsonb,
  items_json jsonb not null default '[]'::jsonb,
  png_path text,
  created_at timestamptz not null default now()
);

create index if not exists flyers_restaurant_id_idx
  on public.flyers (restaurant_id, created_at desc);

alter table public.flyers enable row level security;

drop policy if exists "flyers_member_all" on public.flyers;
create policy "flyers_member_all"
  on public.flyers for all
  to authenticated
  using (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  )
  with check (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  );

drop policy if exists "flyers_public_select" on public.flyers;
-- No public read of flyer rows (PNG via storage public URL if needed)

create or replace function public.enforce_flyer_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_limit int := 20;
begin
  select count(*) into v_count
  from public.flyers
  where restaurant_id = new.restaurant_id;

  if v_count >= v_limit then
    raise exception 'Límite de % flyers alcanzado. Elimina uno de la biblioteca.', v_limit;
  end if;
  return new;
end;
$$;

drop trigger if exists flyers_quota_before_insert on public.flyers;
create trigger flyers_quota_before_insert
  before insert on public.flyers
  for each row
  execute function public.enforce_flyer_quota();

create table if not exists public.flyer_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  action text not null check (action in ('download', 'share', 'copy', 'save')),
  created_at timestamptz not null default now()
);

create index if not exists flyer_events_restaurant_id_idx
  on public.flyer_events (restaurant_id, created_at desc);

alter table public.flyer_events enable row level security;

drop policy if exists "flyer_events_member_insert" on public.flyer_events;
create policy "flyer_events_member_insert"
  on public.flyer_events for insert
  to authenticated
  with check (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  );

drop policy if exists "flyer_events_member_select" on public.flyer_events;
create policy "flyer_events_member_select"
  on public.flyer_events for select
  to authenticated
  using (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  );

-- Storage: reuse dish-photos under {restaurant_id}/flyers/...
-- (first path segment must be restaurant UUID for storage RLS).
