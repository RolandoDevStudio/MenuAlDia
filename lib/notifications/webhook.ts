import { createServiceClient } from "@/lib/supabase/admin";

export async function enqueueExternalWebhook(
  eventType: string,
  payload: Record<string, unknown>,
) {
  try {
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("webhook_outbox")
      .insert({
        event_type: eventType,
        payload,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) {
      console.error("[webhook_outbox]", error.message);
      return null;
    }
    void flushWebhookOutbox(data?.id);
    return data?.id ?? null;
  } catch (e) {
    console.error("[enqueueExternalWebhook]", e);
    return null;
  }
}

/** POST pending rows to NOTIFY_WEBHOOK_URL when configured. */
export async function flushWebhookOutbox(onlyId?: string) {
  const url = process.env.NOTIFY_WEBHOOK_URL?.trim();
  const admin = createServiceClient();

  let query = admin
    .from("webhook_outbox")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(20);
  if (onlyId) query = query.eq("id", onlyId);

  const { data: rows } = await query;
  if (!rows?.length) return { flushed: 0 };

  if (!url) {
    return { flushed: 0, skipped: "NOTIFY_WEBHOOK_URL not set" };
  }

  let flushed = 0;
  for (const row of rows) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          event_type: row.event_type,
          payload: row.payload,
          created_at: row.created_at,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      await admin
        .from("webhook_outbox")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempts: (row.attempts ?? 0) + 1,
          last_error: "",
        })
        .eq("id", row.id);
      flushed += 1;
    } catch (e) {
      await admin
        .from("webhook_outbox")
        .update({
          status: "failed",
          attempts: (row.attempts ?? 0) + 1,
          last_error: e instanceof Error ? e.message : "failed",
        })
        .eq("id", row.id);
    }
  }
  return { flushed };
}
