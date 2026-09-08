import { NextResponse } from "next/server";
import { z } from "zod";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { isVertexConfigured } from "@/lib/gemini";
import {
  countGlobalToday,
  getAiImagePackMeta,
  getDailyGlobalLimit,
} from "@/lib/ai-quota";

export async function GET() {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = createServiceClient();
  const sinceMonth = new Date();
  sinceMonth.setUTCDate(1);
  sinceMonth.setUTCHours(0, 0, 0, 0);

  const [
    { data: settings },
    todayCount,
    dailyLimit,
    packMeta,
    { data: monthRows },
    { data: pendingPacks },
    { data: tenants },
  ] = await Promise.all([
    admin.from("platform_settings").select("key, value").in("key", [
      "ai_paused",
      "ai_daily_global_limit",
      "ai_scan_monthly_limit",
      "ai_image_pack_size",
      "ai_image_pack_price_mxn",
      "ai_image_limits",
    ]),
    countGlobalToday(),
    getDailyGlobalLimit(),
    getAiImagePackMeta(),
    admin
      .from("ai_usage")
      .select("kind, ok")
      .gte("created_at", sinceMonth.toISOString()),
    admin
      .from("ai_image_pack_requests")
      .select(
        "id, restaurant_id, pack_size, amount_mxn, status, notes, created_at, restaurants(name, slug)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("restaurants")
      .select("id, name, slug, plan_type, ai_image_bonus, ai_paused")
      .is("purged_at", null)
      .order("name")
      .limit(200),
  ]);

  const settingsMap: Record<string, unknown> = {};
  for (const row of settings ?? []) {
    settingsMap[row.key] = row.value;
  }

  const byKind: Record<string, { ok: number; fail: number }> = {};
  for (const row of monthRows ?? []) {
    const k = row.kind as string;
    if (!byKind[k]) byKind[k] = { ok: 0, fail: 0 };
    if (row.ok) byKind[k]!.ok += 1;
    else byKind[k]!.fail += 1;
  }

  return NextResponse.json({
    vertexConfigured: isVertexConfigured(),
    todayCount,
    dailyLimit,
    packMeta,
    settings: settingsMap,
    byKind,
    pendingPacks: pendingPacks ?? [],
    tenants: tenants ?? [],
  });
}

const patchSchema = z.object({
  ai_paused: z.boolean().optional(),
  ai_daily_global_limit: z.number().int().positive().optional(),
  ai_scan_monthly_limit: z.number().int().nonnegative().optional(),
  ai_image_pack_size: z.number().int().positive().optional(),
  ai_image_pack_price_mxn: z.number().nonnegative().optional(),
  tenantId: z.string().uuid().optional(),
  ai_image_bonus: z.number().int().optional(),
  tenant_ai_paused: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const admin = createServiceClient();

  async function upsert(key: string, value: unknown) {
    await admin.from("platform_settings").upsert({ key, value });
  }

  if (body.ai_paused !== undefined) await upsert("ai_paused", body.ai_paused);
  if (body.ai_daily_global_limit !== undefined) {
    await upsert("ai_daily_global_limit", body.ai_daily_global_limit);
  }
  if (body.ai_scan_monthly_limit !== undefined) {
    await upsert("ai_scan_monthly_limit", body.ai_scan_monthly_limit);
  }
  if (body.ai_image_pack_size !== undefined) {
    await upsert("ai_image_pack_size", body.ai_image_pack_size);
  }
  if (body.ai_image_pack_price_mxn !== undefined) {
    await upsert("ai_image_pack_price_mxn", body.ai_image_pack_price_mxn);
  }

  if (body.tenantId) {
    const patch: Record<string, unknown> = {};
    if (body.ai_image_bonus !== undefined) {
      patch.ai_image_bonus = Math.max(0, body.ai_image_bonus);
    }
    if (body.tenant_ai_paused !== undefined) {
      patch.ai_paused = body.tenant_ai_paused;
    }
    if (Object.keys(patch).length) {
      await admin.from("restaurants").update(patch).eq("id", body.tenantId);
    }
  }

  return NextResponse.json({ ok: true });
}

const packSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
});

export async function POST(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let body: z.infer<typeof packSchema>;
  try {
    body = packSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const admin = createServiceClient();
  const { data: req } = await admin
    .from("ai_image_pack_requests")
    .select("*")
    .eq("id", body.requestId)
    .maybeSingle();

  if (!req || req.status !== "pending") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (body.action === "reject") {
    await admin
      .from("ai_image_pack_requests")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id ?? null,
      })
      .eq("id", req.id);
    return NextResponse.json({ ok: true });
  }

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("ai_image_bonus")
    .eq("id", req.restaurant_id)
    .single();

  const nextBonus =
    Math.max(0, Number(restaurant?.ai_image_bonus) || 0) +
    Number(req.pack_size || 10);

  await admin
    .from("restaurants")
    .update({ ai_image_bonus: nextBonus })
    .eq("id", req.restaurant_id);

  await admin
    .from("ai_image_pack_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id ?? null,
    })
    .eq("id", req.id);

  return NextResponse.json({ ok: true, ai_image_bonus: nextBonus });
}
