/**
 * Best-effort Storage cleanup for dish-photos and restaurant-assets public URLs.
 * Failures never throw — DB updates must continue if purge fails.
 */

const BUCKETS = ["dish-photos", "restaurant-assets"] as const;

function storagePathFromPublicUrl(
  url: string,
  bucket: string,
): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  try {
    const u = new URL(url);
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    const path = decodeURIComponent(u.pathname.slice(idx + marker.length));
    return path || null;
  } catch {
    return null;
  }
}

type Remover = {
  storage: {
    from: (bucket: string) => {
      remove: (
        paths: string[],
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
};

/** Fire-and-forget remove; swallows all errors. */
export async function deleteStoragePublicUrl(
  client: Remover,
  url: string | null | undefined,
): Promise<void> {
  if (!url) return;
  for (const bucket of BUCKETS) {
    const path = storagePathFromPublicUrl(url, bucket);
    if (!path) continue;
    try {
      const { error } = await client.storage.from(bucket).remove([path]);
      if (error) {
        console.warn("[storage-cleanup]", bucket, path, error.message);
      }
    } catch (e) {
      console.warn(
        "[storage-cleanup]",
        path,
        e instanceof Error ? e.message : e,
      );
    }
  }
}

/** Best-effort remove all objects under a restaurant folder in known buckets. */
export async function purgeRestaurantStorageFolder(
  client: {
    storage: {
      from: (bucket: string) => {
        list: (
          path?: string,
          options?: { limit?: number; offset?: number },
        ) => Promise<{
          data: { name: string; id?: string | null }[] | null;
          error: { message: string } | null;
        }>;
        remove: (
          paths: string[],
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  },
  restaurantId: string,
): Promise<void> {
  for (const bucket of BUCKETS) {
    try {
      const roots = [restaurantId, `${restaurantId}/ai`, `${restaurantId}/flyers`];
      const paths: string[] = [];
      for (const folder of roots) {
        const { data, error } = await client.storage.from(bucket).list(folder, {
          limit: 1000,
        });
        if (error) {
          console.warn("[storage-cleanup] list", bucket, folder, error.message);
          continue;
        }
        for (const f of data ?? []) {
          // Folders often have id null
          if (!f.name) continue;
          if (f.id == null && !f.name.includes(".")) {
            const nested = `${folder}/${f.name}`;
            const { data: kids } = await client.storage
              .from(bucket)
              .list(nested, { limit: 1000 });
            for (const k of kids ?? []) {
              if (k.name) paths.push(`${nested}/${k.name}`);
            }
          } else {
            paths.push(`${folder}/${f.name}`);
          }
        }
      }
      if (paths.length === 0) continue;
      const { error: remErr } = await client.storage.from(bucket).remove(paths);
      if (remErr) {
        console.warn("[storage-cleanup] remove", bucket, remErr.message);
      }
    } catch (e) {
      console.warn(
        "[storage-cleanup] purge folder",
        bucket,
        e instanceof Error ? e.message : e,
      );
    }
  }
}
