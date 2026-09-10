"use client";

import { useEffect, useState } from "react";
import type { Restaurant } from "@/lib/types";
import type { PlanPricesMap, PlanType } from "@/lib/plans";
import { FALLBACK_PLAN_PRICES, PLAN_LABELS } from "@/lib/plans";
import { formatMxn } from "@/lib/money";
import { Bell } from "lucide-react";
import { buildWaMeUrl } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Emoji } from "@/components/ui-emoji";
import { UI_EMOJI } from "@/lib/ui-emoji";
import { formatMexicoCityDate } from "@/lib/dates";
import {
  isInCommercialCourtesyPeriod,
  resolveEffectiveMonthlyPrice,
} from "@/lib/commercial-offer";

function formatEndDate(iso: string | null | undefined): string {
  if (!iso) return "sin fecha";
  return formatMexicoCityDate(iso, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function buildPaymentReminderMessage(
  restaurant: Restaurant,
  prices: PlanPricesMap = FALLBACK_PLAN_PRICES,
  hasPayments = true,
): string {
  const plan = (restaurant.plan_type || "catalog") as PlanType;
  const planLabel = PLAN_LABELS[plan] ?? plan;
  const price = resolveEffectiveMonthlyPrice(restaurant, prices, plan);
  const end = formatEndDate(restaurant.subscription_end_date);
  const name = restaurant.owner_name ? ` ${restaurant.owner_name}` : "";
  const label =
    restaurant.commercial_offer_label?.trim() || "Menú al Día";

  if (isInCommercialCourtesyPeriod(restaurant, hasPayments)) {
    return [
      `¡Hola${name}!`,
      "",
      `Recuerda que estás disfrutando de tu periodo gratis de Menú al Día (${label}).`,
      "",
      `Tu próximo ciclo inicia el *${end}* por *${formatMxn(price)}* MXN.`,
      "",
      "Cuando se acerque esa fecha te compartimos los datos SPEI. ¡Gracias!",
    ].join("\n");
  }

  return [
    `Hola${name},`,
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

  async function openReminder() {
    let hasPayments = true;
    try {
      const res = await fetch(
        `/api/super-admin/payments?restaurant_id=${restaurant.id}`,
      );
      if (res.ok) {
        const json = (await res.json()) as { payments?: unknown[] };
        hasPayments = (json.payments?.length ?? 0) > 0;
      }
    } catch {
      hasPayments = true;
    }
    const message = buildPaymentReminderMessage(
      restaurant,
      planPrices,
      hasPayments,
    );
    const url = buildWaMeUrl(restaurant.phone_whatsapp || "", message);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size={size}
      className={compact ? "min-h-9 px-2" : undefined}
      onClick={() => void openReminder()}
      title="Enviar recordatorio por WhatsApp"
    >
      {compact ? (
        <Bell className="h-4 w-4" />
      ) : (
        <>
          <Emoji char={UI_EMOJI.remind} />
          Recordatorio
        </>
      )}
    </Button>
  );
}
