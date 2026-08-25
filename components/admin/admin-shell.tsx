"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Toaster } from "sonner";
import {
  ExternalLink,
  LayoutGrid,
  LogOut,
  Megaphone,
  Package,
  Sparkles,
  Store,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PlanType } from "@/lib/plans";
import { can, PLAN_LABELS, isSubscriptionActive } from "@/lib/plans";
import {
  daysUntil,
  getLifecyclePhase,
} from "@/lib/subscription-lifecycle";
import { label, normalizeBusinessType } from "@/lib/business-labels";
import type { BusinessType } from "@/lib/types";
import { BrandLogo } from "@/components/brand/brand-logo";
import { NotificationBell } from "@/components/admin/notification-bell";
import { PwaInstallBanner } from "@/components/admin/pwa-install-banner";
import {
  AdminMoreMenu,
  MoreNavButton,
} from "@/components/admin/admin-more-menu";

type PrimaryItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: (pathname: string) => boolean;
};

export function AdminShell({
  restaurantName,
  restaurantSlug,
  planType,
  isActive,
  subscriptionEndDate,
  graceEndsAt = null,
  purgeScheduledAt = null,
  purgedAt = null,
  businessType = "restaurante",
  isFoundingPartner = false,
  children,
}: {
  restaurantName: string;
  restaurantSlug: string;
  planType: PlanType;
  isActive: boolean;
  subscriptionEndDate: string;
  graceEndsAt?: string | null;
  purgeScheduledAt?: string | null;
  purgedAt?: string | null;
  businessType?: BusinessType | string | null;
  isFoundingPartner?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  const subOk = isSubscriptionActive({
    is_active: isActive,
    subscription_end_date: subscriptionEndDate,
  });
  const phase = getLifecyclePhase({
    is_active: isActive,
    subscription_end_date: subscriptionEndDate,
    grace_ends_at: graceEndsAt,
    purge_scheduled_at: purgeScheduledAt,
    purged_at: purgedAt,
  });
  const graceDaysLeft = daysUntil(graceEndsAt);
  const purgeDaysLeft = daysUntil(purgeScheduledAt);
  const showExport =
    phase === "expired_grace" ||
    phase === "expired_pre_purge" ||
    phase === "purge_due";

  const dailyMenuLabel = label(businessType, "dailyMenu");
  const catalogLabel = label(businessType, "catalog");
  const todayNavLabel = dailyMenuLabel.length <= 8 ? dailyMenuLabel : "Hoy";
  const giro = normalizeBusinessType(businessType);
  const TodayIcon =
    giro === "servicios"
      ? Sparkles
      : giro === "productos"
        ? Store
        : UtensilsCrossed;
  const hasDaily = can(planType, "daily_menu");
  const hasFlyer = can(planType, "flyer");
  const hasCrm = can(planType, "crm");
  const hasCombos = can(planType, "combos");

  const primary: PrimaryItem[] = [];

  if (hasDaily) {
    primary.push({
      href: "/admin",
      label: todayNavLabel,
      icon: TodayIcon,
      match: (p) => p === "/admin",
    });
  }

  primary.push({
    href: "/admin/catalog",
    label: catalogLabel,
    icon: LayoutGrid,
    match: (p) => p.startsWith("/admin/catalog"),
  });

  if (hasFlyer) {
    primary.push({
      href: "/admin/difusion",
      label: "Difusión",
      icon: Megaphone,
      match: (p) =>
        p.startsWith("/admin/difusion") ||
        p.startsWith("/admin/flyer"),
    });
  } else if (hasCombos) {
    primary.push({
      href: "/admin/combos",
      label: label(businessType, "combos"),
      icon: Package,
      match: (p) => p.startsWith("/admin/combos"),
    });
  } else {
    primary.push({
      href: "/admin/promociones",
      label: "Promos",
      icon: Megaphone,
      match: (p) => p.startsWith("/admin/promociones"),
    });
  }

  if (hasCrm) {
    primary.push({
      href: "/admin/customers",
      label: "Clientes",
      icon: Users,
      match: (p) => p.startsWith("/admin/customers"),
    });
  } else if (hasCombos && hasFlyer) {
    primary.push({
      href: "/admin/combos",
      label: label(businessType, "combos"),
      icon: Package,
      match: (p) => p.startsWith("/admin/combos"),
    });
  } else if (!hasFlyer) {
    /* already used promos/combos in slot 3 */
  } else {
    primary.push({
      href: "/admin/promociones",
      label: "Promos",
      icon: Megaphone,
      match: (p) => p.startsWith("/admin/promociones"),
    });
  }

  // Cap at 4 primary + Más
  const primarySlots = primary.slice(0, 4);

  const moreActive =
    moreOpen ||
    [
      "/admin/combos",
      "/admin/orders",
      "/admin/history",
      "/admin/promociones",
      "/admin/analytics",
      "/admin/settings",
    ].some((h) => {
      // Don't highlight Más if that route is already a primary slot
      if (primarySlots.some((p) => p.href === h && pathname.startsWith(h))) {
        return false;
      }
      return pathname.startsWith(h);
    });

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col pb-[calc(6rem+env(safe-area-inset-bottom))] md:max-w-2xl lg:max-w-5xl print:max-w-none print:pb-0">
      <Toaster richColors position="top-center" closeButton />
      <header className="sticky top-0 z-20 border-b border-black/5 bg-background/95 px-4 py-3 backdrop-blur print:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <BrandLogo variant="lockup" size="sm" href="/admin" />
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <span className="truncate">
                {restaurantName} · {PLAN_LABELS[planType]}
              </span>
              {isFoundingPartner ? (
                <span className="inline-flex shrink-0 items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950">
                  Socio fundador
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <NotificationBell />
            <Button variant="ghost" size="sm" className="min-h-11 gap-1.5 px-2" asChild>
              <a
                href={`/${restaurantSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                title={
                  subOk
                    ? "Ver menú como el cliente"
                    : "Menú público oculto (suscripción inactiva)"
                }
              >
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">Ver menú</span>
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              aria-label="Salir"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
        {!subOk ? (
          <div className="mt-2 space-y-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950">
            {phase === "expired_grace" ? (
              <p>
                Suscripción inactiva. Menú público oculto.{" "}
                {graceDaysLeft != null && graceDaysLeft > 0
                  ? `Te quedan ~${graceDaysLeft} días de gracia para exportar datos.`
                  : "Estás en periodo de gracia: exporta tus datos pronto."}
              </p>
            ) : phase === "purge_due" || phase === "expired_pre_purge" ? (
              <p>
                Periodo de gracia terminado.{" "}
                {purgeDaysLeft != null && purgeDaysLeft > 0
                  ? `Purga programada en ~${purgeDaysLeft} días.`
                  : "Tus datos pueden purgarse pronto."}{" "}
                Renueva con soporte o exporta lo que puedas.
              </p>
            ) : (
              <p>
                Suscripción inactiva o vencida. Tu menú público está oculto.
                Contacta a soporte para renovar.
              </p>
            )}
            {showExport ? (
              <p className="flex flex-wrap gap-x-3 gap-y-1">
                <a
                  href="/api/admin/export?type=customers"
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  Exportar clientes CSV
                </a>
                <a
                  href="/api/admin/export?type=orders"
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  Exportar pedidos CSV
                </a>
                <Link
                  href="/admin/settings"
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  Solicitar plan
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="print:hidden">
          <PwaInstallBanner />
        </div>
      </header>
      <div className="flex-1 px-4 py-4 print:px-0 print:py-0">{children}</div>
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-black/10 bg-surface/95 backdrop-blur print:hidden"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-lg justify-around px-1 pt-2 md:max-w-2xl lg:max-w-5xl">
          {primarySlots.map(({ href, label: navLabel, icon: Icon, match }) => {
            const active = match ? match(pathname) : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-h-11 min-w-[3.5rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1 text-[10px] font-medium",
                  active ? "text-brand" : "text-muted",
                )}
              >
                <Icon className="h-5 w-5" />
                {navLabel}
              </Link>
            );
          })}
          <MoreNavButton
            active={moreActive}
            onClick={() => setMoreOpen((v) => !v)}
          />
        </div>
      </nav>
      <AdminMoreMenu
        open={moreOpen}
        onOpenChange={setMoreOpen}
        planType={planType}
        businessType={businessType}
        hideHrefs={primarySlots.map((p) => p.href)}
      />
    </div>
  );
}
