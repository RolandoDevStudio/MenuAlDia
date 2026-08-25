import { NextResponse } from "next/server";
import { getSessionRestaurant } from "@/lib/restaurant";
import { writeAuditLog } from "@/lib/audit";
import { SUPPORT_ACTOR_LABEL } from "@/lib/support-session";

export async function POST(request: Request) {
  const session = await getSessionRestaurant();
  if (!session?.supportMode) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  let summary = "Soporte actualizó ajustes";
  try {
    const body = (await request.json()) as { summary?: string };
    if (body.summary?.trim()) summary = body.summary.trim().slice(0, 400);
  } catch {
    /* keep default */
  }

  await writeAuditLog({
    restaurantId: session.restaurant.id,
    actorUserId: session.userId,
    actorLabel: SUPPORT_ACTOR_LABEL,
    action: "update",
    fieldName: "settings",
    summary,
  });
  return NextResponse.json({ ok: true });
}
