import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/admin-session";
import { dishLimit, type PlanType } from "@/lib/plans";
import { labelsFor } from "@/lib/business-labels";
import { Button } from "@/components/ui/button";
import { CategoriesManager } from "@/components/admin/categories-manager";
import { CatalogDishList } from "@/components/admin/catalog-dish-list";
import type { Category, Dish } from "@/lib/types";

export default async function CatalogPage() {
  const session = await requireTenantSession();

  const businessType = session.restaurant.business_type;
  const labels = labelsFor(businessType);
  const planType = (session.restaurant.plan_type as PlanType) || "catalog";

  const supabase = await createClient();
  const [{ data: dishes }, { data: categories }] = await Promise.all([
    supabase
      .from("dishes")
      .select(
        "id, name, photo_url, price, is_side, is_active, is_popular, sort_order, category_id",
      )
      .eq("restaurant_id", session.restaurant.id)
      .is("archived_at", null)
      .order("sort_order"),
    supabase
      .from("categories")
      .select("id, restaurant_id, name, sort_order, is_fixed_catalog")
      .eq("restaurant_id", session.restaurant.id)
      .order("sort_order"),
  ]);

  const list = (dishes ?? []) as Dish[];
  const cats = (categories ?? []) as Category[];
  const limit = dishLimit(session.restaurant.plan_type);
  const atLimit = limit != null && list.length >= limit;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{labels.catalog}</h1>
          <p className="text-sm text-muted">
            {labels.dishes} y {labels.sides.toLowerCase()}
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

      <CategoriesManager
        restaurantId={session.restaurant.id}
        restaurantSlug={session.restaurant.slug}
        businessType={businessType}
        planType={planType}
      />

      {atLimit ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-brand-dark">
          Alcanzaste el máximo de {limit} productos del plan Catálogo. Mejora a
          Menú al Día o Pro para agregar más.
        </div>
      ) : null}

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 px-4 py-10 text-center">
          <p className="font-semibold text-brand-dark">
            Sin {labels.dishes.toLowerCase()} todavía
          </p>
          <p className="mt-1 text-sm text-muted">
            Crea el primero para armar los {labels.dailyMenu.toLowerCase()} y el
            flyer.
          </p>
          <Button asChild className="mt-4">
            <Link href="/admin/catalog/new">
              Nuevo {labels.dish.toLowerCase()}
            </Link>
          </Button>
        </div>
      ) : (
        <CatalogDishList
          restaurantId={session.restaurant.id}
          restaurantSlug={session.restaurant.slug}
          businessType={businessType}
          initialDishes={list}
          categories={cats}
        />
      )}
    </div>
  );
}
