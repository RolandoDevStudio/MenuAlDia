"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  History,
  ImageIcon,
  LayoutGrid,
  LogOut,
  Settings,
  ShoppingBag,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PlanType } from "@/lib/plans";
import { can, PLAN_LABELS, isSubscriptionActive } from "@/lib/plans";
import { label } from "@/lib/business-labels";
import type { BusinessType } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  feature?: "daily_menu" | "flyer" | "crm" | "analytics";
};

export function AdminShell({
  restaurantName,
  planType,
  isActive,
  subscriptionEndDate,
  businessType = "restaurante",
  children,
}: {
  restaurantName: string;
  planType: PlanType;
  isActive: boolean;
  subscriptionEndDate: string;
  businessType?: BusinessType | string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const subOk = isSubscriptionActive({
    is_active: isActive,
    subscription_end_date: subscriptionEndDate,
  });

  const dailyMenuLabel = label(businessType, "dailyMenu");
  const catalogLabel = label(businessType, "catalog");
  // Bottom nav needs a short label; full dailyMenu strings are too long.
  const todayNavLabel = dailyMenuLabel.length <= 8 ? dailyMenuLabel : "Hoy";

  const links: NavItem[] = [
    {
      href: "/admin",
      label: todayNavLabel,
      icon: UtensilsCrossed,
      feature: "daily_menu",
    },
    { href: "/admin/catalog", label: catalogLabel, icon: LayoutGrid },
    { href: "/admin/flyer", label: "Flyer", icon: ImageIcon, feature: "flyer" },
    { href: "/admin/orders", label: "Pedidos", icon: ShoppingBag, feature: "crm" },
    { href: "/admin/customers", label: "Clientes", icon: Users, feature: "crm" },
    {
      href: "/admin/analytics",
      label: "Métricas",
      icon: BarChart3,
      feature: "analytics",
    },
    { href: "/admin/history", label: "Historial", icon: History },
    { href: "/admin/settings", label: "Ajustes", icon: Settings },
  ];

  const visible = links.filter(
    (l) => !l.feature || can(planType, l.feature),
  );

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div
      className="mx-auto flex min-h-full w-full max-w-lg flex-col"
      style={{
        paddingBottom: "calc(6rem + env(safe-area-inset-bottom))",
      }}
    >
      <header className="sticky top-0 z-20 border-b border-black/5 bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-[family-name:var(--font-display)] text-2xl text-brand">
              Menú al Día
            </p>
            <p className="truncate text-xs text-muted">
              {restaurantName} · {PLAN_LABELS[planType]}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Salir">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
        {!subOk ? (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            Suscripción inactiva o vencida. Tu menú público está oculto. Contacta
            a soporte para renovar.
          </p>
        ) : null}
      </header>
      <div className="flex-1 px-4 py-4">{children}</div>
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-black/10 bg-surface/95 backdrop-blur"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-lg justify-around overflow-x-auto px-1 pt-2">
          {visible.map(({ href, label: navLabel, icon: Icon }) => {
            const active =
              href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
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
        </div>
      </nav>
    </div>
  );
}
