import type { createServiceClient } from "@/lib/supabase/admin";
import type { OrderLogPayload } from "@/lib/types";

type ServiceClient = ReturnType<typeof createServiceClient>;

const BATCH = 200;
const MAX_BATCHES = 25;

export type WaTtlPurgeResult = {
  processedMessages: number;
  messageLogs: number;
  sessions: number;
  paymentProofs: number;
};

/**
 * Retention purge for WhatsApp bot tables + SPEI proofs.
 * Defaults: wamid 14d, logs 120d, sessions 48h, SPEI files 90d.
 */
export async function purgeWhatsappTtlData(
  admin: ServiceClient,
  now: Date = new Date(),
): Promise<WaTtlPurgeResult> {
  const result: WaTtlPurgeResult = {
    processedMessages: 0,
    messageLogs: 0,
    sessions: 0,
    paymentProofs: 0,
  };

  const processedBefore = new Date(now);
  processedBefore.setDate(processedBefore.getDate() - 14);
  result.processedMessages = await deleteOlderThan(
    admin,
    "wa_processed_messages",
    "processed_at",
    processedBefore.toISOString(),
  );

  const logsBefore = new Date(now);
  logsBefore.setDate(logsBefore.getDate() - 120);
  result.messageLogs = await deleteOlderThan(
    admin,
    "wa_message_log",
    "created_at",
    logsBefore.toISOString(),
  );

  const sessionsBefore = new Date(now);
  sessionsBefore.setHours(sessionsBefore.getHours() - 48);
  result.sessions = await deleteOlderThan(
    admin,
    "wa_session_state",
    "updated_at",
    sessionsBefore.toISOString(),
  );

  result.paymentProofs = await purgeOldPaymentProofs(admin, now);
  return result;
}

async function deleteOlderThan(
  admin: ServiceClient,
  table: string,
  column: string,
  beforeIso: string,
): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < MAX_BATCHES; i += 1) {
    if (table === "wa_processed_messages") {
      const { data, error } = await admin
        .from(table)
        .select("wamid")
        .lt(column, beforeIso)
        .limit(BATCH);
      if (error) {
        console.warn(`[wa-ttl] select ${table}`, error.message);
        break;
      }
      const ids = (data ?? []).map((r) => r.wamid as string).filter(Boolean);
      if (ids.length === 0) break;
      const { error: delErr } = await admin.from(table).delete().in("wamid", ids);
      if (delErr) {
        console.warn(`[wa-ttl] delete ${table}`, delErr.message);
        break;
      }
      deleted += ids.length;
      if (ids.length < BATCH) break;
      continue;
    }

    if (table === "wa_session_state") {
      const { data, error } = await admin
        .from(table)
        .select("restaurant_id, wa_id")
        .lt(column, beforeIso)
        .limit(BATCH);
      if (error) {
        console.warn(`[wa-ttl] select ${table}`, error.message);
        break;
      }
      const rows = (data ?? []) as { restaurant_id: string; wa_id: string }[];
      if (rows.length === 0) break;
      for (const row of rows) {
        const { error: delErr } = await admin
          .from(table)
          .delete()
          .eq("restaurant_id", row.restaurant_id)
          .eq("wa_id", row.wa_id);
        if (delErr) {
          console.warn(`[wa-ttl] delete session`, delErr.message);
          return deleted;
        }
        deleted += 1;
      }
      if (rows.length < BATCH) break;
      continue;
    }

    const { data, error } = await admin
      .from(table)
      .select("id")
      .lt(column, beforeIso)
      .limit(BATCH);
    if (error) {
      console.warn(`[wa-ttl] select ${table}`, error.message);
      break;
    }
    const ids = (data ?? []).map((r) => r.id as string).filter(Boolean);
    if (ids.length === 0) break;
    const { error: delErr } = await admin.from(table).delete().in("id", ids);
    if (delErr) {
      console.warn(`[wa-ttl] delete ${table}`, delErr.message);
      break;
    }
    deleted += ids.length;
    if (ids.length < BATCH) break;
  }
  return deleted;
}

async function purgeOldPaymentProofs(
  admin: ServiceClient,
  now: Date,
): Promise<number> {
  const before = new Date(now);
  before.setDate(before.getDate() - 90);
  const beforeIso = before.toISOString();
  let purged = 0;

  for (let i = 0; i < MAX_BATCHES; i += 1) {
    const { data, error } = await admin
      .from("orders")
      .select("id, payload, created_at")
      .lt("created_at", beforeIso)
      .order("created_at", { ascending: true })
      .limit(BATCH);

    if (error) {
      console.warn("[wa-ttl] payment proofs query", error.message);
      break;
    }

    const rows = (
      (data ?? []) as { id: string; payload: OrderLogPayload | null }[]
    ).filter((r) => Boolean(r.payload?.payment_proof_path));

    if (rows.length === 0) {
      // No proofs in this page — if we got a full batch of old orders without
      // proofs, continue once more; otherwise stop.
      if ((data ?? []).length < BATCH) break;
      continue;
    }

    const paths = rows
      .map((r) => r.payload!.payment_proof_path!)
      .filter(Boolean);

    if (paths.length > 0) {
      const { error: remErr } = await admin.storage
        .from("wa-payment-proofs")
        .remove(paths);
      if (remErr) {
        console.warn("[wa-ttl] storage remove", remErr.message);
        break;
      }
    }

    for (const row of rows) {
      const payload = { ...(row.payload ?? {}) } as OrderLogPayload;
      payload.payment_proof_path = null;
      payload.payment_proof_url = null;
      const { error: upErr } = await admin
        .from("orders")
        .update({ payload })
        .eq("id", row.id);
      if (upErr) {
        console.warn("[wa-ttl] clear proof path", upErr.message);
        break;
      }
      purged += 1;
    }

    if ((data ?? []).length < BATCH) break;
  }

  return purged;
}
