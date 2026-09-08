import { NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/admin-session";
import { createClient } from "@/lib/supabase/server";
import {
  countScansThisMonth,
  getAiImagePackMeta,
  getImageQuotaStatus,
  getScanMonthlyLimit,
  isAiGloballyPaused,
} from "@/lib/ai-quota";
import type { PlanType } from "@/lib/plans";

export async function GET() {
  const session = await requireTenantSession();
  const restaurantId = session.restaurant.id;
  const plan = (session.restaurant.plan_type as PlanType) || "catalog";
  const bonus = session.restaurant.ai_image_bonus ?? 0;

  const [scanLimit, scansUsed, images, packMeta, globalPaused] =
    await Promise.all([
      getScanMonthlyLimit(),
      countScansThisMonth(restaurantId),
      getImageQuotaStatus({ restaurantId, plan, bonus }),
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
      used: images.used,
      limit: images.limit,
      bonus: images.bonus,
      total: images.total,
      remaining: images.remaining,
    },
    pack: {
      size: packMeta.size,
      priceMxn: packMeta.priceMxn,
      pending: Boolean(pending),
    },
  });
}
