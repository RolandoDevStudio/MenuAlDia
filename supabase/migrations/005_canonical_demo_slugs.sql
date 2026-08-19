-- Homologate canonical demo slugs: servicios + tienda
-- Safe to re-run (idempotent updates).

update public.restaurants
set slug = 'demo-servicios', updated_at = now()
where slug = 'demo-estetica';

update public.restaurants
set slug = 'demo-tienda', updated_at = now()
where slug = 'demo-productos';

update public.plan_templates
set slug_key = 'demo-servicios', updated_at = now()
where slug_key = 'demo-estetica';

update public.plan_templates
set slug_key = 'demo-tienda', updated_at = now()
where slug_key = 'demo-productos';
