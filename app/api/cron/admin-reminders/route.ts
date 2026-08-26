import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  emitTenantNotification,
  wasRecentlyNotified,
} from "@/lib/notifications/emit";
import { can } from "@/lib/plans";
import { mexicoCityTodayYmd } from "@/lib/dates";
import { daysUntil } from "@/lib/subscription-lifecycle";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

/** Daily reminders: publish menú del día + subscription ending soon. Idempotent 20h. */
export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createServiceClient();
  const today = mexicoCityTodayYmd();
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const in7Iso = in7.toISOString();
  const nowIso = new Date().toISOString();

  let menuReminders = 0;
  let subReminders = 0;
  let skipped = 0;

  const { data: restaurants } = await admin
    .from("restaurants")
    .select(
      "id, name, plan_type, is_active, subscription_end_date, purged_at",
    )
    .is("purged_at", null)
    .eq("is_active", true)
    .limit(500);

  for (const r of restaurants ?? []) {
    const plan = r.plan_type || "catalog";
    if (can(plan, "daily_menu")) {
      const recent = await wasRecentlyNotified({
        restaurantId: r.id,
        type: "reminder_daily_menu",
        withinHours: 20,
      });
      if (recent) {
        skipped += 1;
      } else {
        const { data: selection } = await admin
          .from("daily_menu_selections")
          .select("id, menu_date")
          .eq("restaurant_id", r.id)
          .maybeSingle();

        let hasTodayMenu = false;
        if (selection?.id && selection.menu_date === today) {
          const { count } = await admin
            .from("daily_menu_dishes")
            .select("dish_id", { count: "exact", head: true })
            .eq("daily_menu_id", selection.id);
          hasTodayMenu = (count ?? 0) > 0;
        }

        if (!hasTodayMenu) {
          await emitTenantNotification({
            restaurantId: r.id,
            type: "reminder_daily_menu",
            title: "Publica tu menú del día",
            body: "Aún no hay menú del día para hoy. Tus clientes lo esperan.",
            href: "/admin",
          });
          menuReminders += 1;
        }
      }
    }

    const end = r.subscription_end_date
      ? new Date(r.subscription_end_date).getTime()
      : null;
    if (end != null && end > Date.now() && end <= new Date(in7Iso).getTime()) {
      const recent = await wasRecentlyNotified({
        restaurantId: r.id,
        type: "reminder_subscription",
        withinHours: 20,
      });
      if (recent) {
        skipped += 1;
      } else {
        const days = daysUntil(r.subscription_end_date) ?? 0;
        await emitTenantNotification({
          restaurantId: r.id,
          type: "reminder_subscription",
          title: "Tu suscripción vence pronto",
          body: `Quedan ~${days} día(s). Renueva con soporte para no perder el menú público.`,
          href: "/admin/settings",
        });
        subReminders += 1;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    at: nowIso,
    menuReminders,
    subReminders,
    skipped,
  });
}

export async function GET(request: Request) {
  return POST(request);
}
