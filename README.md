# Menú al Día (`menualdia.app`)

SaaS micro-B2B para restaurantes locales: menú del día en minutos, flyer WhatsApp y pedidos por `wa.me` sin comisiones.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (Auth, Postgres, Storage, RLS)
- `html-to-image` (flyer PNG en cliente)

## Setup rápido

1. Copia variables de entorno:

```bash
cp .env.example .env.local
```

2. En Supabase SQL Editor, ejecuta [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql).

3. Configura CORS del bucket `dish-photos` según [`supabase/storage-cors.json`](supabase/storage-cors.json) (Dashboard → Storage → Configuration).

4. Crea un usuario en Auth y vincúlalo al restaurante demo:

```sql
insert into public.restaurant_members (user_id, restaurant_id, role)
values ('<AUTH_USER_UUID>', 'a0000000-0000-4000-8000-000000000001', 'owner');
```

5. Instala y corre:

```bash
npm install
npm run dev
```

- Público demo: http://localhost:3000/demo  
- Admin: http://localhost:3000/admin/login  

## Estructura

Ver plan de arquitectura: rutas `app/(public)/[slug]`, `app/admin/*`, componentes en `components/{public,admin,flyer}`, lib Supabase en `lib/supabase`.
