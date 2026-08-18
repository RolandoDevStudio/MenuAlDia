import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionRestaurant } from "@/lib/restaurant";
import { FlyerPreview } from "@/components/flyer/flyer-preview";
import { FlyerExportButton } from "@/components/flyer/flyer-export-button";
import { PlanGate } from "@/components/admin/plan-gate";
import { can } from "@/lib/plans";
import type { Dish } from "@/lib/types";

export default async function FlyerPage() {
  const session = await getSessionRestaurant();
  if (!session) redirect("/admin/login");

  const plan = session.restaurant.plan_type || "catalog";
  if (!can(plan, "flyer")) {
    return (
      <PlanGate plan={plan} feature="flyer" title="Generador de flyers no incluido">
        {null}
      </PlanGate>
    );
  }

  const supabase = await createClient();
  const { data: selection } = await supabase
    .from("daily_menu_selections")
    .select("*")
    .eq("restaurant_id", session.restaurant.id)
    .maybeSingle();

  if (!selection) {
    return (
      <p className="text-sm text-muted">
        Primero configura el menú del día en el panel principal.
      </p>
    );
  }

  const [{ data: mainLinks }, { data: sideLinks }, { data: dishes }] =
    await Promise.all([
      supabase
        .from("daily_menu_dishes")
        .select("dish_id")
        .eq("daily_menu_id", selection.id),
      supabase
        .from("daily_menu_sides")
        .select("dish_id")
        .eq("daily_menu_id", selection.id),
      supabase
        .from("dishes")
        .select("*")
        .eq("restaurant_id", session.restaurant.id),
    ]);

  const map = new Map(((dishes ?? []) as Dish[]).map((d) => [d.id, d]));
  const dailyDishes = (mainLinks ?? [])
    .map((l) => map.get(l.dish_id))
    .filter(Boolean) as Dish[];
  const dailySides = (sideLinks ?? [])
    .map((l) => map.get(l.dish_id))
    .filter(Boolean) as Dish[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Generar Flyer para WhatsApp</h1>
        <p className="text-sm text-muted">
          Vista previa del volante. Descarga en alta resolución.
        </p>
      </div>

      <FlyerExportButton slug={session.restaurant.slug} />

      <FlyerPreview
        restaurant={session.restaurant}
        dishes={dailyDishes}
        sides={dailySides}
        packagePrice={Number(selection.package_price)}
      />
    </div>
  );
}
