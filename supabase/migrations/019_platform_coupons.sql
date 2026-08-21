-- Platform (B2B) subscription coupons

create table if not exists public.platform_coupons (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(12, 2) not null check (discount_value > 0),
  plan_scope text not null default 'all'
    check (plan_scope in ('all', 'catalog', 'daily', 'pro')),
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions int,
  redemption_count int not null default 0,
  is_active boolean not null default true,
  label text not null default '',
  notes text not null default '',
  constraint platform_coupons_code_unique unique (code)
);

create index if not exists platform_coupons_active_idx
  on public.platform_coupons (is_active, code);

create table if not exists public.platform_coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  coupon_id uuid not null references public.platform_coupons (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  payment_id uuid references public.tenant_payments (id) on delete set null,
  discount_applied numeric(12, 2) not null default 0
);

create index if not exists platform_coupon_redemptions_coupon_idx
  on public.platform_coupon_redemptions (coupon_id, created_at desc);

alter table public.tenant_payments
  add column if not exists coupon_code text,
  add column if not exists discount_amount numeric(12, 2) not null default 0,
  add column if not exists list_amount numeric(12, 2);

alter table public.platform_coupons enable row level security;
alter table public.platform_coupon_redemptions enable row level security;

drop policy if exists "platform_coupons_sa_all" on public.platform_coupons;
create policy "platform_coupons_sa_all"
  on public.platform_coupons for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "platform_coupon_redemptions_sa_all" on public.platform_coupon_redemptions;
create policy "platform_coupon_redemptions_sa_all"
  on public.platform_coupon_redemptions for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Tenant can see own redemption rows (history)
drop policy if exists "platform_coupon_redemptions_member_select" on public.platform_coupon_redemptions;
create policy "platform_coupon_redemptions_member_select"
  on public.platform_coupon_redemptions for select
  to authenticated
  using (public.is_restaurant_member(restaurant_id));
