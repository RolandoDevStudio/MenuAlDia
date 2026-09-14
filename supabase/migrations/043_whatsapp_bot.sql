-- WhatsApp Cloud API bot (Pro): accounts, logs, customer opt-in / pause.
-- Run AFTER 042_commercial_offer.sql

create table if not exists public.restaurant_whatsapp_accounts (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  waba_id text,
  phone_number_id text,
  display_phone text,
  access_token_encrypted text,
  status text not null default 'disconnected'
    check (status in ('disconnected', 'connected', 'error')),
  whatsapp_bot_enabled boolean not null default false,
  pull_menu_enabled boolean not null default false,
  chat_orders_enabled boolean not null default false,
  state_notifications_enabled boolean not null default false,
  upselling_enabled boolean not null default false,
  abandoned_cart_nudge boolean not null default false,
  vip_broadcast_enabled boolean not null default false,
  bot_menu_scope text not null default 'specials_only'
    check (bot_menu_scope in ('specials_only', 'all_active')),
  templates_status jsonb not null default
    '{"menu_del_dia":"PENDING","estado_pedido":"PENDING","confirmacion_pedido":"PENDING"}'::jsonb,
  message_templates_config jsonb not null default '{}'::jsonb,
  guide_ack_at timestamptz,
  guide_ack_by uuid,
  guide_version text,
  whatsapp_ai_marketing_addon boolean not null default false,
  addon_trial_ends_at timestamptz,
  last_inbound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists restaurant_whatsapp_accounts_phone_number_id_uidx
  on public.restaurant_whatsapp_accounts (phone_number_id)
  where phone_number_id is not null;

alter table public.restaurant_whatsapp_accounts enable row level security;

drop policy if exists "wa_accounts_member_select" on public.restaurant_whatsapp_accounts;
create policy "wa_accounts_member_select"
  on public.restaurant_whatsapp_accounts for select
  to authenticated
  using (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  );

drop policy if exists "wa_accounts_member_update" on public.restaurant_whatsapp_accounts;
create policy "wa_accounts_member_update"
  on public.restaurant_whatsapp_accounts for update
  to authenticated
  using (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  )
  with check (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  );

drop policy if exists "wa_accounts_member_insert" on public.restaurant_whatsapp_accounts;
create policy "wa_accounts_member_insert"
  on public.restaurant_whatsapp_accounts for insert
  to authenticated
  with check (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  );

-- Service role / webhook uses admin client (bypasses RLS).

create table if not exists public.wa_processed_messages (
  wamid text primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  processed_at timestamptz not null default now()
);

create index if not exists wa_processed_messages_ttl_idx
  on public.wa_processed_messages (processed_at);

alter table public.wa_processed_messages enable row level security;
-- No member policies: only service role writes/reads for idempotency.

create table if not exists public.wa_message_log (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  category text not null check (category in ('service', 'utility', 'marketing')),
  template_name text,
  wamid text,
  ok boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists wa_message_log_restaurant_created_idx
  on public.wa_message_log (restaurant_id, created_at desc);

alter table public.wa_message_log enable row level security;

drop policy if exists "wa_message_log_member_select" on public.wa_message_log;
create policy "wa_message_log_member_select"
  on public.wa_message_log for select
  to authenticated
  using (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  );

create table if not exists public.wa_session_state (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  wa_id text not null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, wa_id)
);

create index if not exists wa_session_state_ttl_idx
  on public.wa_session_state (updated_at);

alter table public.wa_session_state enable row level security;
-- Session state: service role only (webhook).

alter table public.customers
  add column if not exists wa_opt_in boolean not null default false,
  add column if not exists bot_paused boolean not null default false,
  add column if not exists wa_id text;

create index if not exists customers_restaurant_wa_id_idx
  on public.customers (restaurant_id, wa_id)
  where wa_id is not null;

comment on table public.restaurant_whatsapp_accounts is
  'Per-tenant WhatsApp Cloud API connection and bot toggles (default OFF).';
comment on table public.wa_processed_messages is
  'Idempotency store for Meta webhook wamid (short TTL purge).';
comment on table public.wa_message_log is
  'Metadata-only message log for usage / cost estimates (no chat bodies).';
