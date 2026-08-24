-- Show/hide "Hecho con Menú al Día" footer on public menus (superadmin only).
alter table public.restaurants
  add column if not exists show_powered_by boolean not null default true;

comment on column public.restaurants.show_powered_by is
  'When true, public menu shows PoweredBy MenuAlDia footer. Superadmin toggle.';
