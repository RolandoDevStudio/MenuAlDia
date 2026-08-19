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
