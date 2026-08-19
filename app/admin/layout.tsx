import { AdminShell } from "@/components/admin/admin-shell";
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
    <AdminShell
      restaurantName={session.restaurant.name}
      planType={(session.restaurant.plan_type as PlanType) || "catalog"}
      isActive={session.restaurant.is_active !== false}
      subscriptionEndDate={session.restaurant.subscription_end_date}
      businessType={session.restaurant.business_type}
    >
      {children}
    </AdminShell>
  );
}
