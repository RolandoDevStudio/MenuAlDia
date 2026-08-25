"use client";

import { useEffect, useState } from "react";
import type { Restaurant } from "@/lib/types";
import type { PlanPricesMap, PlanType } from "@/lib/plans";
import { FALLBACK_PLAN_PRICES, PLAN_LABELS } from "@/lib/plans";
import { formatMxn } from "@/lib/money";
import { Bell } from "lucide-react";
import { buildWaMeUrl } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";

function formatEndDate(iso: string | null | undefined): string {
  if (!iso) return "sin fecha";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function buildPaymentReminderMessage(
  restaurant: Restaurant,
  prices: PlanPricesMap = FALLBACK_PLAN_PRICES,
): string {
  const plan = (restaurant.plan_type || "catalog") as PlanType;
  const planLabel = PLAN_LABELS[plan] ?? plan;
  const price =
    prices[plan]?.monthly ?? FALLBACK_PLAN_PRICES[plan]?.monthly ?? 0;
  const end = formatEndDate(restaurant.subscription_end_date);

  return [
    `Hola${restaurant.owner_name ? ` ${restaurant.owner_name}` : ""},`,
    "",
    `Te escribo de menualdia.app respecto a *${restaurant.name}*.`,
    "",
    `Tu plan *${planLabel}* (${formatMxn(price)} MXN/mes) vence el *${end}*.`,
    "",
    "Te recordamos amablemente renovar tu suscripción para que tu menú siga activo sin interrupciones.",
    "",
    "Cuando puedas, avísanos para confirmar el pago. ¡Gracias!",
  ].join("\n");
}

export function RemindPaymentButton({
  restaurant,
  size = "sm",
  compact = false,
}: {
  restaurant: Restaurant;
  size?: "sm" | "default";
  compact?: boolean;
}) {
  const [planPrices, setPlanPrices] =
    useState<PlanPricesMap>(FALLBACK_PLAN_PRICES);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/plan-prices");
      if (!res.ok) return;
      const prices = (await res.json()) as PlanPricesMap;
      setPlanPrices({
        catalog: prices.catalog ?? FALLBACK_PLAN_PRICES.catalog,
        daily: prices.daily ?? FALLBACK_PLAN_PRICES.daily,
        pro: prices.pro ?? FALLBACK_PLAN_PRICES.pro,
      });
    })();
  }, []);

  function openReminder() {
    const message = buildPaymentReminderMessage(restaurant, planPrices);
    const url = buildWaMeUrl(restaurant.phone_whatsapp || "", message);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={openReminder}
      className={compact ? "min-h-10 w-10 px-0" : undefined}
      title="Recordar pago por WhatsApp"
      aria-label="Recordar pago por WhatsApp"
    >
      {compact ? <Bell className="h-4 w-4" /> : "Recordar Pago"}
    </Button>
  );
}
