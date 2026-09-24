import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantSession } from "@/lib/admin-session";
import { can } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { WHATSAPP_BOT_GUIDE_VERSION } from "@/lib/whatsapp-bot-guide";
import { ABANDONED_CART_NUDGE_ENABLED } from "@/lib/whatsapp-bot/addon";

export const runtime = "nodejs";

const PatchSchema = z.object({
  restaurant_id: z.string().uuid(),
  whatsapp_bot_enabled: z.boolean().optional(),
  pull_menu_enabled: z.boolean().optional(),
  chat_orders_enabled: z.boolean().optional(),
  state_notifications_enabled: z.boolean().optional(),
  upselling_enabled: z.boolean().optional(),
  abandoned_cart_nudge: z.boolean().optional(),
  vip_broadcast_enabled: z.boolean().optional(),
  bot_menu_scope: z.enum(["specials_only", "all_active"]).optional(),
  ack_guide: z.boolean().optional(),
  guide_version: z.string().optional(),
});

export async function PATCH(req: Request) {
  const session = await requireTenantSession();
  if (!can(session.restaurant.plan_type, "whatsapp_bot")) {
    return NextResponse.json({ error: "Plan Pro requerido" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (parsed.data.restaurant_id !== session.restaurant.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("restaurant_whatsapp_accounts")
    .select("restaurant_id, guide_ack_at, guide_version, status")
    .eq("restaurant_id", session.restaurant.id)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  const d = parsed.data;
  if (d.whatsapp_bot_enabled !== undefined)
    patch.whatsapp_bot_enabled = d.whatsapp_bot_enabled;
  if (d.pull_menu_enabled !== undefined)
    patch.pull_menu_enabled = d.pull_menu_enabled;
  if (d.chat_orders_enabled !== undefined)
    patch.chat_orders_enabled = d.chat_orders_enabled;
  if (d.state_notifications_enabled !== undefined)
    patch.state_notifications_enabled = d.state_notifications_enabled;
  if (d.upselling_enabled !== undefined)
    patch.upselling_enabled = d.upselling_enabled;
  if (!ABANDONED_CART_NUDGE_ENABLED) {
    patch.abandoned_cart_nudge = false;
  } else if (d.abandoned_cart_nudge !== undefined) {
    patch.abandoned_cart_nudge = d.abandoned_cart_nudge;
  }
  if (d.vip_broadcast_enabled !== undefined)
    patch.vip_broadcast_enabled = d.vip_broadcast_enabled;
  if (d.bot_menu_scope !== undefined) patch.bot_menu_scope = d.bot_menu_scope;

  if (d.ack_guide) {
    const ver = d.guide_version || WHATSAPP_BOT_GUIDE_VERSION;
    patch.guide_ack_at = new Date().toISOString();
    patch.guide_ack_by = session.userId;
    patch.guide_version = ver;
  }

  if (
    d.whatsapp_bot_enabled === true &&
    !(
      (existing?.guide_version === WHATSAPP_BOT_GUIDE_VERSION &&
        existing?.guide_ack_at) ||
      d.ack_guide
    )
  ) {
    return NextResponse.json(
      { error: "Debes aceptar la guía antes de activar el asistente" },
      { status: 400 },
    );
  }

  if (d.whatsapp_bot_enabled === true && existing?.status !== "connected") {
    return NextResponse.json(
      { error: "Conecta tu número con Meta antes de activar el asistente" },
      { status: 400 },
    );
  }

  if (!existing) {
    const { data, error } = await supabase
      .from("restaurant_whatsapp_accounts")
      .insert({
        restaurant_id: session.restaurant.id,
        ...patch,
      })
      .select(
        "status, display_phone, whatsapp_bot_enabled, pull_menu_enabled, chat_orders_enabled, state_notifications_enabled, upselling_enabled, abandoned_cart_nudge, vip_broadcast_enabled, bot_menu_scope, guide_ack_at, guide_version, whatsapp_ai_marketing_addon, addon_trial_ends_at, templates_status, message_templates_config",
      )
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ account: data });
  }

  const { data, error } = await supabase
    .from("restaurant_whatsapp_accounts")
    .update(patch)
    .eq("restaurant_id", session.restaurant.id)
    .select(
      "status, display_phone, whatsapp_bot_enabled, pull_menu_enabled, chat_orders_enabled, state_notifications_enabled, upselling_enabled, abandoned_cart_nudge, vip_broadcast_enabled, bot_menu_scope, guide_ack_at, guide_version, whatsapp_ai_marketing_addon, addon_trial_ends_at, templates_status, message_templates_config",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ account: data });
}
