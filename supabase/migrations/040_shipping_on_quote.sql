-- Shipping quoted after checkout (servicios UI; column is giro-agnostic).

alter table public.restaurants
  add column if not exists shipping_on_quote boolean not null default false;

comment on column public.restaurants.shipping_on_quote is
  'When true, delivery/shipping is not charged at checkout; admin quotes later. UI currently offers this for Servicios.';

-- Dine-in only applies to restaurants.
update public.restaurants
set offers_dine_in = false
where coalesce(business_type, 'restaurante') not in ('restaurante')
  and offers_dine_in is true;

-- Public ticket: expose shipping_pending so clients see quote state.
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
    'shipping_pending', coalesce((o.payload->>'shipping_pending')::boolean, false),
    'discount', coalesce((o.payload->>'discount')::numeric, 0),
    'coupon_code', nullif(o.payload->>'coupon_code', ''),
    'payment_method', coalesce(o.payload->>'payment_method', 'cash'),
    'restaurant_name', r.name,
    'restaurant_logo', r.logo_url,
    'restaurant_slug', r.slug,
    'business_type', coalesce(r.business_type, 'restaurante'),
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

revoke all on function public.public_order_by_token(text) from public;
grant execute on function public.public_order_by_token(text) to anon, authenticated;
