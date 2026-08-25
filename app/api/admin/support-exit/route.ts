import { NextResponse } from "next/server";
import { getSessionRestaurant } from "@/lib/restaurant";
import { writeAuditLog } from "@/lib/audit";
import {
  SUPPORT_ACTOR_LABEL,
  SUPPORT_COOKIE,
  SUPPORT_COOKIE_OPTIONS,
} from "@/lib/support-session";

export async function POST() {
  const session = await getSessionRestaurant();
  const restaurantId = session?.supportMode
    ? session.restaurant.id
    : null;

  if (restaurantId) {
    await writeAuditLog({
      restaurantId,
      actorUserId: session?.userId,
      actorLabel: SUPPORT_ACTOR_LABEL,
      action: "support_access",
      summary: "Soporte salió del panel",
    });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SUPPORT_COOKIE, "", { ...SUPPORT_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
