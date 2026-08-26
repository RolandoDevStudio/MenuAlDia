-- Fulfillment modes, MX-10 customer phones, race-safe customer upsert.

alter table public.restaurants
  add column if not exists offers_pickup boolean not null default true;

alter table public.restaurants
  add column if not exists offers_dine_in boolean not null default false;

create or replace function public.normalize_mx_phone(raw text)
returns text
language plpgsql
immutable
as $$
declare
  d text;
begin
  if raw is null then
    return null;
  end if;
  d := regexp_replace(raw, '\D', '', 'g');
  if length(d) = 13 and d like '521%' then
    d := substr(d, 4);
  elsif length(d) = 12 and d like '52%' then
    d := substr(d, 3);
  end if;
  if length(d) = 10 then
    return d;
  end if;
  return null;
end;
$$;

update public.customers
set phone = public.normalize_mx_phone(phone);

update public.customers
set phone = null
where phone is not null and btrim(phone) = '';

-- Keep the strongest row per (restaurant, phone); blank the rest so unique can land.
with ranked as (
  select
    id,
    row_number() over (
      partition by restaurant_id, phone
      order by orders_count desc nulls last, created_at asc
    ) as rn
  from public.customers
  where phone is not null
)
update public.customers c
set phone = null
from ranked r
where c.id = r.id
  and r.rn > 1;

drop index if exists public.customers_restaurant_phone_uidx;
create unique index customers_restaurant_phone_uidx
  on public.customers (restaurant_id, phone)
  where phone is not null;

create or replace function public.upsert_customer_by_phone(
  p_restaurant_id uuid,
  p_name text,
  p_phone text,
  p_bump_order boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_name text;
  v_id uuid;
  v_plan text;
begin
  v_phone := public.normalize_mx_phone(p_phone);
  if p_restaurant_id is null or v_phone is null then
    return null;
  end if;

  select r.plan_type into v_plan
  from public.restaurants r
  where r.id = p_restaurant_id
    and r.is_active is not false;

  if v_plan is distinct from 'pro' then
    return null;
  end if;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  if v_name is null then
    v_name := 'Cliente';
  end if;

  insert into public.customers (
    restaurant_id,
    name,
    phone,
    address,
    orders_count,
    last_order_at
  )
  values (
    p_restaurant_id,
    v_name,
    v_phone,
    '',
    case when p_bump_order then 1 else 0 end,
    case when p_bump_order then now() else null end
  )
  on conflict (restaurant_id, phone) where phone is not null
  do update set
    name = case
      when public.customers.name is null
        or public.customers.name = ''
        or public.customers.name = 'Cliente'
      then excluded.name
      else public.customers.name
    end,
    orders_count = public.customers.orders_count
      + case when p_bump_order then 1 else 0 end,
    last_order_at = case
      when p_bump_order then now()
      else public.customers.last_order_at
    end
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_customer_by_phone(uuid, text, text, boolean) from public;
grant execute on function public.upsert_customer_by_phone(uuid, text, text, boolean)
  to anon, authenticated, service_role;
