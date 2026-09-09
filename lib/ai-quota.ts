import { createServiceClient } from "@/lib/supabase/admin";
import {
  monthlyAiImagesLimit,
  monthlyAiProductImagesLimit,
  type PlanType,
} from "@/lib/plans";
import { createHash } from "crypto";

export type AiUsageKind =
  | "flyer"
  | "banner"
  | "background"
  | "product"
  | "scan"
  | "intent"
  | "broadcast";

export type ImageUsageKind = "flyer" | "banner" | "background" | "product";

const MARKETING_KINDS: ImageUsageKind[] = ["flyer", "banner", "background"];
const PRODUCT_KINDS: ImageUsageKind[] = ["product"];

function monthStartIso(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

function dayStartIso(d = new Date()): string {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  ).toISOString();
}

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const admin = createServiceClient();
    const { data } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (data?.value === undefined || data?.value === null) return fallback;
    return data.value as T;
  } catch {
    return fallback;
  }
}

export async function isAiGloballyPaused(): Promise<boolean> {
  const v = await getSetting<boolean | string>("ai_paused", false);
  return v === true || v === "true";
}

export async function getDailyGlobalLimit(): Promise<number> {
  const v = await getSetting<number | string>("ai_daily_global_limit", 1200);
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 1200;
}

export async function getScanMonthlyLimit(): Promise<number> {
  const v = await getSetting<number | string>("ai_scan_monthly_limit", 8);
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 8;
}

/** Pack size/price from platform_settings (superadmin editable). Defaults 10 / $29. */
export async function getAiImagePackMeta(): Promise<{
  size: number;
  priceMxn: number;
}> {
  const size = Number(await getSetting("ai_image_pack_size", 10));
  const priceMxn = Number(await getSetting("ai_image_pack_price_mxn", 29));
  return {
    size: Number.isFinite(size) && size > 0 ? size : 10,
    priceMxn: Number.isFinite(priceMxn) && priceMxn >= 0 ? priceMxn : 29,
  };
}

export async function countUsageSince(opts: {
  restaurantId?: string;
  kinds?: AiUsageKind[];
  sinceIso: string;
  okOnly?: boolean;
}): Promise<number> {
  const admin = createServiceClient();
  let q = admin
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .gte("created_at", opts.sinceIso);
  if (opts.restaurantId) q = q.eq("restaurant_id", opts.restaurantId);
  if (opts.kinds?.length) q = q.in("kind", opts.kinds);
  if (opts.okOnly) q = q.eq("ok", true);
  const { count } = await q;
  return count ?? 0;
}

async function countPoolUsed(
  restaurantId: string,
  kinds: ImageUsageKind[],
): Promise<number> {
  const admin = createServiceClient();
  const since = monthStartIso();
  const { count } = await admin
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .in("kind", kinds)
    .gte("created_at", since)
    .or("ok.eq.true,ok.eq.false");
  return count ?? 0;
}

/** @deprecated Prefer getDualImageQuotaStatus — marketing pool only (ok+pending). */
export async function countImageQuotaUsed(
  restaurantId: string,
): Promise<number> {
  return countPoolUsed(restaurantId, MARKETING_KINDS);
}

export async function countSuccessfulImages(
  restaurantId: string,
): Promise<number> {
  return countUsageSince({
    restaurantId,
    kinds: MARKETING_KINDS,
    sinceIso: monthStartIso(),
    okOnly: true,
  });
}

export async function countScansThisMonth(
  restaurantId: string,
): Promise<number> {
  return countUsageSince({
    restaurantId,
    kinds: ["scan"],
    sinceIso: monthStartIso(),
    okOnly: true,
  });
}

export async function countGlobalToday(): Promise<number> {
  return countUsageSince({ sinceIso: dayStartIso(), okOnly: true });
}

export function imageQuotaForRestaurant(opts: {
  plan: PlanType | string | null | undefined;
  bonus: number;
}): { limit: number; bonus: number; total: number } {
  const limit = monthlyAiImagesLimit(opts.plan);
  const bonus = Math.max(0, Math.floor(opts.bonus || 0));
  return { limit, bonus, total: limit + bonus };
}

function poolIncluded(
  kind: ImageUsageKind,
  plan: PlanType | string | null | undefined,
): number {
  if (kind === "product") return monthlyAiProductImagesLimit(plan);
  return monthlyAiImagesLimit(plan);
}

export type PoolQuotaStatus = {
  used: number;
  remaining: number;
  total: number;
  limit: number;
  bonus: number;
  bonusRemaining: number;
};

export async function getDualImageQuotaStatus(opts: {
  restaurantId: string;
  plan: PlanType | string | null | undefined;
  bonus: number;
}): Promise<{
  marketing: PoolQuotaStatus;
  product: PoolQuotaStatus;
  bonus: number;
}> {
  const bonus = Math.max(0, Math.floor(opts.bonus || 0));
  const mLimit = monthlyAiImagesLimit(opts.plan);
  const pLimit = monthlyAiProductImagesLimit(opts.plan);
  const [mUsed, pUsed] = await Promise.all([
    countPoolUsed(opts.restaurantId, MARKETING_KINDS),
    countPoolUsed(opts.restaurantId, PRODUCT_KINDS),
  ]);
  const bonusConsumed =
    Math.max(0, mUsed - mLimit) + Math.max(0, pUsed - pLimit);
  const bonusRemaining = Math.max(0, bonus - bonusConsumed);

  function status(used: number, limit: number): PoolQuotaStatus {
    const includedLeft = Math.max(0, limit - used);
    const remaining = includedLeft + bonusRemaining;
    return {
      used,
      remaining,
      total: limit + bonus,
      limit,
      bonus,
      bonusRemaining,
    };
  }

  return {
    marketing: status(mUsed, mLimit),
    product: status(pUsed, pLimit),
    bonus,
  };
}

