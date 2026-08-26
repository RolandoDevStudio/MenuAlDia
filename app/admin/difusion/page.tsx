import { requireTenantSession } from "@/lib/admin-session";
import { createClient } from "@/lib/supabase/server";
import { PlanGate } from "@/components/admin/plan-gate";
import {
  BroadcastTools,
  QrPrintCard,
} from "@/components/admin/broadcast-tools";
import { can } from "@/lib/plans";
import { labelsFor } from "@/lib/business-labels";
import { getAppOrigin, publicMenuUrl } from "@/lib/site-url";
import { DifusionSubnav } from "@/components/admin/difusion-subnav";
import { Emoji } from "@/components/ui-emoji";
import { UI_EMOJI } from "@/lib/ui-emoji";

export default async function DifusionPage() {
  const session = await requireTenantSession();
  const plan = session.restaurant.plan_type || "catalog";
  const labels = labelsFor(session.restaurant.business_type);

  if (!can(plan, "daily_menu") && !can(plan, "flyer")) {
    return (
      <PlanGate plan={plan} feature="flyer" title="Difusión no incluida">
        {null}
      </PlanGate>
    );
  }

  const supabase = await createClient();
  const restaurantId = session.restaurant.id;

  const { data: selection } = await supabase
    .from("daily_menu_selections")
    .select("id, package_price")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  let itemNames: string[] = [];
  let packagePrice: number | null = null;

  if (selection) {
    packagePrice = Number(selection.package_price) || null;
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
    const ids = [
      ...(mainLinks ?? []).map((r) => r.dish_id),
      ...(sideLinks ?? []).map((r) => r.dish_id),
    ];
    if (ids.length > 0) {
      const { data: dishes } = await supabase
        .from("dishes")
        .select("id, name")
        .in("id", ids);
      const byId = new Map((dishes ?? []).map((d) => [d.id, d.name]));
      itemNames = ids
        .map((id) => byId.get(id))
        .filter((n): n is string => Boolean(n));
    }
  }

  const menuUrl = publicMenuUrl(session.restaurant.slug, getAppOrigin());

  return (
    <div className="space-y-4 print:space-y-0">
      <div className="print:hidden">
        <DifusionSubnav />
        <h1 className="text-lg font-semibold">
          <Emoji char={UI_EMOJI.broadcast} />
          Difundir
        </h1>
        <p className="text-sm text-muted">
          Comparte tu menú por WhatsApp e imprime el QR.
        </p>
      </div>

      <div className="print:hidden">
        <BroadcastTools
          businessName={session.restaurant.name}
          menuUrl={menuUrl}
          dailyLabel={labels.dailyMenu}
          itemNames={itemNames}
          packagePrice={packagePrice}
          ownerPhone={session.restaurant.phone_whatsapp}
        />
      </div>

      <QrPrintCard
        businessName={session.restaurant.name}
        menuUrl={menuUrl}
        slogan={session.restaurant.slogan}
      />
    </div>
  );
}
