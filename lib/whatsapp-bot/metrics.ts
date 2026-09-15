import type { createServiceClient } from "@/lib/supabase/admin";

type ServiceClient = ReturnType<typeof createServiceClient>;

/** Approximate Meta conversation rates (USD) for MX — estimates only, not an invoice. */
export const WA_COST_ESTIMATE_USD = {
  service: 0,
  utility: 0.014,
  marketing: 0.045,
} as const;

const USD_TO_MXN = 17.5;

export type WaMetricsSummary = {
  days: number;
  inbound: number;
  outbound: number;
  byCategory: { service: number; utility: number; marketing: number };
  failed: number;
  estimatedUsd: number;
  estimatedMxn: number;
  disclaimer: string;
};

export async function getWhatsappUsageMetrics(
  admin: ServiceClient,
  restaurantId: string,
  days = 30,
): Promise<WaMetricsSummary> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  const { data } = await admin
    .from("wa_message_log")
    .select("direction, category, ok")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", sinceIso)
    .limit(5000);

  const byCategory = { service: 0, utility: 0, marketing: 0 };
  let inbound = 0;
  let outbound = 0;
  let failed = 0;

  for (const row of data ?? []) {
    if (row.direction === "inbound") inbound += 1;
    else {
      outbound += 1;
      const cat = row.category as keyof typeof byCategory;
      if (cat in byCategory) byCategory[cat] += 1;
    }
    if (row.ok === false) failed += 1;
  }

  const estimatedUsd =
    byCategory.service * WA_COST_ESTIMATE_USD.service +
    byCategory.utility * WA_COST_ESTIMATE_USD.utility +
    byCategory.marketing * WA_COST_ESTIMATE_USD.marketing;

  return {
    days,
    inbound,
    outbound,
    byCategory,
    failed,
    estimatedUsd: Math.round(estimatedUsd * 100) / 100,
    estimatedMxn: Math.round(estimatedUsd * USD_TO_MXN),
    disclaimer:
      "Estimado orientativo según tarifas públicas típicas de Meta (México). No es factura oficial; Meta cobra en la tarjeta del negocio según categoría y conversaciones.",
  };
}
