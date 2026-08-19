# Menú al Día (`menualdia.app`)

SaaS multi-tenant para negocios locales: menú digital, menú del día, flyer WhatsApp y pedidos por `wa.me` sin comisiones. Planes: Catálogo ($199), Menú al Día ($349), Pro + CRM ($599).

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (Auth, Postgres, Storage, RLS)
- `html-to-image` (flyer PNG en cliente)

## Setup

1. Copia variables:

```bash
cp .env.example .env.local
```

Completa `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` (super-admin: clonar con usuario/contraseña) y opcionalmente `NEXT_PUBLIC_SALES_WHATSAPP`.

2. En Supabase SQL Editor, ejecuta en orden:

- [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql)
- [`supabase/migrations/002_saas_plans_theme_crm.sql`](supabase/migrations/002_saas_plans_theme_crm.sql)
- [`supabase/migrations/003_superadmin_audit_verticals.sql`](supabase/migrations/003_superadmin_audit_verticals.sql)

3. CORS del bucket `dish-photos` (necesario para el flyer):

- Dashboard → Storage → Configuration → CORS
- Usa los orígenes de [`supabase/storage-cors.json`](supabase/storage-cors.json) (`localhost:3000`, `menualdia.app`, `*.vercel.app`)

4. Vincula un owner al demo fonda:

```sql
insert into public.restaurant_members (user_id, restaurant_id, role)
values ('<AUTH_USER_UUID>', 'a0000000-0000-4000-8000-000000000001', 'owner');
```

5. (Opcional) Crea un super-admin de plataforma:

```sql
-- Tras crear el usuario en Auth:
insert into public.restaurant_members (user_id, restaurant_id, role)
values (
  '<AUTH_USER_UUID>',
  'a0000000-0000-4000-8000-000000000001',
  'super_admin'
);
```

`is_super_admin()` permite acceso a `/super-admin` (tenants, plan, fechas, clonado).

6. Instala y corre:

```bash
npm install
npm run dev
```

| Ruta | Uso |
|------|-----|
| `/` | Landing CRO + pricing |
| `/demo-fonda` | Demo fonda |
| `/demo-estetica` | Demo estética |
| `/demo` | Redirect → `/demo-fonda` |
| `/admin/login` | Admin tenant |
| `/super-admin` | Plataforma (rol `super_admin`) |
| `/super-admin/tenants` | Tabla CRUD suscriptores |
| `/super-admin/templates` | Plantillas giro × plan |
| `/admin/history` | Historial de cambios y pagos (tenant) |

Giros (`business_type`): `restaurante`, `estetica`, `tienda`, `servicios` — cambian el vocabulario de la UI (platillos vs servicios, etc.).

## Feature gates por plan

| Capacidad | catalog | daily | pro |
|-----------|---------|-------|-----|
| Catálogo + fotos (máx 30 en catalog) | sí | sí | sí |
| Branding / WhatsApp / tema | sí | sí | sí |
| Menú del día + flyer | — | sí | sí |
| Orders, customers, métricas, CSV | — | — | sí |

Cobro: manual vía super-admin (`plan_type`, `subscription_end_date`, `is_active`). Sin Stripe en esta etapa.

## Checklist producción

- [ ] Migraciones `001` + `002` aplicadas
- [ ] CORS Storage aplicado
- [ ] Env en Vercel (`NEXT_PUBLIC_*`)
- [ ] Smoke RLS: anon no ve tenants con `is_active=false` o suscripción vencida
- [ ] Usuario `super_admin` creado
- [ ] Demos `/demo-fonda` y `/demo-estetica` en móvil
- [ ] Flyer export con fotos del bucket (CORS)

## Estructura

- Público: `app/(public)/[slug]`
- Admin: `app/admin/*` (feature-gated)
- Super-admin: `app/super-admin/*`
- CRM Pro: `orders`, `customers`, `analytics`, `api/admin/export`
- Temas: `theme_config` JSONB → CSS vars en layout público
