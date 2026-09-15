import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantSession } from "@/lib/admin-session";
import { can } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PatchSchema = z.object({
  restaurant_id: z.string().uuid(),
  message_templates_config: z
    .object({
      menu_pull: z
        .object({ body: z.string().max(2000).optional() })
        .optional(),
      abandoned_cart: z
        .object({ body: z.string().max(2000).optional() })
        .optional(),
      order_confirm: z
        .object({ body: z.string().max(2000).optional() })
        .optional(),
      menu_del_dia: z
        .object({
          name: z.string().max(120).optional(),
          language: z.string().max(12).optional(),
          body: z.string().max(2000).optional(),
        })
        .optional(),
    })
    .optional(),
  templates_status: z
    .record(z.string(), z.enum(["PENDING", "APPROVED", "REJECTED", "PAUSED"]))
    .optional(),
});

/** Save local WA message copy / template metadata (manual + AI-assisted). */
export async function PATCH(req: Request) {
  const session = await requireTenantSession();
  if (!can(session.restaurant.plan_type, "whatsapp_bot")) {
    return NextResponse.json({ error: "Plan Pro requerido" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success || parsed.data.restaurant_id !== session.restaurant.id) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("restaurant_whatsapp_accounts")
    .select("message_templates_config, templates_status")
    .eq("restaurant_id", session.restaurant.id)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.message_templates_config) {
    patch.message_templates_config = {
      ...((existing?.message_templates_config as object) ?? {}),
      ...parsed.data.message_templates_config,
    };
  }
  if (parsed.data.templates_status) {
    patch.templates_status = {
      ...((existing?.templates_status as object) ?? {}),
      ...parsed.data.templates_status,
    };
  }

  const { data, error } = existing
    ? await supabase
        .from("restaurant_whatsapp_accounts")
        .update(patch)
        .eq("restaurant_id", session.restaurant.id)
        .select(
          "message_templates_config, templates_status, upselling_enabled, abandoned_cart_nudge, vip_broadcast_enabled, whatsapp_ai_marketing_addon, addon_trial_ends_at",
        )
        .single()
    : await supabase
        .from("restaurant_whatsapp_accounts")
        .insert({ restaurant_id: session.restaurant.id, ...patch })
        .select(
          "message_templates_config, templates_status, upselling_enabled, abandoned_cart_nudge, vip_broadcast_enabled, whatsapp_ai_marketing_addon, addon_trial_ends_at",
        )
        .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ account: data });
}
