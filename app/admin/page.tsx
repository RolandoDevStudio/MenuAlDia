import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/admin-session";
import { getAdminImpactStats } from "@/lib/admin-impact";
import { DailyMenuToggles } from "@/components/admin/daily-menu-toggles";
import { ImpactCard } from "@/components/admin/impact-card";
import { PlanGate } from "@/components/admin/plan-gate";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/plans";
import { labelsFor } from "@/lib/business-labels";
import type { Dish } from "@/lib/types";

export default async function AdminDashboardPage() {
  const session = await requireTenantSession();

  const plan = session.restaurant.plan_type || "catalog";
  const businessType = session.restaurant.business_type;
  const labels = labelsFor(businessType);
  const impact = await getAdminImpactStats(session.restaurant.id, plan);

  if (!can(plan, "daily_menu")) {
    return (
      <div className="space-y-4">
        <ImpactCard stats={impact} plan={plan} />
        <PlanGate
          plan={plan}
          feature="daily_menu"
          title={`${labels.dailyMenu} no incluido`}
        >
          {null}
        </PlanGate>
      </div>
    );
  }

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
    return (
      <p className="text-sm text-red-600">
        No se pudo crear el {labels.dailyMenu.toLowerCase()}.
      </p>
    );
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
      <ImpactCard stats={impact} plan={plan} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{labels.dailyMenu}</h1>
          <p className="text-sm text-muted">
            Elige qué ofreces <strong>hoy</strong> como paquete. El catálogo
            completo sigue visible abajo en el menú público.
          </p>
        </div>
        {can(plan, "flyer") ? (
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/flyer?from=today">Generar Flyer</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/difusion">Difundir</Link>
            </Button>
          </div>
        ) : null}
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
        businessType={businessType}
      />
    </div>
  );
}
