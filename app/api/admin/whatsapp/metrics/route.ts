import { NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/admin-session";
import { can } from "@/lib/plans";
import { createServiceClient } from "@/lib/supabase/admin";
import { getWhatsappUsageMetrics } from "@/lib/whatsapp-bot/metrics";

export const runtime = "nodejs";

/** Usage + estimated Meta cost for the tenant WhatsApp bot (last N days). */
export async function GET(request: Request) {
  const session = await requireTenantSession();
  if (!can(session.restaurant.plan_type, "whatsapp_bot")) {
    return NextResponse.json({ error: "Plan Pro requerido" }, { status: 403 });
  }

  const daysRaw = new URL(request.url).searchParams.get("days");
  const days = Math.min(90, Math.max(7, Number(daysRaw) || 30));

  const admin = createServiceClient();
  const metrics = await getWhatsappUsageMetrics(
    admin,
    session.restaurant.id,
    days,
  );

  return NextResponse.json({ metrics });
}
