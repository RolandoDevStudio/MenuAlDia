import { NextResponse } from "next/server";
import { z } from "zod";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";
import { createServiceClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const PatchSchema = z.object({
  restaurant_id: z.string().uuid(),
  whatsapp_ai_marketing_addon: z.boolean().optional(),
  addon_trial_ends_at: z.union([z.string(), z.null()]).optional(),
  start_trial_days: z.number().int().min(1).max(30).optional(),
});

/** Super-admin: enable Add-On IA & Marketing or start trial. */
export async function PATCH(req: Request) {
  const ok = await isCurrentUserSuperAdmin();
  if (!ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const admin = createServiceClient();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.whatsapp_ai_marketing_addon !== undefined) {
    patch.whatsapp_ai_marketing_addon = parsed.data.whatsapp_ai_marketing_addon;
  }
  if (parsed.data.start_trial_days != null) {
    const ends = new Date();
    ends.setDate(ends.getDate() + parsed.data.start_trial_days);
    patch.addon_trial_ends_at = ends.toISOString();
  } else if (parsed.data.addon_trial_ends_at !== undefined) {
    patch.addon_trial_ends_at = parsed.data.addon_trial_ends_at;
  }

  const { data: existing } = await admin
    .from("restaurant_whatsapp_accounts")
    .select("restaurant_id")
    .eq("restaurant_id", parsed.data.restaurant_id)
    .maybeSingle();

  const { data, error } = existing
    ? await admin
        .from("restaurant_whatsapp_accounts")
        .update(patch)
        .eq("restaurant_id", parsed.data.restaurant_id)
        .select(
          "whatsapp_ai_marketing_addon, addon_trial_ends_at, vip_broadcast_enabled, abandoned_cart_nudge",
        )
        .single()
    : await admin
        .from("restaurant_whatsapp_accounts")
        .insert({ restaurant_id: parsed.data.restaurant_id, ...patch })
        .select(
          "whatsapp_ai_marketing_addon, addon_trial_ends_at, vip_broadcast_enabled, abandoned_cart_nudge",
        )
        .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ account: data });
}

export async function GET(req: Request) {
  const ok = await isCurrentUserSuperAdmin();
  if (!ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const restaurantId = new URL(req.url).searchParams.get("restaurant_id");
  if (!restaurantId) {
    return NextResponse.json(
      { error: "restaurant_id required" },
      { status: 400 },
    );
  }
  const admin = createServiceClient();
  const { data } = await admin
    .from("restaurant_whatsapp_accounts")
    .select(
      "whatsapp_ai_marketing_addon, addon_trial_ends_at, vip_broadcast_enabled, abandoned_cart_nudge, templates_status",
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  return NextResponse.json({ account: data });
}
