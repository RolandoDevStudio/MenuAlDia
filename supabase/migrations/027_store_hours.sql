-- Structured hours + auto open/close + closed message + manual override

alter table public.restaurants
  add column if not exists schedule_hours jsonb not null default '{}'::jsonb;

alter table public.restaurants
  add column if not exists schedule_auto boolean not null default false;

alter table public.restaurants
  add column if not exists closed_message text not null default '';

alter table public.restaurants
  add column if not exists orders_override text
    check (
      orders_override is null
      or orders_override in ('force_open', 'force_closed')
    );

comment on column public.restaurants.schedule_hours is
  'Per weekday 0=Sun..6=Sat: { closed, slots:[{open,close}] } HH:mm CDMX';

comment on column public.restaurants.schedule_auto is
  'When true, open state follows schedule_hours unless orders_override is set';

comment on column public.restaurants.closed_message is
  'Optional public message while closed (override or auto)';

comment on column public.restaurants.orders_override is
  'force_open | force_closed | null (follow schedule_auto / accepting_orders)';
