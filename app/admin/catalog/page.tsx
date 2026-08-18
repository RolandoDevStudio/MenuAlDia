import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionRestaurant } from "@/lib/restaurant";
import { dishLimit } from "@/lib/plans";
import { formatMxn } from "@/lib/money";
import { Button } from "@/components/ui/button";
import type { Dish } from "@/lib/types";

export default async function CatalogPage() {
  const session = await getSessionRestaurant();
  if (!session) redirect("/admin/login");

  const supabase = await createClient();
  const { data: dishes } = await supabase
    .from("dishes")
    .select("*")
    .eq("restaurant_id", session.restaurant.id)
    .order("sort_order");

  const list = (dishes ?? []) as Dish[];
  const limit = dishLimit(session.restaurant.plan_type);
  const atLimit = limit != null && list.length >= limit;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Catálogo</h1>
          <p className="text-sm text-muted">
            Platillos y guarniciones
            {limit != null ? ` · ${list.length}/${limit}` : ` · ${list.length}`}.
          </p>
        </div>
        {atLimit ? (
          <Button size="sm" className="min-h-11" disabled>
            Límite
          </Button>
        ) : (
          <Button asChild size="sm" className="min-h-11">
            <Link href="/admin/catalog/new">
              <Plus className="h-4 w-4" />
              Nuevo
            </Link>
          </Button>
        )}
      </div>

      {atLimit ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-brand-dark">
          Alcanzaste el máximo de {limit} productos del plan Catálogo. Mejora a
          Menú al Día o Pro para agregar más.
        </div>
      ) : null}

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 px-4 py-10 text-center">
          <p className="font-semibold text-brand-dark">Sin platillos todavía</p>
          <p className="mt-1 text-sm text-muted">
            Crea el primero para armar el menú del día y el flyer.
          </p>
          <Button asChild className="mt-4">
            <Link href="/admin/catalog/new">Nuevo platillo</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((dish) => (
            <li key={dish.id}>
              <Link
                href={`/admin/catalog/${dish.id}`}
                className="flex min-h-14 items-center gap-3 rounded-xl border border-black/5 bg-surface p-3 transition hover:bg-white"
              >
                {dish.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={dish.photo_url}
                    alt={dish.name}
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-black/5 font-[family-name:var(--font-display)] text-lg text-brand/50">
                    {dish.name.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{dish.name}</p>
                  <p className="text-xs text-muted">
                    {dish.is_side ? "Guarnición · " : ""}
                    {formatMxn(Number(dish.price))}
                    {!dish.is_active ? " · Inactivo" : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