/** Marketing pool status (backward compatible for flyer UI). */
export async function getImageQuotaStatus(opts: {
  restaurantId: string;
  plan: PlanType | string | null | undefined;
  bonus: number;
}): Promise<{
  used: number;
  remaining: number;
  total: number;
  limit: number;
  bonus: number;
}> {
  const dual = await getDualImageQuotaStatus(opts);
  return {
    used: dual.marketing.used,
    remaining: dual.marketing.remaining,
    total: dual.marketing.total,
    limit: dual.marketing.limit,
    bonus: dual.bonus,
  };
}

export async function assertAiAllowed(opts: {
  restaurantId: string;
  aiPaused?: boolean | null;
}): Promise<
  | { ok: true }
  | { ok: false; status: number; error: string; message: string }
> {
  if (opts.aiPaused) {
    return {
      ok: false,
      status: 403,
      error: "AI_PAUSED",
      message: "La IA está pausada para este negocio.",
    };
  }
  if (await isAiGloballyPaused()) {
    return {
      ok: false,
      status: 503,
      error: "AI_MAINTENANCE",
      message: "IA en mantenimiento. Intenta más tarde.",
    };
  }
  const daily = await getDailyGlobalLimit();
  const used = await countGlobalToday();
  if (used >= daily) {
    return {
      ok: false,
      status: 429,
      error: "GLOBAL_QUOTA",
      message: "Se alcanzó el tope diario de IA de la plataforma.",
    };
  }
  return { ok: true };
}

/** Reserve one image credit (marketing or product pool + flexible SPEI bonus). */
export async function reserveImageUsage(opts: {
  restaurantId: string;
  kind: ImageUsageKind;
  plan: PlanType | string | null | undefined;
  bonus: number;
}): Promise<
  | { ok: true; usageId: string; remaining: number; total: number }
  | {
      ok: false;
      status: number;
      error: string;
      message: string;
    }
> {
  const gate = await assertAiAllowed({
    restaurantId: opts.restaurantId,
  });
  if (!gate.ok) return gate;

  const dual = await getDualImageQuotaStatus({
    restaurantId: opts.restaurantId,
    plan: opts.plan,
    bonus: opts.bonus,
  });
  const pool = opts.kind === "product" ? dual.product : dual.marketing;
  if (pool.remaining <= 0) {
    const isProduct = opts.kind === "product";
    return {
      ok: false,
      status: 403,
      error: "QUOTA_EXCEEDED",
      message: isProduct
        ? pool.limit === 0
          ? "Las fotos de menú con IA están en Menú al Día y Pro. Puedes pedir un pack SPEI."
          : "Has alcanzado el límite mensual de fotos de menú con IA. Pide un pack SPEI o espera al próximo mes."
        : "Has alcanzado el límite mensual de imágenes con IA de tu plan.",
    };
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return {
      ok: false,
      status: 500,
      error: "USAGE_RESERVE_FAILED",
      message:
        "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor. Configúrala en .env.local y reinicia.",
    };
  }

  const { data, error } = await admin
    .from("ai_usage")
    .insert({
      restaurant_id: opts.restaurantId,
      kind: opts.kind,
      ok: false,
    })
    .select("id")
    .single();

  if (error || !data) {
    const invalidKey =
      /invalid api key/i.test(error?.message ?? "") ||
      /service_role/i.test(error?.hint ?? "");
    return {
      ok: false,
      status: 500,
      error: invalidKey ? "SUPABASE_SERVICE_KEY_INVALID" : "USAGE_RESERVE_FAILED",
      message: invalidKey
        ? "SUPABASE_SERVICE_ROLE_KEY inválida o de otro proyecto. Cópiala de nuevo en .env.local (Settings → API) y reinicia npm run dev."
        : "No se pudo reservar el crédito de IA.",
    };
  }

  const included = poolIncluded(opts.kind, opts.plan);
  return {
    ok: true,
    usageId: data.id,
    remaining: Math.max(0, pool.remaining - 1),
    total: included + dual.bonus,
  };
}

export async function finalizeUsage(
  usageId: string,
  ok: boolean,
): Promise<void> {
  const admin = createServiceClient();
  if (ok) {
    await admin.from("ai_usage").update({ ok: true }).eq("id", usageId);
  } else {
    await admin.from("ai_usage").delete().eq("id", usageId);
  }
}

export async function recordUsage(opts: {
  restaurantId: string | null;
  kind: AiUsageKind;
  ok: boolean;
}): Promise<void> {
  const admin = createServiceClient();
  await admin.from("ai_usage").insert({
    restaurant_id: opts.restaurantId,
    kind: opts.kind,
    ok: opts.ok,
  });
}

export function intentCacheHash(text: string): string {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized).digest("hex");
}

export async function getIntentCache(
  hash: string,
): Promise<Record<string, unknown> | null> {
  const admin = createServiceClient();
  const { data } = await admin
    .from("ai_intent_cache")
    .select("result, expires_at")
    .eq("hash", hash)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) {
    await admin.from("ai_intent_cache").delete().eq("hash", hash);
    return null;
  }
  return (data.result ?? null) as Record<string, unknown> | null;
}

export async function setIntentCache(
  hash: string,
  result: Record<string, unknown>,
  ttlDays = 7,
): Promise<void> {
  const admin = createServiceClient();
  const expires = new Date();
  expires.setDate(expires.getDate() + ttlDays);
  await admin.from("ai_intent_cache").upsert({
    hash,
    result,
    expires_at: expires.toISOString(),
  });
}
