"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  History,
  ImageIcon,
  Megaphone,
  Menu,
  Package,
  Settings,
  ShoppingBag,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PlanType } from "@/lib/plans";
import { can } from "@/lib/plans";
import { label } from "@/lib/business-labels";
import type { BusinessType } from "@/lib/types";

type MoreItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  feature?: "daily_menu" | "flyer" | "combos" | "crm" | "analytics";
  group: "ops" | "insights" | "system";
};

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

  const items: MoreItem[] = [
    {
      href: "/admin/difusion",
      label: "Difusión",
      icon: Megaphone,
      group: "ops",
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

  const visible = items.filter(
    (l) =>
      (!l.feature || can(planType, l.feature)) &&
      !hideHrefs.includes(l.href),
  );

  const groups: { id: MoreItem["group"]; title: string }[] = [
    { id: "ops", title: "Operación" },
    { id: "insights", title: "Insights" },
    { id: "system", title: "Sistema" },
  ];

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/40 print:hidden"
        aria-label="Cerrar menú"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          "fixed z-50 border border-black/10 bg-surface shadow-xl print:hidden",
          "inset-x-0 bottom-0 max-h-[75dvh] rounded-t-2xl",
          "md:inset-x-auto md:bottom-20 md:right-[max(0.75rem,calc((100vw-42rem)/2+0.5rem))] md:w-80 md:max-h-[70vh] md:rounded-2xl",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Más opciones"
      >
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
          <p className="text-sm font-semibold">Más</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="overflow-y-auto px-2 py-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {groups.map((g) => {
            const rows = visible.filter((i) => i.group === g.id);
            if (!rows.length) return null;
            return (
              <div key={g.id} className="mb-3">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {g.title}
                </p>
                <ul className="space-y-0.5">
                  {rows.map(({ href, label: navLabel, icon: Icon }) => {
                    const active = pathname.startsWith(href);
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          onClick={() => onOpenChange(false)}
                          className={cn(
                            "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium",
                            active
                              ? "bg-brand/10 text-brand"
                              : "text-foreground hover:bg-black/[0.04]",
                          )}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          {navLabel}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          <div className="mb-2 border-t border-black/5 px-3 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Difusión
              </p>
              <p className="mt-1 text-xs text-muted">
                {can(planType, "flyer")
                  ? "Mensaje, Kit, Flyer y Galería están en Difusión."
                  : "Mensaje y Kit están en Difusión."}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href="/admin/difusion"
                  onClick={() => onOpenChange(false)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-black/[0.04] px-2.5 text-xs font-medium"
                >
                  <Megaphone className="h-3.5 w-3.5" /> Mensaje
                </Link>
                <Link
                  href="/admin/difusion/kit"
                  onClick={() => onOpenChange(false)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-black/[0.04] px-2.5 text-xs font-medium"
                >
                  <Megaphone className="h-3.5 w-3.5" /> Kit
                </Link>
                {can(planType, "flyer") ? (
                  <>
                    <Link
                      href="/admin/flyer"
                      onClick={() => onOpenChange(false)}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-black/[0.04] px-2.5 text-xs font-medium"
                    >
                      <ImageIcon className="h-3.5 w-3.5" /> Flyer
                    </Link>
                    <Link
                      href="/admin/flyers"
                      onClick={() => onOpenChange(false)}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-black/[0.04] px-2.5 text-xs font-medium"
                    >
                      <ImageIcon className="h-3.5 w-3.5" /> Galería
                    </Link>
                  </>
                ) : null}
              </div>
            </div>
        </div>
      </div>
    </>
  );
}

export function MoreNavButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-11 min-w-[3.5rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1 text-[10px] font-medium",
        active ? "text-brand" : "text-muted",
      )}
    >
      <Menu className="h-5 w-5" />
      Más
    </button>
  );
}
