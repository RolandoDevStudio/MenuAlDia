-- In-app notifications, web push subscriptions, external webhook outbox

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  audience text not null
    check (audience in ('tenant', 'super_admin')),
  restaurant_id uuid references public.restaurants (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  href text not null default '',
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  constraint notifications_tenant_restaurant_chk
    check (
      (audience = 'tenant' and restaurant_id is not null)
      or (audience = 'super_admin')
    )
);

create index if not exists notifications_tenant_unread_idx
  on public.notifications (restaurant_id, created_at desc)
  where audience = 'tenant' and read_at is null;

create index if not exists notifications_sa_unread_idx
  on public.notifications (created_at desc)
  where audience = 'super_admin' and read_at is null;

create index if not exists notifications_idempotency_idx
  on public.notifications (restaurant_id, type, created_at desc);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid references public.restaurants (id) on delete cascade,
  audience text not null default 'tenant'
    check (audience in ('tenant', 'super_admin')),
  endpoint text not null,
  subscription_json jsonb not null,
  constraint push_subscriptions_endpoint_unique unique (endpoint)
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);
create index if not exists push_subscriptions_restaurant_idx
  on public.push_subscriptions (restaurant_id)
  where restaurant_id is not null;

create table if not exists public.webhook_outbox (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  attempts int not null default 0,
  last_error text not null default '',
  sent_at timestamptz
);

create index if not exists webhook_outbox_pending_idx
  on public.webhook_outbox (created_at)
  where status = 'pending';

alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.webhook_outbox enable row level security;

-- notifications: tenants read/update own; SA read/update super_admin rows
drop policy if exists "notifications_tenant_select" on public.notifications;
create policy "notifications_tenant_select"
  on public.notifications for select
  to authenticated
  using (
    (
      audience = 'tenant'
      and restaurant_id is not null
      and public.is_restaurant_member(restaurant_id)
    )
    or public.is_super_admin()
  );

drop policy if exists "notifications_tenant_update" on public.notifications;
create policy "notifications_tenant_update"
  on public.notifications for update
  to authenticated
  using (
    (
      audience = 'tenant'
      and restaurant_id is not null
      and public.is_restaurant_member(restaurant_id)
    )
    or (
      audience = 'super_admin'
      and public.is_super_admin()
    )
  )
  with check (
    (
      audience = 'tenant'
      and restaurant_id is not null
      and public.is_restaurant_member(restaurant_id)
    )
    or (
      audience = 'super_admin'
      and public.is_super_admin()
    )
  );

-- Inserts via service role only (no insert policy for authenticated)

drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
create policy "push_subscriptions_own"
  on public.push_subscriptions for all
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_super_admin()
  )
  with check (
    user_id = auth.uid()
    or public.is_super_admin()
  );

-- webhook_outbox: SA read only; writes via service role
drop policy if exists "webhook_outbox_sa_select" on public.webhook_outbox;
create policy "webhook_outbox_sa_select"
  on public.webhook_outbox for select
  to authenticated
  using (public.is_super_admin());
