/**
 * Best-effort Storage cleanup for dish-photos public URLs.
 * Failures never throw — DB updates must continue if purge fails.
 */

const BUCKET = "dish-photos";
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`;

export function storagePathFromPublicUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const idx = u.pathname.indexOf(PUBLIC_MARKER);
    if (idx === -1) return null;
    const path = decodeURIComponent(u.pathname.slice(idx + PUBLIC_MARKER.length));
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
  const path = storagePathFromPublicUrl(url);
  if (!path) return;
  try {
    const { error } = await client.storage.from(BUCKET).remove([path]);
    if (error) {
      console.warn("[storage-cleanup]", path, error.message);
    }
  } catch (e) {
    console.warn(
      "[storage-cleanup]",
      path,
      e instanceof Error ? e.message : e,
    );
  }
}

/** Best-effort remove all objects under a restaurant folder. */
export async function purgeRestaurantStorageFolder(
  client: {
    storage: {
      from: (bucket: string) => {
        list: (
          path?: string,
          options?: { limit?: number; offset?: number },
        ) => Promise<{
          data: { name: string }[] | null;
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
  try {
    const folder = restaurantId;
    const { data, error } = await client.storage.from(BUCKET).list(folder, {
      limit: 1000,
    });
    if (error) {
      console.warn("[storage-cleanup] list", folder, error.message);
      return;
    }
    const paths = (data ?? [])
      .map((f) => `${folder}/${f.name}`)
      .filter(Boolean);
    if (paths.length === 0) return;
    const { error: remErr } = await client.storage.from(BUCKET).remove(paths);
    if (remErr) {
      console.warn("[storage-cleanup] remove", remErr.message);
    }
  } catch (e) {
    console.warn(
      "[storage-cleanup] purge folder",
      e instanceof Error ? e.message : e,
    );
  }
}
