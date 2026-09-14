import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto-secret";
import { labelsFor, normalizeBusinessType } from "@/lib/business-labels";
import { waIdToMx10, mx10ToWaE164 } from "@/lib/phone";
import { sendWaText, verifyMetaSignature } from "@/lib/whatsapp-cloud";
import { effectiveAcceptingOrders } from "@/lib/store-hours";

export const runtime = "nodejs";

type WaAccountRow = {
  restaurant_id: string;
  phone_number_id: string | null;
  access_token_encrypted: string | null;
  status: string;
  whatsapp_bot_enabled: boolean;
  pull_menu_enabled: boolean;
  chat_orders_enabled: boolean;
  bot_menu_scope: string;
};

type ServiceClient = ReturnType<typeof createServiceClient>;

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
          "restaurant_id, phone_number_id, access_token_encrypted, status, whatsapp_bot_enabled, pull_menu_enabled, chat_orders_enabled, bot_menu_scope",
        )
        .eq("phone_number_id", phoneNumberId)
        .maybeSingle();

      if (!account?.restaurant_id) continue;
      const acc = account as WaAccountRow;
      if (
        !acc.whatsapp_bot_enabled ||
        acc.status !== "connected" ||
        !acc.access_token_encrypted
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
        const text = (msg.text?.body || "").trim();
        await handleInboundText({
          admin,
          account: acc,
          fromWaId: from,
          text,
          contactName: value.contacts?.[0]?.profile?.name,
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
  }[];
};

async function handleInboundText(opts: {
  admin: ServiceClient;
  account: WaAccountRow;
  fromWaId: string;
  text: string;
  contactName?: string;
}) {
  const { admin, account, fromWaId, text, contactName } = opts;
  const mx10 = waIdToMx10(fromWaId);
  const toE164 = mx10 ? mx10ToWaE164(mx10)! : fromWaId.replace(/\D/g, "");

  let accessToken: string;
  try {
    accessToken = decryptSecret(account.access_token_encrypted!);
  } catch {
    return;
  }
  if (!account.phone_number_id || !toE164) return;

  if (mx10) {
    await admin.rpc("upsert_customer_by_phone", {
      p_restaurant_id: account.restaurant_id,
      p_name: contactName || "Cliente WhatsApp",
      p_phone: mx10,
      p_bump_order: false,
    });
    await admin
      .from("customers")
      .update({ wa_id: fromWaId.replace(/\D/g, "") })
      .eq("restaurant_id", account.restaurant_id)
      .eq("phone", mx10);
  }

  const { data: customer } = mx10
    ? await admin
        .from("customers")
        .select("id, bot_paused, wa_opt_in")
        .eq("restaurant_id", account.restaurant_id)
        .eq("phone", mx10)
        .maybeSingle()
    : { data: null };

  if (customer?.bot_paused) return;

  const normalized = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();

  if (normalized === "baja" || normalized === "cancelar") {
    if (mx10) {
      await admin
        .from("customers")
        .update({ wa_opt_in: false })
        .eq("restaurant_id", account.restaurant_id)
        .eq("phone", mx10);
    }
    const r = await sendWaText({
      phoneNumberId: account.phone_number_id,
      accessToken,
      toE164,
      text: "Listo: ya no te enviaremos mensajes promocionales. Si cambias de opinión, escribe MENU.",
    });
    await logOutbound(admin, account.restaurant_id, r.wamid, r.ok);
    return;
  }

  const isMenuIntent =
    /^(menu|menú|carta|catalogo|catálogo|servicios|hola|buenos dias|buenas tardes|buenas noches)$/i.test(
      normalized,
    ) ||
    normalized.includes("menu") ||
    normalized.includes("menú");

  if (!isMenuIntent || !account.pull_menu_enabled) return;

  const { data: restaurant } = await admin
    .from("restaurants")
    .select(
      "id, name, slug, business_type, accepting_orders, schedule_hours, schedule_auto, orders_override, closed_message, plan_type",
    )
    .eq("id", account.restaurant_id)
    .maybeSingle();

  if (!restaurant) return;

  const labels = labelsFor(restaurant.business_type);
  const open = effectiveAcceptingOrders({
    accepting_orders: restaurant.accepting_orders,
    schedule_hours: restaurant.schedule_hours,
    schedule_auto: restaurant.schedule_auto,
    orders_override: restaurant.orders_override,
  });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const menuUrl = appUrl ? `${appUrl}/${restaurant.slug}` : "";

  if (!open) {
    const closedMsg =
      String(restaurant.closed_message || "").trim() ||
      `Por ahora ${restaurant.name} no está tomando pedidos.`;
    const body = menuUrl
      ? `${closedMsg}\n\nPuedes ver el ${labels.catalog.toLowerCase()} aquí: ${menuUrl}`
      : closedMsg;
    const r = await sendWaText({
      phoneNumberId: account.phone_number_id,
      accessToken,
      toE164,
      text: body,
    });
    await logOutbound(admin, account.restaurant_id, r.wamid, r.ok);
    return;
  }

  const giro = normalizeBusinessType(restaurant.business_type);
  const keywordHint =
    giro === "servicios"
      ? "SERVICIOS"
      : giro === "productos"
        ? "CATÁLOGO"
        : "MENU";

  let menuBody = `¡Hola! Soy el asistente de *${restaurant.name}*.\n\n`;
  if (account.bot_menu_scope === "specials_only") {
    menuBody += await buildDailySpecialsText(
      admin,
      account.restaurant_id,
      labels,
    );
  } else {
    menuBody += `Consulta nuestro ${labels.catalog.toLowerCase()} completo`;
    menuBody += menuUrl ? `:\n${menuUrl}` : ".";
  }

  menuBody += `\n\nResponde con lo que deseas pedir`;
  if (account.chat_orders_enabled) {
    menuBody += `, o escribe el nombre del ${labels.dish.toLowerCase()}.`;
  } else if (menuUrl) {
    menuBody += ` en el menú: ${menuUrl}`;
  } else {
    menuBody += ".";
  }
  menuBody += `\n\n_Escribe BAJA para no recibir promociones. (También puedes escribir ${keywordHint})_`;

  const r = await sendWaText({
    phoneNumberId: account.phone_number_id,
    accessToken,
    toE164,
    text: menuBody.slice(0, 4000),
  });
  await logOutbound(admin, account.restaurant_id, r.wamid, r.ok);
}

async function buildDailySpecialsText(
  admin: ServiceClient,
  restaurantId: string,
  labels: ReturnType<typeof labelsFor>,
): Promise<string> {
  const { data: daily } = await admin
    .from("daily_menu_selections")
    .select("id, package_price, is_active")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (!daily?.id || daily.is_active === false) {
    return `Hoy aún no hay ${labels.dailyMenu.toLowerCase()} publicado.`;
  }

  const { data: items } = await admin
    .from("daily_menu_dishes")
    .select("dish_id, dishes(name, price, is_active)")
    .eq("daily_menu_id", daily.id);

  const lines: string[] = [`*${labels.dailyMenu}* de hoy:\n`];
  let n = 0;
  for (const row of items ?? []) {
    const d = row.dishes as
      | { name?: string; price?: number; is_active?: boolean }
      | { name?: string; price?: number; is_active?: boolean }[]
      | null;
    const dish = Array.isArray(d) ? d[0] : d;
    if (!dish?.name || dish.is_active === false) continue;
    n += 1;
    if (n > 10) {
      lines.push("…y más en el menú web.");
      break;
    }
    const price =
      dish.price != null ? ` — $${Number(dish.price).toFixed(0)}` : "";
    lines.push(`${n}. ${dish.name}${price}`);
  }
  if (n === 0) {
    return `Hoy aún no hay ${labels.dailyMenu.toLowerCase()} con ítems.`;
  }
  return lines.join("\n");
}

async function logOutbound(
  admin: ServiceClient,
  restaurantId: string,
  wamid: string | undefined,
  ok: boolean,
) {
  await admin.from("wa_message_log").insert({
    restaurant_id: restaurantId,
    direction: "outbound",
    category: "service",
    wamid: wamid ?? null,
    ok,
  });
}
