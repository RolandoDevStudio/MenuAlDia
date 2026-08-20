import { AdminShell } from "@/components/admin/admin-shell";
import { TermsAcceptanceGate } from "@/components/admin/terms-acceptance-gate";
import { getSessionRestaurant } from "@/lib/restaurant";
import type { PlanType } from "@/lib/plans";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionRestaurant();

  if (!session) {
    return <>{children}</>;
  }

  return (
    <TermsAcceptanceGate
      restaurantId={session.restaurant.id}
      termsVersionAccepted={session.restaurant.terms_version_accepted}
    >
      <AdminShell
        restaurantName={session.restaurant.name}
        restaurantSlug={session.restaurant.slug}
        planType={(session.restaurant.plan_type as PlanType) || "catalog"}
        isActive={session.restaurant.is_active !== false}
        subscriptionEndDate={session.restaurant.subscription_end_date}
        businessType={session.restaurant.business_type}
      >
        {children}
      </AdminShell>
    </TermsAcceptanceGate>
  );
}
