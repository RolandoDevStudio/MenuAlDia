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
import { AdminQuickActions } from "@/components/admin/admin-quick-actions";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/plans";
import { labelsFor } from "@/lib/business-labels";
import { effectiveAcceptingOrders } from "@/lib/store-hours";
import type { Dish } from "@/lib/types";

export default async function AdminDashboardPage() {
  const session = await requireTenantSession();

  const plan = session.restaurant.plan_type || "catalog";
  const businessType = session.restaurant.business_type;
  const labels = labelsFor(businessType);
  const restaurantId = session.restaurant.id;
  const isOpen = effectiveAcceptingOrders(session.restaurant);

  const [impact, ops] = await Promise.all([
    getAdminImpactStats(restaurantId, plan),
    getAdminOpsStats(
      restaurantId,
      plan,
      session.restaurant.subscription_end_date,
    ),
  ]);

  const banner = (
    <AdminMorningBanner
      restaurantName={session.restaurant.name}
      publicSlug={session.restaurant.slug}
      initialAcceptingOrders={session.restaurant.accepting_orders !== false}
      logoUrl={session.restaurant.logo_url}
      scheduleAuto={Boolean(session.restaurant.schedule_auto)}
      scheduleHours={session.restaurant.schedule_hours}
      initialOverride={session.restaurant.orders_override ?? null}
      initialClosedMessage={session.restaurant.closed_message ?? ""}
    />
  );

  if (!can(plan, "daily_menu")) {
    return (
      <div className="space-y-4">
        {banner}
        <AdminOpsKpis stats={ops} businessType={businessType} />
        <AdminQuickActions plan={plan} dishLabel={labels.dish} />
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
        {banner}
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

  const dailyBlock = (
    <>
      <div>
        <h1 className="text-lg font-semibold">{labels.dailyMenu}</h1>
        <p className="text-sm text-muted">
          Marca las <strong>opciones</strong> de hoy. El cliente elige una y
          (si aplica) {labels.sides.toLowerCase()}.
        </p>
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
    </>
  );

  return (
    <div className="space-y-4">
      {banner}

      {!isOpen ? (
        <div className="rounded-xl border border-stone-300 bg-stone-100 px-3 py-3 text-sm text-stone-800">
          <p className="font-semibold">Negocio cerrado</p>
          <p className="mt-1 text-xs text-stone-600">
            Puedes seguir preparando el menú de hoy o de mañana. Ajusta horario
            automático cuando quieras.
          </p>
          <Button asChild size="sm" variant="secondary" className="mt-2">
            <Link href="/admin/settings#horario">Ir a horario</Link>
          </Button>
        </div>
      ) : null}

      {dailyBlock}

      <AdminOpsKpis stats={ops} businessType={businessType} />
      <ImpactCard stats={impact} plan={plan} />
      <AdminQuickActions plan={plan} dishLabel={labels.dish} />
    </div>
  );
}
