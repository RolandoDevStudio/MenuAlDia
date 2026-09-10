"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  History,
  ImageIcon,
  Images,
  Megaphone,
  Menu,
  MessageCircle,
  Package,
  QrCode,
  Settings,
  ShoppingBag,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PlanType } from "@/lib/plans";
import { can } from "@/lib/plans";
import { label } from "@/lib/business-labels";
import type { BusinessType } from "@/lib/types";

type MoreGroup = "difusion" | "ops" | "insights" | "system";

type MoreItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  feature?: "daily_menu" | "flyer" | "combos" | "crm" | "analytics";
  group: MoreGroup;
};

function routeIsActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminMoreMenu({
  open,
  onOpenChange,
  planType,
  businessType = "restaurante",
  hideHrefs = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  planType: PlanType;
  businessType?: BusinessType | string | null;
  hideHrefs?: string[];
}) {
  const pathname = usePathname();

  const pathnameRef = useRef(pathname);
  useEffect(() => {
    if (pathnameRef.current === pathname) return;
    pathnameRef.current = pathname;
    onOpenChange(false);
  }, [pathname, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const items: MoreItem[] = [
    {
      href: "/admin/difusion",
      label: "Mensaje",
      icon: MessageCircle,
      group: "difusion",
    },
    {
      href: "/admin/difusion/kit",
      label: "Kit",
      icon: QrCode,
      group: "difusion",
    },
    {
      href: "/admin/flyer",
      label: "Flyer",
      icon: ImageIcon,
      feature: "flyer",
      group: "difusion",
    },
    {
      href: "/admin/flyers",
      label: "Galería",
      icon: Images,
      feature: "flyer",
      group: "difusion",
    },
    {
      href: "/admin/combos",
      label: label(businessType, "combos"),
      icon: Package,
      feature: "combos",
      group: "ops",
    },
    {
      href: "/admin/orders",
      label: "Pedidos",
      icon: ShoppingBag,
      feature: "crm",
      group: "ops",
    },
    {
      href: "/admin/history",
      label: "Historial",
      icon: History,
      group: "ops",
    },
    {
      href: "/admin/promociones",
      label: "Promos",
      icon: Megaphone,
      group: "ops",
    },
    {
      href: "/admin/analytics",
      label: "Métricas",
      icon: BarChart3,
      feature: "analytics",
      group: "insights",
    },
    {
      href: "/admin/settings",
      label: "Ajustes",
      icon: Settings,
      group: "system",
    },
  ];

  const difusionIsPrimary = hideHrefs.includes("/admin/difusion");
  const visible = items.filter((item) => {
    if (item.feature && !can(planType, item.feature)) return false;
    if (hideHrefs.includes(item.href)) return false;
    if (difusionIsPrimary && item.group === "difusion") return false;
    return true;
  });

  const groups: { id: MoreGroup; title: string }[] = [
    { id: "difusion", title: "Difusión" },
    { id: "ops", title: "Operación" },
    { id: "insights", title: "Insights" },
    { id: "system", title: "Sistema" },
  ];

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-x-0 top-0 z-40 bg-black/40 print:hidden"
        style={{
          bottom:
            "calc(3.25rem + max(0.5rem, env(safe-area-inset-bottom)))",
        }}
        aria-label="Cerrar menú"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          "fixed z-50 flex max-h-[min(70dvh,calc(100dvh-8.5rem))] flex-col overflow-hidden border border-black/10 bg-surface shadow-xl print:hidden animate-[rise_160ms_ease-out]",
          "inset-x-3 rounded-2xl",
          "bottom-[calc(3.75rem+max(0.5rem,env(safe-area-inset-bottom)))]",
          "md:inset-x-auto md:w-80 lg:w-84",
          "md:right-[max(0.75rem,calc((100vw-42rem)/2+0.5rem))]",
          "lg:right-[max(0.75rem,calc((100vw-64rem)/2+0.5rem))]",
          "md:max-h-[min(70vh,32rem)]",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Más opciones"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black/5 px-3 py-1.5 md:px-4 md:py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-1 w-8 rounded-full bg-black/15 md:hidden"
              aria-hidden
            />
            <p className="text-sm font-semibold">Más</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 md:min-h-9 md:min-w-9"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-2 py-2">
          {groups.map((group) => {
            const rows = visible.filter((item) => item.group === group.id);
            if (!rows.length) return null;
            const asGrid = group.id === "difusion";
            return (
              <div key={group.id} className="mb-2 last:mb-0">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {group.title}
                </p>
                {asGrid ? (
                  <ul
                    className={cn(
                      "grid gap-1.5 px-1",
                      rows.length === 1 ? "grid-cols-1" : "grid-cols-2",
                    )}
                  >
                    {rows.map((item) => (
                      <li key={item.href}>
                        <MoreLink
                          item={item}
                          pathname={pathname}
                          onNavigate={() => onOpenChange(false)}
                          compact
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="space-y-0.5">
                    {rows.map((item) => (
                      <li key={item.href}>
                        <MoreLink
                          item={item}
                          pathname={pathname}
                          onNavigate={() => onOpenChange(false)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function MoreLink({
  item,
  pathname,
  onNavigate,
  compact = false,
}: {
  item: MoreItem;
  pathname: string;
  onNavigate: () => void;
  compact?: boolean;
}) {
  const active = routeIsActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-xl text-sm font-medium",
        compact
          ? "min-h-12 px-3 py-2.5"
          : "min-h-11 px-3",
        active
          ? "bg-brand/10 text-brand"
          : compact
            ? "bg-black/4 text-foreground hover:bg-black/10"
            : "text-foreground hover:bg-black/4",
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function MoreNavButton({
  active,
  expanded,
  onClick,
}: {
  active: boolean;
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-haspopup="dialog"
      className={cn(
        "flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1 text-[10px] font-medium",
        active ? "text-brand" : "text-muted",
      )}
    >
      <Menu className="h-5 w-5" />
      Más
    </button>
  );
}
