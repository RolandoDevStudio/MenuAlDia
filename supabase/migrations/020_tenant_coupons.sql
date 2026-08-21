-- Tenant (B2C) cart coupons

create table if not exists public.tenant_coupons (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  code text not null,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(12, 2) not null check (discount_value > 0),
  min_subtotal numeric(12, 2),
  ends_at timestamptz,
  max_uses int,
  use_count int not null default 0,
  max_uses_per_customer int,
  is_active boolean not null default true,
  constraint tenant_coupons_restaurant_code_unique unique (restaurant_id, code)
);

create index if not exists tenant_coupons_restaurant_idx
  on public.tenant_coupons (restaurant_id, is_active);

create table if not exists public.tenant_coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  coupon_id uuid not null references public.tenant_coupons (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  customer_phone text not null default '',
  discount_applied numeric(12, 2) not null default 0,
  order_note text not null default ''
);

create index if not exists tenant_coupon_redemptions_coupon_phone_idx
  on public.tenant_coupon_redemptions (coupon_id, customer_phone);

alter table public.tenant_coupons enable row level security;
alter table public.tenant_coupon_redemptions enable row level security;

drop policy if exists "tenant_coupons_member_all" on public.tenant_coupons;
create policy "tenant_coupons_member_all"
  on public.tenant_coupons for all
  to authenticated
  using (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  )
  with check (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  );

drop policy if exists "tenant_coupon_redemptions_member_all" on public.tenant_coupon_redemptions;
create policy "tenant_coupon_redemptions_member_all"
  on public.tenant_coupon_redemptions for all
  to authenticated
  using (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  )
  with check (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  );
