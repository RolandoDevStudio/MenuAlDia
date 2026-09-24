import { createServiceClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto-secret";
import { mx10ToWaE164, waIdToMx10 } from "@/lib/phone";
import {
  ABANDONED_CART_NUDGE_ENABLED,
  isWhatsappAiMarketingAddonActive,
} from "@/lib/whatsapp-bot/addon";
import type { WaSessionState } from "@/lib/whatsapp-bot/session";
import { sendWaText } from "@/lib/whatsapp-cloud";

export const runtime = "nodejs";

const NUDGE_AFTER_MS = 15 * 60 * 1000;
const NUDGE_MAX_AGE_MS = 3 * 60 * 60 * 1000;
const BATCH = 40;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

/**
 * Abandoned-cart nudge: one free-form message inside the 24h window.
 * Requires Add-On + abandoned_cart_nudge toggle.
 */
export async function POST(request: Request) {
  if (!authorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!ABANDONED_CART_NUDGE_ENABLED) {
    return Response.json({
      ok: true,
      disabled: true,
      sent: 0,
      skipped: 0,
    });
  }

  const admin = createServiceClient();
  const now = Date.now();
  const minUpdated = new Date(now - NUDGE_MAX_AGE_MS).toISOString();
  const maxUpdated = new Date(now - NUDGE_AFTER_MS).toISOString();

  const { data: sessions } = await admin
    .from("wa_session_state")
    .select("restaurant_id, wa_id, state, updated_at")
    .gte("updated_at", minUpdated)
    .lte("updated_at", maxUpdated)
    .limit(BATCH);

  let sent = 0;
  let skipped = 0;

  for (const row of sessions ?? []) {
    const state = (row.state ?? {}) as WaSessionState;
    if (
      !state.lines?.length ||
      state.step === "idle" ||
      state.step === "await_spei" ||
      state.nudgeSentAt
    ) {
      skipped += 1;
      continue;
    }

    const { data: account } = await admin
      .from("restaurant_whatsapp_accounts")
      .select(
        "whatsapp_bot_enabled, abandoned_cart_nudge, status, phone_number_id, access_token_encrypted, whatsapp_ai_marketing_addon, addon_trial_ends_at, message_templates_config",
      )
      .eq("restaurant_id", row.restaurant_id)
      .maybeSingle();

    if (
      !account?.whatsapp_bot_enabled ||
      !account.abandoned_cart_nudge ||
      account.status !== "connected" ||
      !account.phone_number_id ||
      !account.access_token_encrypted ||
      !isWhatsappAiMarketingAddonActive(account)
    ) {
      skipped += 1;
      continue;
    }

    const { data: restaurant } = await admin
      .from("restaurants")
      .select("name, slug")
      .eq("id", row.restaurant_id)
      .maybeSingle();

    let accessToken: string;
    try {
      accessToken = decryptSecret(account.access_token_encrypted);
    } catch {
      skipped += 1;
      continue;
    }

    const mx10 = waIdToMx10(row.wa_id) || null;
    const toE164 = mx10
      ? mx10ToWaE164(mx10)
      : row.wa_id.replace(/\D/g, "");
    if (!toE164) {
      skipped += 1;
      continue;
    }

    const cfg = (account.message_templates_config ?? {}) as {
      abandoned_cart?: { body?: string };
    };
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    const menuUrl =
      appUrl && restaurant?.slug ? `${appUrl}/${restaurant.slug}` : "";
    const defaultBody = `¡Hola! ¿Seguimos con tu pedido en ${restaurant?.name || "nuestro negocio"}? Responde MENU o escribe para continuar.${menuUrl ? `\n${menuUrl}` : ""}\n\n_BAJA para no promociones._`;
    const body = (cfg.abandoned_cart?.body || defaultBody).slice(0, 1000);

    const result = await sendWaText({
      phoneNumberId: account.phone_number_id,
      accessToken,
      toE164,
      text: body,
    });

    await admin.from("wa_message_log").insert({
      restaurant_id: row.restaurant_id,
      direction: "outbound",
      category: "service",
      wamid: result.wamid ?? null,
      ok: result.ok,
      template_name: "abandoned_cart_nudge",
    });

    if (result.ok) {
      sent += 1;
      await admin
        .from("wa_session_state")
        .update({
          state: { ...state, nudgeSentAt: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        })
        .eq("restaurant_id", row.restaurant_id)
        .eq("wa_id", row.wa_id);
    } else {
      skipped += 1;
    }
  }

  return Response.json({ ok: true, sent, skipped });
}

export async function GET(request: Request) {
  return POST(request);
}
