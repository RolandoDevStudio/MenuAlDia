import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionRestaurant } from "@/lib/restaurant";
import { DailyMenuToggles } from "@/components/admin/daily-menu-toggles";
import { Button } from "@/components/ui/button";
import type { Dish } from "@/lib/types";

export default async function AdminDashboardPage() {
  const session = await getSessionRestaurant();
  if (!session) redirect("/admin/login");

  const supabase = await createClient();
  const restaurantId = session.restaurant.id;

  let { data: selection } = await supabase
    .from("daily_menu_selections")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (!selection) {
    const { data: created } = await supabase
      .from("daily_menu_selections")
      .insert({
        restaurant_id: restaurantId,
        package_price: 100,
        max_sides: 2,
      })
      .select("*")
      .single();
    selection = created;
  }

  if (!selection) {
    return <p className="text-sm text-red-600">No se pudo crear el menú del día.</p>;
  }

  const [{ data: dishes }, { data: mainLinks }, { data: sideLinks }] =
    await Promise.all([
      supabase
        .from("dishes")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("daily_menu_dishes")
        .select("dish_id")
        .eq("daily_menu_id", selection.id),
      supabase
        .from("daily_menu_sides")
        .select("dish_id")
        .eq("daily_menu_id", selection.id),
    ]);

  const all = (dishes ?? []) as Dish[];
  const mains = all.filter((d) => !d.is_side);
  const sides = all.filter((d) => d.is_side);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Menú del día</h1>
          <p className="text-sm text-muted">Activa platillos en un toque.</p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/admin/flyer">Generar Flyer</Link>
        </Button>
      </div>
      <DailyMenuToggles
        restaurantId={restaurantId}
        dailyMenuId={selection.id}
        packagePrice={Number(selection.package_price)}
        maxSides={selection.max_sides}
        mains={mains}
        sides={sides}
        selectedMainIds={(mainLinks ?? []).map((l) => l.dish_id)}
        selectedSideIds={(sideLinks ?? []).map((l) => l.dish_id)}
        publicSlug={session.restaurant.slug}
      />
    </div>
  );
}
