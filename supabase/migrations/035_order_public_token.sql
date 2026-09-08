-- Public shareable order ticket: opaque token, never the row UUID.
-- The RPC is the only anon-readable surface; orders stay member-only via RLS.

create or replace function public.order_new_public_token()
returns text
language sql
volatile
as $$
  select rtrim(
    replace(replace(encode(extensions.gen_random_bytes(12), 'base64'), '+', '-'), '/', '_'),
    '='
  );
$$;

alter table public.orders
  add column if not exists public_token text;

update public.orders
   set public_token = public.order_new_public_token()
 where public_token is null or public_token = '';

alter table public.orders
  alter column public_token set default public.order_new_public_token();

alter table public.orders
  alter column public_token set not null;

create unique index if not exists orders_public_token_uidx
  on public.orders (public_token);

create or replace function public.assign_order_public_token()
returns trigger
language plpgsql
as $$
begin
  if new.public_token is null or new.public_token = '' then
    new.public_token := public.order_new_public_token();
  end if;
  return new;
end;
$$;

drop trigger if exists orders_assign_public_token on public.orders;
create trigger orders_assign_public_token
  before insert on public.orders
  for each row
  execute function public.assign_order_public_token();

-- Safe public snapshot: no order id, customer_id, phone, customer name, or address.
create or replace function public.public_order_by_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_token text := trim(coalesce(p_token, ''));
  v jsonb;
begin
  if length(v_token) < 8 or length(v_token) > 64 then
    return null;
  end if;
  if v_token !~ '^[A-Za-z0-9_-]+$' then
    return null;
  end if;

  select jsonb_build_object(
    'folio', o.folio,
    'status', o.status,
    'created_at', o.created_at,
    'total', o.total,
    'fulfillment', coalesce(o.payload->>'fulfillment', 'pickup'),
    'table_label', nullif(o.payload->>'table_label', ''),
    'items', coalesce(o.payload->'items', '[]'::jsonb),
    'subtotal', coalesce((o.payload->>'subtotal')::numeric, 0),
    'shipping', coalesce((o.payload->>'shipping')::numeric, 0),
    'discount', coalesce((o.payload->>'discount')::numeric, 0),
    'coupon_code', nullif(o.payload->>'coupon_code', ''),
    'payment_method', coalesce(o.payload->>'payment_method', 'cash'),
    'restaurant_name', r.name,
    'restaurant_logo', r.logo_url,
    'restaurant_slug', r.slug,
    'show_transfer_details', coalesce(r.show_transfer_details, false),
    'bank_account_holder', coalesce(r.bank_account_holder, ''),
    'bank_name', coalesce(r.bank_name, ''),
    'bank_clabe', coalesce(r.bank_clabe, '')
  )
  into v
  from public.orders o
  join public.restaurants r on r.id = o.restaurant_id
  where o.public_token = v_token;

  return v;
end;
$$;

revoke all on function public.order_new_public_token() from public;
revoke all on function public.public_order_by_token(text) from public;
grant execute on function public.public_order_by_token(text) to anon, authenticated;
