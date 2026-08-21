import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { TermsAcceptanceGate } from "@/components/admin/terms-acceptance-gate";
import { PwaRegister } from "@/components/admin/pwa-register";
import { getSessionRestaurant } from "@/lib/restaurant";
import type { PlanType } from "@/lib/plans";

export const metadata: Metadata = {
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MenuAlDía Admin",
    statusBarStyle: "default",
  },
  themeColor: "#0f766e",
};

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
      <PwaRegister />
      <AdminShell
        restaurantName={session.restaurant.name}
        restaurantSlug={session.restaurant.slug}
        planType={(session.restaurant.plan_type as PlanType) || "catalog"}
        isActive={session.restaurant.is_active !== false}
        subscriptionEndDate={session.restaurant.subscription_end_date}
        graceEndsAt={session.restaurant.grace_ends_at}
        purgeScheduledAt={session.restaurant.purge_scheduled_at}
        purgedAt={session.restaurant.purged_at}
        businessType={session.restaurant.business_type}
      >
        {children}
      </AdminShell>
    </TermsAcceptanceGate>
  );
}
