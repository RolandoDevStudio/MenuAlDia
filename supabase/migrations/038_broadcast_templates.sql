-- WhatsApp broadcast message templates (admin-saved) + AI usage kind

alter table public.ai_usage
  drop constraint if exists ai_usage_kind_check;

alter table public.ai_usage
  add constraint ai_usage_kind_check
  check (kind in ('flyer', 'banner', 'background', 'scan', 'intent', 'broadcast'));

create table if not exists public.broadcast_templates (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  title text not null default '',
  body text not null,
  announcement_type text not null default 'menu_dia',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists broadcast_templates_restaurant_updated_idx
  on public.broadcast_templates (restaurant_id, updated_at desc);

alter table public.broadcast_templates enable row level security;

drop policy if exists "broadcast_templates_member_all" on public.broadcast_templates;
create policy "broadcast_templates_member_all"
  on public.broadcast_templates for all
  to authenticated
  using (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  )
  with check (
    public.is_restaurant_member(restaurant_id) or public.is_super_admin()
  );

comment on table public.broadcast_templates is
  'Saved WhatsApp broadcast message templates per restaurant (max 10 enforced in API).';
