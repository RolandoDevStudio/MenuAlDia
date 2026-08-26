import { requireTenantSession } from "@/lib/admin-session";
import { createClient } from "@/lib/supabase/server";
import { BroadcastTools } from "@/components/admin/broadcast-tools";
import { can } from "@/lib/plans";
import { labelsFor, shareCtaFor } from "@/lib/business-labels";
import { getAppOrigin, publicMenuUrl } from "@/lib/site-url";
import { DifusionSubnav } from "@/components/admin/difusion-subnav";
import { Emoji } from "@/components/ui-emoji";
import { UI_EMOJI } from "@/lib/ui-emoji";
import Link from "next/link";

export default async function DifusionPage() {
  const session = await requireTenantSession();
  const plan = session.restaurant.plan_type || "catalog";
  const labels = labelsFor(session.restaurant.business_type);

  const supabase = await createClient();
  const restaurantId = session.restaurant.id;

  let itemNames: string[] = [];
  let packagePrice: number | null = null;

  if (can(plan, "daily_menu")) {
    const { data: selection } = await supabase
      .from("daily_menu_selections")
      .select("id, package_price")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

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
  }

  const menuUrl = publicMenuUrl(session.restaurant.slug, getAppOrigin());

  return (
    <div className="space-y-4">
      <div>
        <DifusionSubnav />
        <h1 className="text-lg font-semibold">
          <Emoji char={UI_EMOJI.broadcast} />
          Difundir
        </h1>
        <p className="text-sm text-muted">
          Comparte tu enlace por WhatsApp. El QR y el material para imprimir
          están en Kit.
        </p>
      </div>

      <BroadcastTools
        businessName={session.restaurant.name}
        menuUrl={menuUrl}
        dailyLabel={labels.dailyMenu}
        itemNames={itemNames}
        packagePrice={packagePrice}
        ownerPhone={session.restaurant.phone_whatsapp}
        shareCta={shareCtaFor(session.restaurant.business_type)}
      />

      <p className="text-sm">
        <Link
          href="/admin/difusion/kit"
          className="font-medium text-brand underline-offset-2 hover:underline"
        >
          Personaliza e imprime en Kit
        </Link>
      </p>
    </div>
  );
}
