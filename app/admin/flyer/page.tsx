import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/admin-session";
import { FlyerStudio } from "@/components/flyer/flyer-studio";
import { PlanGate } from "@/components/admin/plan-gate";
import { can } from "@/lib/plans";
import type { Dish } from "@/lib/types";

type Props = {
  searchParams: Promise<{ combo?: string; from?: string }>;
};

const DISH_SELECT =
  "id, restaurant_id, category_id, name, description, photo_url, price, is_side, is_active, is_popular, sort_order";

export default async function FlyerPage({ searchParams }: Props) {
  const session = await requireTenantSession();
  const sp = await searchParams;

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
        <p className="text-sm text-muted">
          Combo no encontrado. Vuelve a Combos y elige “Usar en Flyer”.
        </p>
      );
    }

    const { data: links } = await supabase
      .from("combo_items")
      .select("dish_id, quantity")
      .eq("combo_id", combo.id)
      .order("sort_order");

    const dishIds = (links ?? []).map((l) => l.dish_id);
    const { data: dishes } = dishIds.length
      ? await supabase.from("dishes").select(DISH_SELECT).in("id", dishIds)
      : { data: [] as Dish[] };

    const map = new Map(((dishes ?? []) as Dish[]).map((d) => [d.id, d]));
    const comboDishes = (links ?? [])
      .map((l) => map.get(l.dish_id))
      .filter(Boolean) as Dish[];

    const price =
      combo.fixed_price != null
        ? Number(combo.fixed_price)
        : comboDishes.reduce((s, d) => s + Number(d.price), 0);

    return (
      <FlyerStudio
        restaurant={session.restaurant}
        dishes={comboDishes}
        sides={[]}
        packagePrice={price}
        initialHeadline={combo.title.toUpperCase()}
        sidesTitle="Incluye"
        sourceLabel={`Promo del combo “${combo.title}”. Descarga y difunde en WhatsApp.`}
      />
    );
  }

  const { data: selection } = await supabase
    .from("daily_menu_selections")
    .select("*")
    .eq("restaurant_id", session.restaurant.id)
    .maybeSingle();

  if (!selection) {
    return (
      <p className="text-sm text-muted">
        Primero configura los especiales de hoy en el panel principal, o crea un
        combo y elige “Usar en Flyer”.
      </p>
    );
  }

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

  const selectedIds = [
    ...new Set([
      ...(mainLinks ?? []).map((l) => l.dish_id),
      ...(sideLinks ?? []).map((l) => l.dish_id),
    ]),
  ];

  const { data: dishes } =
    selectedIds.length > 0
      ? await supabase.from("dishes").select(DISH_SELECT).in("id", selectedIds)
      : { data: [] as Dish[] };

  const map = new Map(((dishes ?? []) as Dish[]).map((d) => [d.id, d]));
  const dailyDishes = (mainLinks ?? [])
    .map((l) => map.get(l.dish_id))
    .filter(Boolean) as Dish[];
  const dailySides = (sideLinks ?? [])
    .map((l) => map.get(l.dish_id))
    .filter(Boolean) as Dish[];

  if (dailyDishes.length === 0 && dailySides.length === 0) {
    return (
      <p className="text-sm text-muted">
        Elige al menos un platillo o guarnición en Especiales de hoy para generar
        el flyer.
      </p>
    );
  }

  return (
    <FlyerStudio
      restaurant={session.restaurant}
      dishes={dailyDishes}
      sides={dailySides}
      packagePrice={Number(selection.package_price)}
      fromToday={fromToday || !sp.combo}
      sourceLabel={
        fromToday
          ? "Precargado desde Especiales de hoy. Ajusta solo si quieres y descarga."
          : "Vista previa del volante con el menú del día. Descarga en alta resolución."
      }
    />
  );
}
