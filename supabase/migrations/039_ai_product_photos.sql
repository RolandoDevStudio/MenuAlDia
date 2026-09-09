-- AI product/combo photos: usage kind + photo_is_ai flag + pack price default $29

alter table public.ai_usage
  drop constraint if exists ai_usage_kind_check;

alter table public.ai_usage
  add constraint ai_usage_kind_check
  check (kind in (
    'flyer', 'banner', 'background', 'scan', 'intent', 'broadcast', 'product'
  ));

alter table public.dishes
  add column if not exists photo_is_ai boolean not null default false;

alter table public.combos
  add column if not exists photo_is_ai boolean not null default false;

comment on column public.dishes.photo_is_ai is
  'True when photo_url was applied from AI generation (show Foto ilustrativa on public menu).';
comment on column public.combos.photo_is_ai is
  'True when photo_url was applied from AI generation (show Foto ilustrativa on public menu).';

-- Default pack price 10 imgs / $29 MXN (superadmin can still edit via platform_settings)
insert into public.platform_settings (key, value)
values ('ai_image_pack_price_mxn', '29'::jsonb)
on conflict (key) do update set value = '29'::jsonb;
