import { requireTenantSession } from "@/lib/admin-session";
import { can } from "@/lib/plans";
import { PlanGate } from "@/components/admin/plan-gate";
import { FlyersGallery } from "@/components/admin/flyers-gallery";

export default async function AdminFlyersPage() {
  const session = await requireTenantSession();
  const plan = session.restaurant.plan_type || "catalog";

  if (!can(plan, "flyer")) {
    return (
      <PlanGate plan={plan} feature="flyer" title="Galería de flyers">
        {null}
      </PlanGate>
    );
  }

  return (
    <FlyersGallery
      restaurantId={session.restaurant.id}
      restaurantSlug={session.restaurant.slug}
      restaurantName={session.restaurant.name}
      phoneWhatsapp={session.restaurant.phone_whatsapp || ""}
    />
  );
}
