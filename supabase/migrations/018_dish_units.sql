-- Flexible sell units for store (tienda) catalog items

alter table public.dishes
  add column if not exists unit_type text not null default 'unit',
  add column if not exists step_value numeric(12, 4) not null default 1;

alter table public.dishes
  drop constraint if exists dishes_unit_type_check;

alter table public.dishes
  add constraint dishes_unit_type_check
  check (unit_type in ('unit', 'kg', 'liter'));

comment on column public.dishes.unit_type is
  'unit | kg | liter — how quantity is sold (tienda)';
comment on column public.dishes.step_value is
  'Quantity step for cart (+/-); 1 for pieces, 0.1 for kg/L typical';
