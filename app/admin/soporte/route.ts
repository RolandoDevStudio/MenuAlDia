import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";
import { writeAuditLog } from "@/lib/audit";
import {
  SUPPORT_COOKIE,
  SUPPORT_COOKIE_OPTIONS,
  SUPPORT_SESSION_TTL_MS,
  SUPPORT_ACTOR_LABEL,
} from "@/lib/support-session";

export async function GET(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.redirect(new URL("/super-admin/login", request.url));
  }

  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.redirect(new URL("/super-admin/crm", request.url));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { data: row, error } = await supabase
    .from("support_access_tokens")
    .select("id, restaurant_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.redirect(
      new URL("/super-admin/crm?support=invalid", request.url),
    );
  }
  if (row.used_at || new Date(row.expires_at).getTime() <= Date.now()) {
    return NextResponse.redirect(
      new URL("/super-admin/crm?support=expired", request.url),
    );
  }

  const sessionExpires = new Date(
    Date.now() + SUPPORT_SESSION_TTL_MS,
  ).toISOString();
  const { error: updErr } = await supabase
    .from("support_access_tokens")
    .update({
      used_at: new Date().toISOString(),
      session_expires_at: sessionExpires,
    })
    .eq("id", row.id)
    .is("used_at", null);

  if (updErr) {
    return NextResponse.redirect(
      new URL("/super-admin/crm?support=error", request.url),
    );
  }

  await writeAuditLog({
    restaurantId: row.restaurant_id,
    actorUserId: user?.id,
    actorLabel: SUPPORT_ACTOR_LABEL,
    action: "support_access",
    summary: "Soporte accedió al panel",
  });

  const res = NextResponse.redirect(new URL("/admin", request.url));
  res.cookies.set(SUPPORT_COOKIE, row.restaurant_id, SUPPORT_COOKIE_OPTIONS);
  return res;
}
