-- Flyer gallery: upload source, visibility, expiry + public read

alter table public.flyers
  add column if not exists source text not null default 'studio',
  add column if not exists is_active boolean not null default true,
  add column if not exists expires_at timestamptz;

alter table public.flyers
  drop constraint if exists flyers_source_check;

alter table public.flyers
  add constraint flyers_source_check
  check (source in ('studio', 'upload'));

create index if not exists flyers_public_active_idx
  on public.flyers (restaurant_id, created_at desc)
  where is_active = true;

drop policy if exists "flyers_public_select" on public.flyers;
create policy "flyers_public_select"
  on public.flyers for select
  to anon, authenticated
  using (
    is_active = true
    and (expires_at is null or expires_at > now())
    and exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id
        and r.is_active is not false
    )
  );
