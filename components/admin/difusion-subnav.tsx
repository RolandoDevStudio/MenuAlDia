import { requireTenantSession } from "@/lib/admin-session";
import { can } from "@/lib/plans";
import { DifusionSubnavTabs } from "@/components/admin/difusion-subnav-tabs";

export async function DifusionSubnav() {
  const session = await requireTenantSession();
  const plan = session.restaurant.plan_type || "catalog";
  return <DifusionSubnavTabs showFlyerTabs={can(plan, "flyer")} />;
}
