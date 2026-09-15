import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantSession } from "@/lib/admin-session";
import { can } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto-secret";
import { mx10ToWaE164 } from "@/lib/phone";
import { isWhatsappAiMarketingAddonActive } from "@/lib/whatsapp-bot/addon";
import { sendWaTemplate } from "@/lib/whatsapp-cloud";

export const runtime = "nodejs";

const BodySchema = z.object({
  restaurant_id: z.string().uuid(),
  dry_run: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

/**
 * VIP Marketing broadcast to wa_opt_in customers.
 * Requires Add-On + vip_broadcast_enabled + APPROVED menu_del_dia template.
 */
export async function POST(req: Request) {
  const session = await requireTenantSession();
  if (!can(session.restaurant.plan_type, "whatsapp_bot")) {
    return NextResponse.json({ error: "Plan Pro requerido" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success || parsed.data.restaurant_id !== session.restaurant.id) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: account } = await supabase
    .from("restaurant_whatsapp_accounts")
    .select(
      "whatsapp_bot_enabled, vip_broadcast_enabled, status, phone_number_id, access_token_encrypted, whatsapp_ai_marketing_addon, addon_trial_ends_at, templates_status, message_templates_config",
    )
    .eq("restaurant_id", session.restaurant.id)
    .maybeSingle();

  if (!isWhatsappAiMarketingAddonActive(account)) {
    return NextResponse.json(
      { error: "Requiere Add-On IA & Marketing (o trial activo)" },
      { status: 403 },
    );
  }
  if (!account?.vip_broadcast_enabled) {
    return NextResponse.json(
      { error: "Activa el toggle de difusión VIP" },
      { status: 400 },
    );
  }
  if (
    account.status !== "connected" ||
    !account.phone_number_id ||
    !account.access_token_encrypted
  ) {
    return NextResponse.json(
      { error: "WhatsApp no está conectado" },
      { status: 400 },
    );
  }

  const templates = (account.templates_status ?? {}) as Record<string, string>;
  if (templates.menu_del_dia !== "APPROVED") {
    return NextResponse.json(
      {
        error:
          "La plantilla Marketing menu_del_dia debe estar APPROVED en Meta antes de difundir.",
      },
      { status: 400 },
    );
  }

  const cfg = (account.message_templates_config ?? {}) as {
    menu_del_dia?: { name?: string; language?: string };
  };
  const templateName = cfg.menu_del_dia?.name || "menu_del_dia";
  const language = cfg.menu_del_dia?.language || "es_MX";
  const limit = parsed.data.limit ?? 40;

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, phone, orders_count, last_order_at")
    .eq("restaurant_id", session.restaurant.id)
    .eq("wa_opt_in", true)
    .eq("bot_paused", false)
    .order("orders_count", { ascending: false })
    .limit(limit);

  const recipients = (customers ?? []).filter(
    (c) => c.phone && String(c.phone).length === 10,
  );

  if (parsed.data.dry_run) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      would_send: recipients.length,
      templateName,
    });
  }

  let accessToken: string;
  try {
    accessToken = decryptSecret(account.access_token_encrypted);
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 500 });
  }

  const admin = createServiceClient();
  let sent = 0;
  let failed = 0;

  for (const c of recipients) {
    const toE164 = mx10ToWaE164(String(c.phone));
    if (!toE164) {
      failed += 1;
      continue;
    }
    const firstName = String(c.name || "amigo").split(" ")[0] || "amigo";
    const result = await sendWaTemplate({
      phoneNumberId: account.phone_number_id,
      accessToken,
      toE164,
      templateName,
      languageCode: language,
      bodyParameters: [firstName, session.restaurant.name],
    });
    await admin.from("wa_message_log").insert({
      restaurant_id: session.restaurant.id,
      direction: "outbound",
      category: "marketing",
      template_name: templateName,
      wamid: result.wamid ?? null,
      ok: result.ok,
    });
    if (result.ok) sent += 1;
    else failed += 1;
  }

  return NextResponse.json({
    ok: true,
    sent,
    failed,
    templateName,
  });
}
