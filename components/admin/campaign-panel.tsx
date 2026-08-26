"use client";

import { useMemo, useState } from "react";
import { Cake, AlertTriangle, UserX } from "lucide-react";
import type { Customer } from "@/lib/types";
import {
  CAMPAIGN_FILTER_LABELS,
  type CampaignFilter,
  buildCampaignMessage,
  campaignCounts,
  filterCampaignCustomers,
  openCampaignWhatsApp,
  templateKindForFilter,
} from "@/lib/crm-campaigns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Emoji } from "@/components/ui-emoji";
import { UI_EMOJI } from "@/lib/ui-emoji";

type Props = {
  customers: Customer[];
  businessName: string;
  activeFilter: CampaignFilter;
  onFilterChange: (f: CampaignFilter) => void;
};

const FILTER_ICONS: Record<
  Exclude<CampaignFilter, "all">,
  React.ComponentType<{ className?: string }>
> = {
  inactive: UserX,
  birthday: Cake,
  risk: AlertTriangle,
};

export function CampaignPanel({
  customers,
  businessName,
  activeFilter,
  onFilterChange,
}: Props) {
  const counts = useMemo(() => campaignCounts(customers), [customers]);
  const [discountHint, setDiscountHint] = useState(
    "Presenta este mensaje y recibe 10% de descuento en tu próxima visita",
  );

  const campaignList = useMemo(() => {
    if (activeFilter === "all") return [] as Customer[];
    return filterCampaignCustomers(customers, activeFilter).filter((c) =>
      Boolean(c.phone?.trim()),
    );
  }, [customers, activeFilter]);

  function sendTo(c: Customer) {
    if (!c.phone?.trim()) return;
    const msg = buildCampaignMessage({
      kind: templateKindForFilter(activeFilter),
      customerName: c.name,
      businessName,
      discountHint,
    });
    openCampaignWhatsApp(c.phone, msg);
  }

  return (
    <div className="space-y-3 rounded-xl border border-black/5 bg-surface p-3">
      <div>
        <h2 className="text-sm font-semibold">Campañas</h2>
        <p className="text-xs text-muted">
          Filtra y manda plantillas de WhatsApp en 1 toque.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["inactive", counts.inactive],
            ["birthday", counts.birthday],
            ["risk", counts.risk],
          ] as const
        ).map(([key, n]) => {
          const Icon = FILTER_ICONS[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() =>
                onFilterChange(activeFilter === key ? "all" : key)
              }
              className={cn(
                "rounded-xl border px-2 py-2 text-left transition",
                activeFilter === key
                  ? "border-brand bg-brand/5"
                  : "border-black/5 bg-background/60",
              )}
            >
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                <Icon className="h-3 w-3" />
                {CAMPAIGN_FILTER_LABELS[key].split(" ")[0]}
              </p>
              <p className="text-lg font-semibold tabular-nums">{n}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(CAMPAIGN_FILTER_LABELS) as CampaignFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onFilterChange(f)}
            className={cn(
              "min-h-9 rounded-lg px-2.5 text-xs font-semibold",
              activeFilter === f
                ? "bg-brand text-white"
                : "bg-background text-muted hover:text-foreground",
            )}
          >
            {CAMPAIGN_FILTER_LABELS[f]}
            {f === "inactive"
              ? ` (${counts.inactive})`
              : f === "birthday"
                ? ` (${counts.birthday})`
                : f === "risk"
                  ? ` (${counts.risk})`
                  : ""}
          </button>
        ))}
      </div>

      {activeFilter !== "all" ? (
        <div className="space-y-2 border-t border-black/5 pt-3">
          <div className="space-y-1">
            <Label htmlFor="campaign-offer">Oferta en la plantilla</Label>
            <Input
              id="campaign-offer"
              value={discountHint}
              onChange={(e) => setDiscountHint(e.target.value)}
            />
          </div>
          {campaignList.length === 0 ? (
            <p className="text-xs text-muted">
              Nadie en este filtro con teléfono. Agrega números en las fichas.
            </p>
          ) : (
            <ul className="max-h-40 space-y-1.5 overflow-y-auto">
              {campaignList.slice(0, 40).map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-black/5 px-2 py-1.5 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">{c.name}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => sendTo(c)}
                  >
                    <Emoji char={UI_EMOJI.whatsapp} />
                    WA
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
