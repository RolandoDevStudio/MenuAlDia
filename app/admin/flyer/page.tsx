import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/admin-session";
import { FlyerWorkspace } from "@/components/admin/flyer-workspace";
import { PlanGate } from "@/components/admin/plan-gate";
import { DifusionSubnav } from "@/components/admin/difusion-subnav";
import { can } from "@/lib/plans";
import { labelsFor } from "@/lib/business-labels";
import type { Dish } from "@/lib/types";
import Link from "next/link";

type Props = {
  searchParams: Promise<{ combo?: string; from?: string; ref?: string }>;
};

const DISH_SELECT =
  "id, restaurant_id, category_id, name, description, photo_url, price, is_side, is_active, is_popular, sort_order";

export default async function FlyerPage({ searchParams }: Props) {
  const session = await requireTenantSession();
  const sp = await searchParams;
  const labels = labelsFor(session.restaurant.business_type);

  const plan = session.restaurant.plan_type || "catalog";
  if (!can(plan, "flyer")) {
    return (
      <PlanGate plan={plan} feature="flyer" title="Generador de flyers no incluido">
        {null}
      </PlanGate>
    );
  }

  const supabase = await createClient();
  const fromToday = sp.from === "today";

  const [{ data: allDishes }, { data: categories }] = await Promise.all([
    supabase
      .from("dishes")
      .select(DISH_SELECT)
      .eq("restaurant_id", session.restaurant.id)
      .eq("is_active", true)
      .is("archived_at", null)
      .order("sort_order"),
    supabase
      .from("categories")
      .select("id, name, sort_order")
      .eq("restaurant_id", session.restaurant.id)
      .order("sort_order"),
  ]);

  const catalog = (allDishes ?? []) as Dish[];
  const cats = (categories ?? []) as {
    id: string;
    name: string;
    sort_order: number;
  }[];

  if (sp.combo) {
    const { data: combo } = await supabase
      .from("combos")
      .select("*")
      .eq("id", sp.combo)
      .eq("restaurant_id", session.restaurant.id)
      .is("archived_at", null)
      .maybeSingle();

    if (!combo) {
      return (
        <div>
          <DifusionSubnav />
          <p className="text-sm text-muted">
            Combo no encontrado. Vuelve a Combos y elige “Usar en Flyer”.
          </p>
        </div>
      );
    }

    const { data: links } = await supabase
      .from("combo_items")
      .select("dish_id, quantity")
      .eq("combo_id", combo.id)
      .order("sort_order");

    const dishIds = (links ?? []).map((l) => l.dish_id);
    const map = new Map(catalog.map((d) => [d.id, d]));
    // Prefer catalog rows; fall back to fetching missing combo dishes
    let comboDishes = dishIds
      .map((id) => map.get(id))
      .filter(Boolean) as Dish[];

    const missing = dishIds.filter((id) => !map.has(id));
    if (missing.length) {
      const { data: extra } = await supabase
        .from("dishes")
        .select(DISH_SELECT)
        .in("id", missing);
      const extraMap = new Map(((extra ?? []) as Dish[]).map((d) => [d.id, d]));
      comboDishes = dishIds
        .map((id) => map.get(id) ?? extraMap.get(id))
        .filter(Boolean) as Dish[];
    }

    const price =
      combo.fixed_price != null
        ? Number(combo.fixed_price)
        : comboDishes.reduce((s, d) => s + Number(d.price), 0);

    const mainIds = comboDishes.filter((d) => !d.is_side).map((d) => d.id);
    const sideIds = comboDishes.filter((d) => d.is_side).map((d) => d.id);

    return (
      <div>
        <DifusionSubnav />
        {catalog.length === 0 ? (
          <EmptyCatalog labels={labels} />
        ) : (
          <FlyerWorkspace
            restaurant={session.restaurant}
            dishes={catalog}
            categories={cats}
            packagePrice={price}
            preselectedMainIds={mainIds}
            preselectedSideIds={sideIds}
            todayPreselectedIds={[...mainIds, ...sideIds]}
            initialHeadline={combo.title.toUpperCase()}
            sidesTitle="Incluye"
            sourceLabel={`Promo del combo “${combo.title}”. Descarga y difunde en WhatsApp.`}
            initialRefId={sp.ref ?? null}
          />
        )}
      </div>
    );
  }

  const { data: selection } = await supabase
    .from("daily_menu_selections")
    .select("*")
    .eq("restaurant_id", session.restaurant.id)
    .maybeSingle();

  let preMain: string[] = [];
  let preSide: string[] = [];
  let packagePrice = 0;

  if (selection) {
    const [{ data: mainLinks }, { data: sideLinks }] = await Promise.all([
      supabase
        .from("daily_menu_dishes")
        .select("dish_id")
        .eq("daily_menu_id", selection.id),
      supabase
        .from("daily_menu_sides")
        .select("dish_id")
        .eq("daily_menu_id", selection.id),
    ]);
    preMain = (mainLinks ?? []).map((l) => l.dish_id);
    preSide = (sideLinks ?? []).map((l) => l.dish_id);
    packagePrice = Number(selection.package_price) || 0;
  }

  const todayIds = [...new Set([...preMain, ...preSide])];

  return (
    <div>
      <DifusionSubnav />
      {catalog.length === 0 ? (
        <EmptyCatalog labels={labels} />
      ) : (
        <FlyerWorkspace
          restaurant={session.restaurant}
          dishes={catalog}
          categories={cats}
          packagePrice={packagePrice}
          preselectedMainIds={fromToday || todayIds.length > 0 ? preMain : []}
          preselectedSideIds={fromToday || todayIds.length > 0 ? preSide : []}
          todayPreselectedIds={todayIds}
          fromToday={fromToday}
          sourceLabel={
            fromToday
              ? "Precargado desde Especiales de hoy. Ajusta solo si quieres y descarga."
              : "Elige productos del catálogo o deja el flyer solo texto / redes. Descarga en alta resolución."
          }
          initialRefId={sp.ref ?? null}
        />
      )}
    </div>
  );
}

function EmptyCatalog({
  labels,
}: {
  labels: ReturnType<typeof labelsFor>;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-surface p-6 text-center">
      <p className="text-sm text-muted">
        Aún no hay {labels.dishes.toLowerCase()} activos. Agrega productos en el
        catálogo para armar tu flyer.
      </p>
      <Link
        href="/admin/catalog"
        className="mt-3 inline-block text-sm font-semibold text-brand"
      >
        Ir a {labels.catalog}
      </Link>
    </div>
  );
}
