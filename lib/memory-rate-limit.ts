/** In-memory sliding window (per process / Vercel instance). */
const hits = new Map<string, number[]>();

/**
 * Returns true if the caller may proceed; false if over limit.
 * Prunes timestamps outside the window on each call.
 */
export function takeRateLimitSlot(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
