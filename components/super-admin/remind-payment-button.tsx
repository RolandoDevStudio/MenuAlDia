"use client";

import type { Restaurant } from "@/lib/types";
import type { PlanType } from "@/lib/plans";
import { PLAN_LABELS, PLAN_PRICES_MXN } from "@/lib/plans";
import { formatMxn } from "@/lib/money";
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

export function buildPaymentReminderMessage(restaurant: Restaurant): string {
  const plan = (restaurant.plan_type || "catalog") as PlanType;
  const planLabel = PLAN_LABELS[plan] ?? plan;
  const price = PLAN_PRICES_MXN[plan] ?? 0;
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
}: {
  restaurant: Restaurant;
  size?: "sm" | "default";
}) {
  function openReminder() {
    const message = buildPaymentReminderMessage(restaurant);
    const url = buildWaMeUrl(restaurant.phone_whatsapp || "", message);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <Button type="button" variant="outline" size={size} onClick={openReminder}>
      Recordar Pago
    </Button>
  );
}
