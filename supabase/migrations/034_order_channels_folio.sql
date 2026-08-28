-- Order channels (WhatsApp / admin panel) + per-restaurant correlative folio.
-- Existing tenants keep WhatsApp-only behaviour until they opt in.

alter table public.restaurants
  add column if not exists orders_via_wa boolean not null default true;

alter table public.restaurants
  add column if not exists orders_via_crm boolean not null default false;

alter table public.restaurants
  add column if not exists order_folio_seq integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'restaurants_order_channel_check'
  ) then
    alter table public.restaurants
      add constraint restaurants_order_channel_check
      check (orders_via_wa or orders_via_crm);
  end if;
end $$;

alter table public.orders
  add column if not exists folio integer;

-- The UPDATE ... RETURNING locks the restaurant row, so concurrent orders are
-- serialized per tenant and folios never collide or skip.
create or replace function public.assign_order_folio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.folio is null then
    update public.restaurants
       set order_folio_seq = order_folio_seq + 1
     where id = new.restaurant_id
    returning order_folio_seq into new.folio;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_assign_folio on public.orders;
create trigger orders_assign_folio
  before insert on public.orders
  for each row
  execute function public.assign_order_folio();

-- Backfill existing orders so old rows also show a folio.
with numbered as (
  select id,
         restaurant_id,
         row_number() over (
           partition by restaurant_id order by created_at, id
         ) as seq
    from public.orders
   where folio is null
)
update public.orders o
   set folio = n.seq
  from numbered n
 where o.id = n.id;

update public.restaurants r
   set order_folio_seq = greatest(r.order_folio_seq, coalesce(m.max_folio, 0))
  from (
    select restaurant_id, max(folio) as max_folio
      from public.orders
     group by restaurant_id
  ) m
 where m.restaurant_id = r.id;

create index if not exists orders_restaurant_folio_idx
  on public.orders (restaurant_id, folio desc);
