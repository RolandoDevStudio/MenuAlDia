import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { FALLBACK_PLAN_PRICES, type PlanPricesMap } from "@/lib/plans";

export async function GET() {
  try {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "plan_prices")
      .maybeSingle();
    if (!data?.value) {
      return NextResponse.json(FALLBACK_PLAN_PRICES);
    }
    return NextResponse.json(data.value as PlanPricesMap);
  } catch {
    return NextResponse.json(FALLBACK_PLAN_PRICES);
  }
}
