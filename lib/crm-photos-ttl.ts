import type { createServiceClient } from "@/lib/supabase/admin";

/** Daily purge of expired private CRM photos (storage + row). */

const BUCKET = "crm-photos";
const BATCH = 100;
const MAX_BATCHES = 20;

type ServiceClient = ReturnType<typeof createServiceClient>;

/** Delete expired CRM photos. Leaves the row if Storage remove fails. */
export async function purgeExpiredCustomerPhotos(
  admin: ServiceClient,
  now: Date = new Date(),
): Promise<number> {
  let purged = 0;
  const nowIso = now.toISOString();

  for (let i = 0; i < MAX_BATCHES; i += 1) {
    const { data, error } = await admin
      .from("customer_photos")
      .select("id, storage_path")
      .lte("expires_at", nowIso)
      .limit(BATCH);

    if (error) {
      console.warn("[crm-photos-ttl]", error.message);
      break;
    }

    const rows = (data ?? []) as { id: string; storage_path: string }[];
    if (rows.length === 0) break;

    const paths = rows.map((r) => r.storage_path).filter(Boolean);
    if (paths.length > 0) {
      const { error: remErr } = await admin.storage.from(BUCKET).remove(paths);
      if (remErr) {
        console.warn("[crm-photos-ttl] storage remove", remErr.message);
        break;
      }
    }

    const ids = rows.map((r) => r.id);
    const { error: delErr } = await admin
      .from("customer_photos")
      .delete()
      .in("id", ids);
    if (delErr) {
      console.warn("[crm-photos-ttl] delete", delErr.message);
      break;
    }

    purged += rows.length;
    if (rows.length < BATCH) break;
  }

  return purged;
}
