import type { Metadata, Viewport } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { TermsAcceptanceGate } from "@/components/admin/terms-acceptance-gate";
import { PwaRegister } from "@/components/admin/pwa-register";
import { getSessionRestaurant } from "@/lib/restaurant";
import { createClient } from "@/lib/supabase/server";
import { getLandingContent } from "@/lib/landing-content";
import { buildWaMeUrl, resolveSalesWhatsApp } from "@/lib/whatsapp";
import {
  onboardingFlags,
  onboardingScoreFromFlags,
} from "@/lib/super-admin-crm";
import type { PlanType } from "@/lib/plans";

export const metadata: Metadata = {
  manifest: "/admin/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/menualdia-icon.svg", type: "image/svg+xml" },
      {
        url: "/brand/menualdia-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/brand/menualdia-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/brand/menualdia-apple-180.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "MenuAlDía Admin",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
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

  const supabase = await createClient();
  const [{ count: dishCount }, { count: categoryCount }, landing] =
    await Promise.all([
      supabase
        .from("dishes")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", session.restaurant.id)
        .is("archived_at", null),
      supabase
        .from("categories")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", session.restaurant.id),
      getLandingContent(),
    ]);

  const flags = onboardingFlags({
    logoUrl: session.restaurant.logo_url,
    themeConfig: session.restaurant.theme_config,
    dishCount: dishCount ?? 0,
    phoneWhatsapp: session.restaurant.phone_whatsapp,
    categoryCount: categoryCount ?? 0,
  });
  const score = onboardingScoreFromFlags(flags);
  const created = new Date(session.restaurant.created_at).getTime();
  const within14d =
    Number.isFinite(created) && Date.now() - created <= 14 * 24 * 60 * 60 * 1000;
  const salesPhone = resolveSalesWhatsApp(landing.salesWhatsApp);
  const salesHelpUrl =
    !session.supportMode && within14d && salesPhone
      ? buildWaMeUrl(
          salesPhone,
          `Hola, te escribe ${session.restaurant.name}. ¿Me ayudas a dejar listo mi menú en Menú al Día?`,
        )
      : null;

  const shell = (
    <>
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
        isFoundingPartner={session.restaurant.is_founding_partner === true}
        supportMode={session.supportMode === true}
        onboardingScore={score}
        onboardingFlags={score < 100 ? flags : null}
        salesHelpUrl={salesHelpUrl}
      >
        {children}
      </AdminShell>
    </>
  );

  if (session.supportMode) {
    return shell;
  }

  return (
    <TermsAcceptanceGate
      restaurantId={session.restaurant.id}
      termsVersionAccepted={session.restaurant.terms_version_accepted}
    >
      {shell}
    </TermsAcceptanceGate>
  );
}
