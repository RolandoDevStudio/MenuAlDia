-- Daily menu: pricing mode + global visibility switch

alter table public.daily_menu_selections
  add column if not exists pricing_mode text not null default 'package',
  add column if not exists is_active boolean not null default true;

alter table public.daily_menu_selections
  drop constraint if exists daily_menu_selections_pricing_mode_check;

alter table public.daily_menu_selections
  add constraint daily_menu_selections_pricing_mode_check
  check (pricing_mode in ('package', 'individual'));
