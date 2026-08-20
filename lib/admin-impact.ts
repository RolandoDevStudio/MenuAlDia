import { createClient } from "@/lib/supabase/server";
import { can, type PlanType } from "@/lib/plans";

export type AdminImpactStats = {
  monthLabel: string;
  /** Flyer download + share + copy + save this calendar month (MX). */
  flyerActions: number;
  /** Customers with ≥1 visit (Pro CRM). Null if plan has no CRM. */
  loyaltyCustomers: number | null;
  /** Total CRM customers. Null if no CRM. */
  totalCustomers: number | null;
  /** Not tracked yet — show stub in UI. */
  menuViewsAvailable: false;
  /** Not tracked yet — show stub in UI. */
  waClicksAvailable: false;
};

function mexicoMonthBounds(): { startIso: string; monthLabel: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  // Midnight Mexico City ≈ UTC-6; use noon offset-safe ISO via Date on local MX date
  const startIso = new Date(`${y}-${m}-01T00:00:00-06:00`).toISOString();
  const monthLabel = new Date(`${y}-${m}-15T12:00:00-06:00`).toLocaleDateString(
    "es-MX",
    { month: "long", year: "numeric", timeZone: "America/Mexico_City" },
  );
  return { startIso, monthLabel };
}

export async function getAdminImpactStats(
  restaurantId: string,
  plan: PlanType | string | null | undefined,
): Promise<AdminImpactStats> {
  const supabase = await createClient();
  const { startIso, monthLabel } = mexicoMonthBounds();
  const planType = (plan ?? "catalog") as PlanType;

  const flyerPromise = can(planType, "flyer")
    ? supabase
        .from("flyer_events")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .gte("created_at", startIso)
    : Promise.resolve({ count: 0 as number | null });

  const loyaltyPromise = can(planType, "crm")
    ? Promise.all([
        supabase
          .from("customers")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId)
          .gt("visit_count", 0),
        supabase
          .from("customers")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId),
      ])
    : Promise.resolve([
        { count: null as number | null },
        { count: null as number | null },
      ]);

  const [flyerRes, loyaltyRes] = await Promise.all([
    flyerPromise,
    loyaltyPromise,
  ]);

  const [loyaltyCountRes, totalCountRes] = loyaltyRes;

  return {
    monthLabel,
    flyerActions: flyerRes.count ?? 0,
    loyaltyCustomers: can(planType, "crm")
      ? (loyaltyCountRes.count ?? 0)
      : null,
    totalCustomers: can(planType, "crm") ? (totalCountRes.count ?? 0) : null,
    menuViewsAvailable: false,
    waClicksAvailable: false,
  };
}
