import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/admin-session";
import { getAdminImpactStats } from "@/lib/admin-impact";
import { getAdminOpsStats } from "@/lib/admin-ops-stats";
import { DailyMenuToggles } from "@/components/admin/daily-menu-toggles";
import { ImpactCard } from "@/components/admin/impact-card";
import { PlanGate } from "@/components/admin/plan-gate";
import { AdminMorningBanner } from "@/components/admin/admin-morning-banner";
import { AdminOpsKpis } from "@/components/admin/admin-ops-kpis";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/plans";
import { labelsFor } from "@/lib/business-labels";
import type { Dish } from "@/lib/types";

export default async function AdminDashboardPage() {
  const session = await requireTenantSession();

  const plan = session.restaurant.plan_type || "catalog";
  const businessType = session.restaurant.business_type;
  const labels = labelsFor(businessType);
  const restaurantId = session.restaurant.id;

  const [impact, ops] = await Promise.all([
    getAdminImpactStats(restaurantId, plan),
    getAdminOpsStats(
      restaurantId,
      plan,
      session.restaurant.subscription_end_date,
    ),
  ]);

  const acceptingOrders = session.restaurant.accepting_orders !== false;

  const header = (
    <>
      <AdminMorningBanner
        restaurantId={restaurantId}
        restaurantName={session.restaurant.name}
        publicSlug={session.restaurant.slug}
        initialAcceptingOrders={acceptingOrders}
      />
      <AdminOpsKpis stats={ops} businessType={businessType} />
      <div className="flex flex-wrap gap-2">
        {can(plan, "flyer") ? (
          <Button asChild size="sm" variant="secondary">
            <Link href="/admin/difusion">Compartir menú en WhatsApp</Link>
          </Button>
        ) : (
          <Button asChild size="sm" variant="secondary">
            <Link href="/admin/settings">Ver mi plan</Link>
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/catalog/new">
            Agregar {labels.dish.toLowerCase()}
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/promociones">Crear cupón del día</Link>
        </Button>
      </div>
      <ImpactCard stats={impact} plan={plan} />
    </>
  );

  if (!can(plan, "daily_menu")) {
    return (
      <div className="space-y-4">
        {header}
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
      <div className="space-y-4">
        {header}
        <p className="text-sm text-red-600">
          No se pudo crear el {labels.dailyMenu.toLowerCase()}.
        </p>
      </div>
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
      {header}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{labels.dailyMenu}</h1>
          <p className="text-sm text-muted">
            Marca las <strong>opciones</strong> de hoy. El cliente elige una y
            (si aplica) {labels.sides.toLowerCase()}.
          </p>
        </div>
        {can(plan, "flyer") ? (
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/flyer?from=today">Generar Flyer</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/flyers">Galería</Link>
            </Button>
          </div>
        ) : null}
      </div>
      <DailyMenuToggles
        restaurantId={restaurantId}
        dailyMenuId={selection.id}
        packagePrice={Number(selection.package_price)}
        maxSides={selection.max_sides}
        pricingMode={
          selection.pricing_mode === "individual" ? "individual" : "package"
        }
        isActive={selection.is_active !== false}
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
