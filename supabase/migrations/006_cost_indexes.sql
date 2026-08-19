-- Cost / query guardrails: partial index for public active dishes.
-- No CONCURRENTLY — Supabase migrations run inside a transaction.

create index if not exists dishes_public_active_idx
  on public.dishes (restaurant_id)
  where is_active = true and archived_at is null;
