-- Plan change requests + grace / purge schedule on restaurants

alter table public.restaurants
  add column if not exists grace_ends_at timestamptz,
  add column if not exists purge_scheduled_at timestamptz,
  add column if not exists purged_at timestamptz;

comment on column public.restaurants.grace_ends_at is
  'After cancel/expiry: tenant can export data until this date';
comment on column public.restaurants.purge_scheduled_at is
  'Scheduled hard-delete of tenant data/storage after grace';
comment on column public.restaurants.purged_at is
  'When data purge was executed (null = not purged)';

create table if not exists public.plan_change_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  requested_by uuid references auth.users (id) on delete set null,
  request_type text not null
    check (request_type in ('cancel', 'change_plan')),
  from_plan text not null default 'catalog',
  to_plan text,
  reason text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  acknowledged_consequences boolean not null default false,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  review_note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists plan_change_requests_restaurant_idx
  on public.plan_change_requests (restaurant_id, created_at desc);
create index if not exists plan_change_requests_status_idx
  on public.plan_change_requests (status, created_at desc);

alter table public.plan_change_requests enable row level security;

drop policy if exists "plan_change_requests_member_select" on public.plan_change_requests;
create policy "plan_change_requests_member_select"
  on public.plan_change_requests for select
  to authenticated
  using (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  );

drop policy if exists "plan_change_requests_member_insert" on public.plan_change_requests;
create policy "plan_change_requests_member_insert"
  on public.plan_change_requests for insert
  to authenticated
  with check (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  );

drop policy if exists "plan_change_requests_member_update" on public.plan_change_requests;
create policy "plan_change_requests_member_update"
  on public.plan_change_requests for update
  to authenticated
  using (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  )
  with check (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  );

drop policy if exists "plan_change_requests_sa_all" on public.plan_change_requests;
create policy "plan_change_requests_sa_all"
  on public.plan_change_requests for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
