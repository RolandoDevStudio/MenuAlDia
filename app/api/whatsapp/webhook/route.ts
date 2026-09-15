import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { handleWhatsAppInbound } from "@/lib/whatsapp-bot/handler";

export const runtime = "nodejs";

type WaAccountRow = {
  restaurant_id: string;
  phone_number_id: string | null;
  access_token_encrypted: string | null;
  status: string;
  whatsapp_bot_enabled: boolean;
  pull_menu_enabled: boolean;
  chat_orders_enabled: boolean;
  state_notifications_enabled: boolean;
  upselling_enabled: boolean;
  abandoned_cart_nudge: boolean;
  vip_broadcast_enabled: boolean;
  bot_menu_scope: string;
  whatsapp_ai_marketing_addon: boolean;
  addon_trial_ends_at: string | null;
};

function verifyTokenOk(token: string | null): boolean {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  return Boolean(expected && token && token === expected);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && verifyTokenOk(token) && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const { verifyMetaSignature } = await import("@/lib/whatsapp-cloud");
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");
  if (!verifyMetaSignature(raw, sig)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  after(() => {
    void processWebhookPayload(payload).catch((err) => {
      console.error("[whatsapp/webhook]", err);
    });
  });

  return new Response("EVENT_RECEIVED", { status: 200 });
}

async function processWebhookPayload(payload: unknown) {
  const admin = createServiceClient();
  const entries =
    (payload as { entry?: { changes?: { value?: WaValue }[] }[] })?.entry ??
    [];

  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages?.length || !value.metadata?.phone_number_id) {
        continue;
      }
      const phoneNumberId = value.metadata.phone_number_id;
      const { data: account } = await admin
        .from("restaurant_whatsapp_accounts")
        .select(
          "restaurant_id, phone_number_id, access_token_encrypted, status, whatsapp_bot_enabled, pull_menu_enabled, chat_orders_enabled, state_notifications_enabled, upselling_enabled, abandoned_cart_nudge, vip_broadcast_enabled, bot_menu_scope, whatsapp_ai_marketing_addon, addon_trial_ends_at",
        )
        .eq("phone_number_id", phoneNumberId)
        .maybeSingle();

      if (!account?.restaurant_id) continue;
      const acc = account as WaAccountRow;
      if (
        !acc.whatsapp_bot_enabled ||
        acc.status !== "connected" ||
        !acc.access_token_encrypted ||
        !acc.phone_number_id
      ) {
        continue;
      }

      for (const msg of value.messages) {
        const wamid = msg.id;
        if (!wamid) continue;

        const { error: idemErr } = await admin
          .from("wa_processed_messages")
          .insert({
            wamid,
            restaurant_id: acc.restaurant_id,
          });
        if (idemErr) continue;

        await admin.from("wa_message_log").insert({
          restaurant_id: acc.restaurant_id,
          direction: "inbound",
          category: "service",
          wamid,
          ok: true,
        });

        const from = msg.from;
        if (!from) continue;

        const interactiveId =
          msg.interactive?.button_reply?.id ||
          msg.interactive?.list_reply?.id ||
          undefined;

        await handleWhatsAppInbound({
          admin,
          account: {
            restaurant_id: acc.restaurant_id,
            phone_number_id: acc.phone_number_id,
            access_token: "",
            access_token_encrypted: acc.access_token_encrypted,
            whatsapp_bot_enabled: acc.whatsapp_bot_enabled,
            pull_menu_enabled: acc.pull_menu_enabled,
            chat_orders_enabled: acc.chat_orders_enabled,
            state_notifications_enabled: acc.state_notifications_enabled,
            upselling_enabled: Boolean(acc.upselling_enabled),
            abandoned_cart_nudge: Boolean(acc.abandoned_cart_nudge),
            vip_broadcast_enabled: Boolean(acc.vip_broadcast_enabled),
            bot_menu_scope: acc.bot_menu_scope,
            whatsapp_ai_marketing_addon: Boolean(
              acc.whatsapp_ai_marketing_addon,
            ),
            addon_trial_ends_at: acc.addon_trial_ends_at,
          },
          fromWaId: from,
          contactName: value.contacts?.[0]?.profile?.name,
          message: {
            type: msg.type,
            text: msg.text?.body,
            buttonReplyId: interactiveId,
            imageId: msg.image?.id,
            imageCaption: msg.image?.caption,
          },
        });
      }
    }
  }
}

type WaValue = {
  messaging_product?: string;
  metadata?: { phone_number_id?: string; display_phone_number?: string };
  contacts?: { profile?: { name?: string }; wa_id?: string }[];
  messages?: {
    id?: string;
    from?: string;
    type?: string;
    text?: { body?: string };
    image?: { id?: string; caption?: string };
    interactive?: {
      button_reply?: { id?: string; title?: string };
      list_reply?: { id?: string; title?: string };
    };
  }[];
};
