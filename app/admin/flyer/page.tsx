import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/admin-session";
import { FlyerPreview } from "@/components/flyer/flyer-preview";
import { FlyerExportButton } from "@/components/flyer/flyer-export-button";
import { PlanGate } from "@/components/admin/plan-gate";
import { can } from "@/lib/plans";
import type { Dish } from "@/lib/types";

type Props = { searchParams: Promise<{ combo?: string }> };

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
      ? await supabase
          .from("dishes")
          .select(
            "id, restaurant_id, category_id, name, description, photo_url, price, is_side, is_active, sort_order",
          )
          .in("id", dishIds)
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
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold">Flyer — {combo.title}</h1>
          <p className="text-sm text-muted">
            Promo del combo. Descarga y difunde en WhatsApp.
          </p>
        </div>
        <FlyerExportButton slug={session.restaurant.slug} />
        <FlyerPreview
          restaurant={session.restaurant}
          dishes={comboDishes}
          sides={[]}
          packagePrice={price}
          headline={combo.title.toUpperCase()}
          sidesTitle="Incluye"
        />
      </div>
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
        Primero configura el menú del día en el panel principal, o crea un combo
        y elige “Usar en Flyer”.
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
      ? await supabase
          .from("dishes")
          .select(
            "id, restaurant_id, category_id, name, description, photo_url, price, is_side, is_active, sort_order",
          )
          .in("id", selectedIds)
      : { data: [] as Dish[] };

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
