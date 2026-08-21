import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/admin";
import type {
  NotificationAudience,
  NotificationType,
} from "@/lib/notifications/types";

function configureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:soporte@menualdia.com.mx";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

type EmitParams = {
  audience: NotificationAudience;
  restaurantId?: string | null;
  type: NotificationType | string;
  title: string;
  body?: string;
  href?: string;
  payload?: Record<string, unknown>;
};

export async function emitNotification(params: EmitParams) {
  const admin = createServiceClient();
  const row = {
    audience: params.audience,
    restaurant_id:
      params.audience === "tenant" ? params.restaurantId ?? null : null,
    type: params.type,
    title: params.title,
    body: params.body ?? "",
    href: params.href ?? "",
    payload: params.payload ?? {},
  };

  if (params.audience === "tenant" && !row.restaurant_id) {
    throw new Error("restaurantId required for tenant notifications");
  }

  const { data: notification, error } = await admin
    .from("notifications")
    .insert(row)
    .select("*")
    .single();

  if (error || !notification) {
    console.error("[emitNotification]", error?.message);
    return null;
  }

  await sendPushForNotification({
    audience: params.audience,
    restaurantId: row.restaurant_id,
    title: params.title,
    body: params.body ?? "",
    href: params.href ?? "/admin",
    notificationId: notification.id,
  });

  return notification;
}

export async function emitTenantNotification(
  params: Omit<EmitParams, "audience"> & { restaurantId: string },
) {
  return emitNotification({ ...params, audience: "tenant" });
}

export async function emitSuperAdminNotification(
  params: Omit<EmitParams, "audience" | "restaurantId"> & {
    restaurantId?: string | null;
  },
) {
  return emitNotification({
    ...params,
    audience: "super_admin",
    restaurantId: params.restaurantId ?? null,
  });
}

/** True if same type was already emitted for this restaurant within hours. */
export async function wasRecentlyNotified(params: {
  restaurantId: string;
  type: string;
  withinHours?: number;
}): Promise<boolean> {
  const hours = params.withinHours ?? 20;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const admin = createServiceClient();
  const { data } = await admin
    .from("notifications")
    .select("id")
    .eq("restaurant_id", params.restaurantId)
    .eq("type", params.type)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

async function sendPushForNotification(params: {
  audience: NotificationAudience;
  restaurantId: string | null;
  title: string;
  body: string;
  href: string;
  notificationId: string;
}) {
  if (!configureVapid()) return;

  const admin = createServiceClient();
  let query = admin
    .from("push_subscriptions")
    .select("id, endpoint, subscription_json")
    .eq("audience", params.audience);

  if (params.audience === "tenant" && params.restaurantId) {
    query = query.eq("restaurant_id", params.restaurantId);
  }

  const { data: subs } = await query.limit(200);
  if (!subs?.length) return;

  const payload = JSON.stringify({
    title: params.title,
    body: params.body,
    href: params.href || "/admin",
    notificationId: params.notificationId,
  });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          sub.subscription_json as webpush.PushSubscription,
          payload,
        );
      } catch (err: unknown) {
        const status =
          err && typeof err === "object" && "statusCode" in err
            ? Number((err as { statusCode?: number }).statusCode)
            : 0;
        if (status === 410 || status === 404) {
          await admin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
        } else {
          console.error("[web-push]", status, sub.endpoint.slice(0, 48));
        }
      }
    }),
  );
}
