import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";
import { writeAuditLog } from "@/lib/audit";
import { computeGraceWindow } from "@/lib/subscription-lifecycle";

/**
 * Sync expired tenants into grace/purge windows (idempotent).
 * Does not hard-delete Storage yet — marks purge_due for SA review.
 */
export async function POST() {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const now = new Date();
  const nowIso = now.toISOString();

  const { data: expired, error } = await supabase
    .from("restaurants")
    .select(
      "id, name, is_active, subscription_end_date, grace_ends_at, purge_scheduled_at, purged_at",
    )
    .is("purged_at", null)
    .lt("subscription_end_date", nowIso)
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let synced = 0;
  for (const r of expired ?? []) {
    if (r.grace_ends_at && r.purge_scheduled_at) continue;
    const end = r.subscription_end_date
      ? new Date(r.subscription_end_date)
      : now;
    const window = computeGraceWindow(end);
    const { error: updErr } = await supabase
      .from("restaurants")
      .update({
        is_active: false,
        grace_ends_at: r.grace_ends_at ?? window.grace_ends_at,
        purge_scheduled_at: r.purge_scheduled_at ?? window.purge_scheduled_at,
      })
      .eq("id", r.id);
    if (!updErr) {
      synced += 1;
      await writeAuditLog({
        restaurantId: r.id,
        actorUserId: user?.id,
        actorLabel: user?.email ?? "super_admin",
        action: "lifecycle",
        summary:
          "Ciclo de vida: vencido → gracia/purga programada (sync automático)",
      });
    }
  }

  const { data: due } = await supabase
    .from("restaurants")
    .select("id, name, slug, purge_scheduled_at")
    .is("purged_at", null)
    .lte("purge_scheduled_at", nowIso)
    .limit(100);

  return NextResponse.json({
    ok: true,
    synced,
    purge_due: due ?? [],
  });
}
