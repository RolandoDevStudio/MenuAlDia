-- Per-tenant FAQs for public menu

create table if not exists public.restaurant_faqs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  question text not null,
  answer text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create index if not exists restaurant_faqs_restaurant_sort_idx
  on public.restaurant_faqs (restaurant_id, sort_order);

create index if not exists restaurant_faqs_public_idx
  on public.restaurant_faqs (restaurant_id)
  where is_active = true;

alter table public.restaurant_faqs enable row level security;

drop policy if exists "restaurant_faqs_public_select" on public.restaurant_faqs;
create policy "restaurant_faqs_public_select"
  on public.restaurant_faqs for select
  to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id
        and r.is_active is not false
    )
  );

drop policy if exists "restaurant_faqs_member_all" on public.restaurant_faqs;
create policy "restaurant_faqs_member_all"
  on public.restaurant_faqs for all
  to authenticated
  using (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  )
  with check (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  );
