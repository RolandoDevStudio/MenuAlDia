import { NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/admin-session";
import { createClient } from "@/lib/supabase/server";
import {
  countScansThisMonth,
  getAiImagePackMeta,
  getDualImageQuotaStatus,
  getScanMonthlyLimit,
  isAiGloballyPaused,
} from "@/lib/ai-quota";
import type { PlanType } from "@/lib/plans";

export async function GET() {
  const session = await requireTenantSession();
  const restaurantId = session.restaurant.id;
  const plan = (session.restaurant.plan_type as PlanType) || "catalog";
  const bonus = session.restaurant.ai_image_bonus ?? 0;

  const [scanLimit, scansUsed, dual, packMeta, globalPaused] =
    await Promise.all([
      getScanMonthlyLimit(),
      countScansThisMonth(restaurantId),
      getDualImageQuotaStatus({ restaurantId, plan, bonus }),
      getAiImagePackMeta(),
      isAiGloballyPaused(),
    ]);

  const supabase = await createClient();
  const { data: pending } = await supabase
    .from("ai_image_pack_requests")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  const paused = Boolean(session.restaurant.ai_paused) || globalPaused;

  return NextResponse.json({
    paused,
    scans: {
      used: scansUsed,
      limit: scanLimit,
      remaining: Math.max(0, scanLimit - scansUsed),
    },
    images: {
      used: dual.marketing.used,
      limit: dual.marketing.limit,
      bonus: dual.bonus,
      total: dual.marketing.total,
      remaining: dual.marketing.remaining,
    },
    productImages: {
      used: dual.product.used,
      limit: dual.product.limit,
      bonus: dual.bonus,
      total: dual.product.total,
      remaining: dual.product.remaining,
      bonusRemaining: dual.product.bonusRemaining,
    },
    pack: {
      size: packMeta.size,
      priceMxn: packMeta.priceMxn,
      pending: Boolean(pending),
    },
  });
}
