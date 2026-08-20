-- Legal acceptance (clickwrap) on tenants

alter table public.restaurants
  add column if not exists terms_version_accepted text,
  add column if not exists terms_accepted_at timestamptz;
