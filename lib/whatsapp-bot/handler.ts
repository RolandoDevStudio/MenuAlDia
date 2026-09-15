import { labelsFor, normalizeBusinessType } from "@/lib/business-labels";
import { restaurantFulfillmentModes } from "@/lib/fulfillment";
import { decryptSecret } from "@/lib/crypto-secret";
import { mx10ToWaE164, waIdToMx10 } from "@/lib/phone";
import { effectiveAcceptingOrders } from "@/lib/store-hours";
import {
  formatClabeDisplay,
  publicTransferDetails,
} from "@/lib/transfer-details";
import type { FulfillmentMode, PaymentMethod } from "@/lib/types";
import {
  downloadWhatsAppMedia,
  sendWaButtons,
  sendWaText,
  type WaSendResult,
} from "@/lib/whatsapp-cloud";
import {
  attachPaymentProof,
  createBotOrder,
} from "@/lib/whatsapp-bot/orders";
import { isWhatsappAiMarketingAddonActive } from "@/lib/whatsapp-bot/addon";
import {
  clearSession,
  loadSession,
  looksFrustrated,
  saveSession,
  type ServiceClient,
  type WaAccountCtx,
  type WaCartLine,
  type WaSessionState,
} from "@/lib/whatsapp-bot/session";

type RestaurantRow = {
  id: string;
  name: string;
  slug: string;
  business_type: string | null;
  accepting_orders: boolean | null;
  schedule_hours: unknown;
  schedule_auto: boolean | null;
  orders_override: string | null;
  closed_message: string | null;
  show_transfer_details?: boolean;
  bank_account_holder?: string | null;
  bank_name?: string | null;
  bank_clabe?: string | null;
  offers_delivery?: boolean;
  offers_pickup?: boolean;
  offers_dine_in?: boolean;
  shipping_on_quote?: boolean;
};

export type InboundMessage = {
  type?: string;
  text?: string;
  buttonReplyId?: string;
  imageId?: string;
  imageCaption?: string;
};

async function logOutbound(
  admin: ServiceClient,
  restaurantId: string,
  r: WaSendResult,
) {
  await admin.from("wa_message_log").insert({
    restaurant_id: restaurantId,
    direction: "outbound",
    category: "service",
    wamid: r.wamid ?? null,
    ok: r.ok,
  });
}

async function reply(
  ctx: {
    admin: ServiceClient;
    phoneNumberId: string;
    accessToken: string;
    toE164: string;
    restaurantId: string;
  },
  text: string,
) {
  const r = await sendWaText({
    phoneNumberId: ctx.phoneNumberId,
    accessToken: ctx.accessToken,
    toE164: ctx.toE164,
    text: text.slice(0, 4000),
  });
  await logOutbound(ctx.admin, ctx.restaurantId, r);
  return r;
}

async function replyButtons(
  ctx: {
    admin: ServiceClient;
    phoneNumberId: string;
    accessToken: string;
    toE164: string;
    restaurantId: string;
  },
  body: string,
  buttons: { id: string; title: string }[],
) {
  const r = await sendWaButtons({
    phoneNumberId: ctx.phoneNumberId,
    accessToken: ctx.accessToken,
    toE164: ctx.toE164,
    body,
    buttons,
  });
  await logOutbound(ctx.admin, ctx.restaurantId, r);
  return r;
}

function fold(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function pickUpsell(
  menuItems: { id: string; name: string; price: number }[],
  lines: WaCartLine[],
): { id: string; name: string; price: number } | null {
  const taken = new Set(lines.map((l) => l.dishId));
  const candidates = menuItems
    .filter((m) => !taken.has(m.id) && m.price > 0)
    .sort((a, b) => a.price - b.price);
  return candidates[0] ?? null;
}

async function loadMenuItems(
  admin: ServiceClient,
  restaurantId: string,
  scope: string,
): Promise<{ id: string; name: string; price: number }[]> {
  if (scope === "specials_only") {
    const { data: daily } = await admin
      .from("daily_menu_selections")
      .select("id, is_active")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (!daily?.id || daily.is_active === false) return [];
    const { data: items } = await admin
      .from("daily_menu_dishes")
      .select("dish_id, dishes(id, name, price, is_active)")
      .eq("daily_menu_id", daily.id);
    const out: { id: string; name: string; price: number }[] = [];
    for (const row of items ?? []) {
      const d = row.dishes as
        | { id?: string; name?: string; price?: number; is_active?: boolean }
        | { id?: string; name?: string; price?: number; is_active?: boolean }[]
        | null;
      const dish = Array.isArray(d) ? d[0] : d;
      if (!dish?.id || !dish.name || dish.is_active === false) continue;
      out.push({
        id: dish.id,
        name: dish.name,
        price: Number(dish.price ?? 0),
      });
      if (out.length >= 10) break;
    }
    return out;
  }

  const { data: dishes } = await admin
    .from("dishes")
    .select("id, name, price")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .limit(10);
  return (dishes ?? []).map((d) => ({
    id: d.id as string,
    name: String(d.name),
    price: Number(d.price ?? 0),
  }));
}

function formatMenuList(
  items: { name: string; price: number }[],
  title: string,
): string {
  if (items.length === 0) return `${title}\n(Sin ítems por ahora.)`;
  const lines = items.map(
    (it, i) => `${i + 1}. ${it.name} — $${it.price.toFixed(0)}`,
  );
  return `${title}\n\n${lines.join("\n")}`;
}

async function lastOrderLines(
  admin: ServiceClient,
  restaurantId: string,
  phone: string,
): Promise<WaCartLine[] | null> {
  const { data: orders } = await admin
    .from("orders")
    .select("payload")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(8);
  for (const o of orders ?? []) {
    const p = o.payload as {
      phone?: string;
      items?: {
        dishId?: string;
        name?: string;
        unitPrice?: number;
        quantity?: number;
      }[];
    } | null;
    if (!p || p.phone !== phone || !p.items?.length) continue;
    return p.items
      .filter((i) => i.dishId && i.name)
      .map((i) => ({
        dishId: String(i.dishId),
        name: String(i.name),
        unitPrice: Number(i.unitPrice ?? 0),
        quantity: Number(i.quantity ?? 1),
      }));
  }
  return null;
}

export async function handleWhatsAppInbound(opts: {
  admin: ServiceClient;
  account: WaAccountCtx & {
    access_token_encrypted: string;
    phone_number_id: string;
  };
  fromWaId: string;
  contactName?: string;
  message: InboundMessage;
}) {
  const { admin, account, fromWaId, contactName, message } = opts;
  const mx10 = waIdToMx10(fromWaId);
  const toE164 = mx10 ? mx10ToWaE164(mx10)! : fromWaId.replace(/\D/g, "");
  const waKey = fromWaId.replace(/\D/g, "");

  let accessToken: string;
  try {
    accessToken = decryptSecret(account.access_token_encrypted);
  } catch {
    return;
  }
  if (!account.phone_number_id || !toE164) return;

  const sendCtx = {
    admin,
    phoneNumberId: account.phone_number_id,
    accessToken,
    toE164,
    restaurantId: account.restaurant_id,
  };

  if (mx10) {
    await admin.rpc("upsert_customer_by_phone", {
      p_restaurant_id: account.restaurant_id,
      p_name: contactName || "Cliente WhatsApp",
      p_phone: mx10,
      p_bump_order: false,
    });
    await admin
      .from("customers")
      .update({ wa_id: waKey })
      .eq("restaurant_id", account.restaurant_id)
      .eq("phone", mx10);
  }

  const { data: customer } = mx10
    ? await admin
        .from("customers")
        .select("id, name, bot_paused, wa_opt_in, favorite_service, address")
        .eq("restaurant_id", account.restaurant_id)
        .eq("phone", mx10)
        .maybeSingle()
    : { data: null };

  if (customer?.bot_paused) return;

  const text = (message.text || message.imageCaption || "").trim();
  const buttonId = message.buttonReplyId || "";
  const normalized = fold(text || buttonId);

  if (normalized === "baja" || normalized === "cancelar") {
    if (mx10) {
      await admin
        .from("customers")
        .update({ wa_opt_in: false })
        .eq("restaurant_id", account.restaurant_id)
        .eq("phone", mx10);
    }
    await clearSession(admin, account.restaurant_id, waKey);
    await reply(
      sendCtx,
      "Listo: ya no te enviaremos mensajes promocionales. Si cambias de opinión, escribe MENU.",
    );
    return;
  }

  if (
    mx10 &&
    (normalized === "si quiero" ||
      normalized === "sí quiero" ||
      normalized === "si quiero promociones")
  ) {
    await admin
      .from("customers")
      .update({ wa_opt_in: true })
      .eq("restaurant_id", account.restaurant_id)
      .eq("phone", mx10);
    await reply(sendCtx, "¡Gracias! Te tendremos al tanto de promociones.");
    return;
  }

  if (looksFrustrated(text) && mx10) {
    await admin
      .from("customers")
      .update({ bot_paused: true })
      .eq("restaurant_id", account.restaurant_id)
      .eq("phone", mx10);
    await clearSession(admin, account.restaurant_id, waKey);
    try {
      const { emitTenantNotification } = await import(
        "@/lib/notifications/emit"
      );
      await emitTenantNotification({
        restaurantId: account.restaurant_id,
        type: "wa_bot_paused",
        title: "Cliente pidió atención humana (WhatsApp)",
        body: `${customer?.name || contactName || "Cliente"} · ${mx10}`,
        href: "/admin/orders",
        payload: { phone: mx10, wa_id: fromWaId },
      });
    } catch {
      /* non-fatal */
    }
    await reply(
      sendCtx,
      "Entendido. Un miembro del equipo te atenderá pronto en este chat. Gracias por tu paciencia.",
    );
    return;
  }

  const { data: restaurant } = await admin
    .from("restaurants")
    .select(
      "id, name, slug, business_type, accepting_orders, schedule_hours, schedule_auto, orders_override, closed_message, show_transfer_details, bank_account_holder, bank_name, bank_clabe, offers_delivery, offers_pickup, offers_dine_in, shipping_on_quote",
    )
    .eq("id", account.restaurant_id)
    .maybeSingle();

  if (!restaurant) return;
  const r = restaurant as RestaurantRow;
  const labels = labelsFor(r.business_type);
  const giro = normalizeBusinessType(r.business_type);
  const open = effectiveAcceptingOrders({
    accepting_orders: r.accepting_orders,
    schedule_hours: r.schedule_hours,
    schedule_auto: r.schedule_auto,
    orders_override: r.orders_override,
  });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const menuUrl = appUrl ? `${appUrl}/${r.slug}` : "";
  let session = await loadSession(admin, account.restaurant_id, waKey);

  const isMenuIntent =
    /^(menu|carta|catalogo|servicios|hola|buenos dias|buenas tardes|buenas noches)$/i.test(
      normalized,
    ) ||
    normalized.includes("menu") ||
    buttonId === "menu";

  // Image while awaiting SPEI
  if (message.imageId && session.step === "await_spei" && session.pendingOrderId) {
    const media = await downloadWhatsAppMedia(message.imageId, accessToken);
    if (!media) {
      await admin
        .from("orders")
        .select("payload")
        .eq("id", session.pendingOrderId)
        .maybeSingle()
        .then(async ({ data }) => {
          const payload = {
            ...((data?.payload as object) ?? {}),
            payment_proof_error: true,
            payment_status: "pending",
          };
          await admin
            .from("orders")
            .update({ payload })
            .eq("id", session.pendingOrderId!);
        });
      try {
        const { emitTenantNotification } = await import(
          "@/lib/notifications/emit"
        );
        await emitTenantNotification({
          restaurantId: account.restaurant_id,
          type: "payment_proof_error",
          title: "Comprobante SPEI no descargado",
          body: "Solicítalo manualmente al cliente por WhatsApp.",
          href: "/admin/orders",
          payload: { orderId: session.pendingOrderId },
        });
      } catch {
        /* non-fatal */
      }
      await reply(
        sendCtx,
        "Recibimos tu mensaje, pero no pudimos guardar la imagen. Por favor reenvía el comprobante o mándalo cuando un asesor te escriba.",
      );
    } else {
      const visionOn = isWhatsappAiMarketingAddonActive(account);
      const attached = await attachPaymentProof({
        admin,
        orderId: session.pendingOrderId,
        restaurantId: account.restaurant_id,
        buffer: media.buffer,
        mimeType: media.mimeType,
        runVision: visionOn,
        businessName: r.name,
      });
      await reply(
        sendCtx,
        attached.ok
          ? "¡Gracias! Revisaremos tu comprobante y te avisamos. Escribe BAJA si no quieres promociones."
          : "Recibimos tu mensaje; el equipo revisará el pago. Escribe BAJA si no quieres promociones.",
      );
    }
    await clearSession(admin, account.restaurant_id, waKey);
    return;
  }

  // State machine for active order flow
  if (
    account.chat_orders_enabled &&
    session.step !== "idle" &&
    (text || buttonId || message.imageId)
  ) {
    const handled = await continueOrderFlow({
      admin,
      sendCtx,
      account,
      restaurant: r,
      labels,
      giro,
      open,
      mx10,
      contactName: customer?.name || contactName || "Cliente",
      customerAddress: customer?.address || "",
      favoriteService: customer?.favorite_service || "",
      session,
      waKey,
      text,
      buttonId,
      normalized,
      menuUrl,
    });
    if (handled) return;
  }

  if (!isMenuIntent || !account.pull_menu_enabled) {
    if (account.chat_orders_enabled && session.step === "idle" && text) {
      // Soft nudge into ordering if they send free text while open
      if (open && mx10) {
        await reply(
          sendCtx,
          `Escribe *MENU* para ver opciones${menuUrl ? ` o abre ${menuUrl}` : ""}.`,
        );
      }
    }
    return;
  }

  if (!open) {
    const closedMsg =
      String(r.closed_message || "").trim() ||
      `Por ahora ${r.name} no está tomando ${giro === "servicios" ? "citas" : "pedidos"}.`;
    const body = menuUrl
      ? `${closedMsg}\n\nPuedes ver el ${labels.catalog.toLowerCase()} aquí: ${menuUrl}`
      : closedMsg;
    await reply(sendCtx, body);
    return;
  }

  const items = await loadMenuItems(
    admin,
    account.restaurant_id,
    account.bot_menu_scope,
  );

  const keywordHint =
    giro === "servicios"
      ? "SERVICIOS"
      : giro === "productos"
        ? "CATÁLOGO"
        : "MENU";

  let intro = `¡Hola! Soy el asistente de *${r.name}*.\n\n`;
  if (account.bot_menu_scope === "specials_only") {
    intro += formatMenuList(items, `*${labels.dailyMenu}* de hoy:`);
  } else {
    intro += formatMenuList(
      items,
      `*${labels.catalog}* (elige un número):`,
    );
    if (menuUrl) intro += `\n\nCompleto: ${menuUrl}`;
  }

  if (giro === "servicios") {
    intro += `\n\nResponde con el *número* del servicio para agendar, o escribe *SIEMPRE* si quieres tu favorito.`;
  } else if (account.chat_orders_enabled) {
    intro += `\n\nResponde con el *número* para pedir, o *SIEMPRE* para repetir tu último pedido.`;
  } else if (menuUrl) {
    intro += `\n\nPide en el menú: ${menuUrl}`;
  }

  intro += `\n\n_Escribe BAJA para no recibir promociones. (${keywordHint})_`;

  await reply(sendCtx, intro);

  if (account.chat_orders_enabled && items.length > 0) {
    session = {
      step: "pick_item",
      menuItems: items,
    };
    await saveSession(admin, account.restaurant_id, waKey, session);

    const usual = mx10
      ? await lastOrderLines(admin, account.restaurant_id, mx10)
      : null;
    if (usual?.length || (giro === "servicios" && customer?.favorite_service)) {
      await replyButtons(sendCtx, "¿Qué prefieres?", [
        { id: "usual", title: "Lo de siempre" },
        { id: "pick_list", title: "Elegir de la lista" },
      ]);
    }
  }
}

async function continueOrderFlow(opts: {
  admin: ServiceClient;
  sendCtx: {
    admin: ServiceClient;
    phoneNumberId: string;
    accessToken: string;
    toE164: string;
    restaurantId: string;
  };
  account: WaAccountCtx;
  restaurant: RestaurantRow;
  labels: ReturnType<typeof labelsFor>;
  giro: ReturnType<typeof normalizeBusinessType>;
  open: boolean;
  mx10: string | null;
  contactName: string;
  customerAddress: string;
  favoriteService: string;
  session: WaSessionState;
  waKey: string;
  text: string;
  buttonId: string;
  normalized: string;
  menuUrl: string;
}): Promise<boolean> {
  const {
    admin,
    sendCtx,
    account,
    restaurant: r,
    labels,
    giro,
    open,
    mx10,
    contactName,
    customerAddress,
    favoriteService,
    waKey,
    text,
    buttonId,
    normalized,
    menuUrl,
  } = opts;
  let session = opts.session;

  if (!open && session.step !== "await_spei") {
    await clearSession(admin, account.restaurant_id, waKey);
    await reply(
      sendCtx,
      String(r.closed_message || "").trim() ||
        `Por ahora no estamos tomando ${giro === "servicios" ? "citas" : "pedidos"}.`,
    );
    return true;
  }

  if (normalized === "cancelar pedido" || normalized === "salir") {
    await clearSession(admin, account.restaurant_id, waKey);
    await reply(sendCtx, "Listo, cancelé el flujo. Escribe MENU cuando quieras.");
    return true;
  }

  // Pick item / usual
  if (session.step === "pick_item") {
    let lines: WaCartLine[] | null = null;

    if (buttonId === "usual" || normalized === "siempre" || normalized === "lo de siempre") {
      if (giro === "servicios" && favoriteService) {
        session = {
          step: "cita_confirm",
          lines: [
            {
              dishId: "favorite",
              name: favoriteService,
              unitPrice: 0,
              quantity: 1,
            },
          ],
        };
        await saveSession(admin, account.restaurant_id, waKey, session);
        await replyButtons(
          sendCtx,
          `¿Confirmamos cita para: *${favoriteService}*?`,
          [
            { id: "cita_yes", title: "Sí, agendar" },
            { id: "cita_no", title: "No" },
          ],
        );
        return true;
      }
      if (mx10) {
        lines = await lastOrderLines(admin, account.restaurant_id, mx10);
      }
      if (!lines?.length) {
        await reply(
          sendCtx,
          "Aún no tengo un pedido anterior. Elige un número de la lista.",
        );
        return true;
      }
    } else if (buttonId === "pick_list") {
      await reply(sendCtx, "Perfecto, responde con el número de la lista.");
      return true;
    } else {
      const n = Number.parseInt(normalized.replace(/\D/g, ""), 10);
      const items = session.menuItems ?? [];
      if (!Number.isFinite(n) || n < 1 || n > items.length) {
        await reply(sendCtx, "Responde con un número de la lista, o SIEMPRE.");
        return true;
      }
      const it = items[n - 1]!;
      lines = [
        {
          dishId: it.id,
          name: it.name,
          unitPrice: it.price,
          quantity: 1,
        },
      ];
    }

    if (!lines) return true;

    if (giro === "servicios") {
      session = { step: "cita_confirm", lines, menuItems: session.menuItems };
      await saveSession(admin, account.restaurant_id, waKey, session);
      await replyButtons(
        sendCtx,
        `¿Confirmamos cita para: *${lines[0]!.name}*?`,
        [
          { id: "cita_yes", title: "Sí, agendar" },
          { id: "cita_no", title: "No" },
        ],
      );
      return true;
    }

    const upsell = account.upselling_enabled
      ? pickUpsell(session.menuItems ?? [], lines)
      : null;
    if (upsell && !session.upsellOffered) {
      session = {
        step: "ask_upsell",
        lines,
        menuItems: session.menuItems,
        upsellItem: upsell,
        upsellOffered: true,
      };
      await saveSession(admin, account.restaurant_id, waKey, session);
      await replyButtons(
        sendCtx,
        `¿Le agregamos *${upsell.name}* (+$${upsell.price.toFixed(0)})?`,
        [
          { id: "upsell_yes", title: "Sí, agregar" },
          { id: "upsell_no", title: "No, gracias" },
        ],
      );
      return true;
    }

    session = { step: "ask_fulfillment", lines, menuItems: session.menuItems };
    await saveSession(admin, account.restaurant_id, waKey, session);
    await askFulfillment(sendCtx, r, labels);
    return true;
  }

  if (session.step === "ask_upsell") {
    let lines = session.lines ?? [];
    if (buttonId === "upsell_yes" || normalized === "si" || normalized === "sí") {
      if (session.upsellItem) {
        lines = [
          ...lines,
          {
            dishId: session.upsellItem.id,
            name: session.upsellItem.name,
            unitPrice: session.upsellItem.price,
            quantity: 1,
          },
        ];
      }
    }
    session = {
      step: "ask_fulfillment",
      lines,
      menuItems: session.menuItems,
      upsellOffered: true,
    };
    await saveSession(admin, account.restaurant_id, waKey, session);
    await askFulfillment(sendCtx, r, labels);
    return true;
  }

  if (session.step === "cita_confirm") {
    if (buttonId === "cita_no" || normalized === "no") {
      await clearSession(admin, account.restaurant_id, waKey);
      await reply(sendCtx, "Ok. Escribe MENU para ver servicios otra vez.");
      return true;
    }
    if (buttonId !== "cita_yes" && normalized !== "si" && normalized !== "sí") {
      await reply(sendCtx, "Confirma con el botón o responde Sí / No.");
      return true;
    }
    if (!mx10 || !session.lines?.length) {
      await reply(sendCtx, "No pude identificar tu número. Escribe MENU.");
      await clearSession(admin, account.restaurant_id, waKey);
      return true;
    }
    const created = await createBotOrder({
      admin,
      restaurantId: account.restaurant_id,
      customerName: contactName,
      phone: mx10,
      waId: waKey,
      lines: session.lines,
      fulfillment: "pickup",
      payment: "cash",
      orderKind: "appointment",
    });
    await clearSession(admin, account.restaurant_id, waKey);
    if (!created) {
      await reply(sendCtx, "Hubo un problema al registrar la cita. Intenta de nuevo.");
      return true;
    }
    await reply(
      sendCtx,
      `¡Cita registrada${created.folio != null ? ` #${created.folio}` : ""}! Te contactaremos para confirmar horario.\n\n_Escribe BAJA para no recibir promociones._`,
    );
    return true;
  }

  if (session.step === "ask_fulfillment") {
    const modes = restaurantFulfillmentModes(r);
    const mode = parseFulfillmentReply(buttonId || normalized, modes);
    if (!mode) {
      await askFulfillment(sendCtx, r, labels);
      return true;
    }
    session = { ...session, fulfillment: mode };
    if (mode === "delivery") {
      if (customerAddress) {
        session.step = "ask_address";
        session.address = customerAddress;
        await saveSession(admin, account.restaurant_id, waKey, session);
        await replyButtons(
          sendCtx,
          `¿Entregamos en: ${customerAddress}?`,
          [
            { id: "addr_yes", title: "Sí, esa dirección" },
            { id: "addr_new", title: "Otra dirección" },
          ],
        );
        return true;
      }
      session.step = "ask_address";
      await saveSession(admin, account.restaurant_id, waKey, session);
      await reply(sendCtx, "¿Cuál es la dirección de entrega? (calle, colonia, referencias)");
      return true;
    }
    session.step = "ask_payment";
    await saveSession(admin, account.restaurant_id, waKey, session);
    await askPayment(sendCtx, r);
    return true;
  }

  if (session.step === "ask_address") {
    if (buttonId === "addr_yes" && session.address) {
      session.step = "ask_payment";
      await saveSession(admin, account.restaurant_id, waKey, session);
      await askPayment(sendCtx, r);
      return true;
    }
    if (buttonId === "addr_new") {
      session.address = undefined;
      await saveSession(admin, account.restaurant_id, waKey, session);
      await reply(sendCtx, "Escribe la nueva dirección de entrega:");
      return true;
    }
    if (!text || text.length < 5) {
      await reply(sendCtx, "Necesito una dirección un poco más completa.");
      return true;
    }
    session.address = text;
    session.step = "ask_payment";
    await saveSession(admin, account.restaurant_id, waKey, session);
    await askPayment(sendCtx, r);
    return true;
  }

  if (session.step === "ask_payment") {
    const pay = parsePaymentReply(buttonId || normalized);
    if (!pay) {
      await askPayment(sendCtx, r);
      return true;
    }
    session.payment = pay;
    if (pay === "cash") {
      session.step = "ask_cash";
      await saveSession(admin, account.restaurant_id, waKey, session);
      const sub = (session.lines ?? []).reduce(
        (s, l) => s + l.unitPrice * l.quantity,
        0,
      );
      await reply(
        sendCtx,
        `Total aproximado: $${sub.toFixed(0)}. ¿Con cuánto pagas? (ej. 200)`,
      );
      return true;
    }
    // transfer → create order then send bank details
    return finalizeOrder({
      admin,
      sendCtx,
      account,
      restaurant: r,
      mx10,
      contactName,
      session,
      waKey,
      menuUrl,
    });
  }

  if (session.step === "ask_cash") {
    const amount = Number.parseFloat(normalized.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      await reply(sendCtx, "Indica el monto con el que pagas (solo número).");
      return true;
    }
    session.cashAmount = amount;
    return finalizeOrder({
      admin,
      sendCtx,
      account,
      restaurant: r,
      mx10,
      contactName,
      session,
      waKey,
      menuUrl,
    });
  }

  if (session.step === "await_spei") {
    await reply(
      sendCtx,
      "Estamos esperando la foto de tu comprobante SPEI. Envíala en este chat.",
    );
    return true;
  }

  return false;
}

function parseFulfillmentReply(
  raw: string,
  modes: FulfillmentMode[],
): FulfillmentMode | null {
  const t = fold(raw);
  let mode: FulfillmentMode | null = null;
  if (t === "fulfill_pickup" || t.includes("recoger") || t === "pickup") {
    mode = "pickup";
  } else if (
    t === "fulfill_delivery" ||
    t.includes("envio") ||
    t.includes("domicilio") ||
    t === "delivery"
  ) {
    mode = "delivery";
  } else if (
    t === "fulfill_dine" ||
    t.includes("mesa") ||
    t.includes("local") ||
    t === "dine_in"
  ) {
    mode = "dine_in";
  }
  if (!mode || !modes.includes(mode)) return null;
  return mode;
}

function parsePaymentReply(raw: string): PaymentMethod | null {
  const t = fold(raw);
  if (t === "pay_cash" || t.includes("efectivo") || t === "cash") return "cash";
  if (
    t === "pay_transfer" ||
    t.includes("transfer") ||
    t.includes("spei") ||
    t === "transfer"
  ) {
    return "transfer";
  }
  return null;
}

function asTransferFields(r: RestaurantRow) {
  return {
    show_transfer_details: r.show_transfer_details === true,
    bank_account_holder: r.bank_account_holder ?? "",
    bank_name: r.bank_name ?? "",
    bank_clabe: r.bank_clabe ?? "",
  };
}

async function askFulfillment(
  sendCtx: {
    admin: ServiceClient;
    phoneNumberId: string;
    accessToken: string;
    toE164: string;
    restaurantId: string;
  },
  r: RestaurantRow,
  labels: ReturnType<typeof labelsFor>,
) {
  const modes = restaurantFulfillmentModes(r);
  const buttons: { id: string; title: string }[] = [];
  if (modes.includes("pickup")) {
    buttons.push({ id: "fulfill_pickup", title: "Recoger" });
  }
  if (modes.includes("delivery")) {
    buttons.push({ id: "fulfill_delivery", title: "Envío" });
  }
  if (modes.includes("dine_in")) {
    buttons.push({ id: "fulfill_dine", title: "En local" });
  }
  if (buttons.length === 0) {
    buttons.push({ id: "fulfill_pickup", title: "Recoger" });
  }
  await replyButtons(
    sendCtx,
    `¿Cómo quieres tu ${labels.dish.toLowerCase()}?`,
    buttons.slice(0, 3),
  );
}

async function askPayment(
  sendCtx: {
    admin: ServiceClient;
    phoneNumberId: string;
    accessToken: string;
    toE164: string;
    restaurantId: string;
  },
  r: RestaurantRow,
) {
  const transfer = publicTransferDetails(asTransferFields(r));
  const buttons: { id: string; title: string }[] = [
    { id: "pay_cash", title: "Efectivo" },
  ];
  if (transfer) {
    buttons.push({ id: "pay_transfer", title: "Transferencia" });
  }
  await replyButtons(sendCtx, "¿Cómo pagarás?", buttons);
}

async function finalizeOrder(opts: {
  admin: ServiceClient;
  sendCtx: {
    admin: ServiceClient;
    phoneNumberId: string;
    accessToken: string;
    toE164: string;
    restaurantId: string;
  };
  account: WaAccountCtx;
  restaurant: RestaurantRow;
  mx10: string | null;
  contactName: string;
  session: WaSessionState;
  waKey: string;
  menuUrl: string;
}): Promise<boolean> {
  const {
    admin,
    sendCtx,
    account,
    restaurant: r,
    mx10,
    contactName,
    waKey,
    menuUrl,
  } = opts;
  const session = opts.session;

  if (!mx10 || !session.lines?.length || !session.fulfillment || !session.payment) {
    await clearSession(admin, account.restaurant_id, waKey);
    await reply(sendCtx, "Faltó información. Escribe MENU para empezar de nuevo.");
    return true;
  }

  const created = await createBotOrder({
    admin,
    restaurantId: account.restaurant_id,
    customerName: contactName,
    phone: mx10,
    waId: waKey,
    lines: session.lines,
    fulfillment: session.fulfillment,
    payment: session.payment,
    cashAmount: session.cashAmount ?? null,
    address: session.address,
    shippingOnQuote: r.shipping_on_quote === true,
  });

  if (!created) {
    await clearSession(admin, account.restaurant_id, waKey);
    await reply(sendCtx, "No pude registrar el pedido. Intenta de nuevo con MENU.");
    return true;
  }

  const folioBit = created.folio != null ? ` #${created.folio}` : "";
  const summary = session.lines
    .map((l) => `${l.quantity}x ${l.name}`)
    .join(", ");

  if (session.payment === "transfer") {
    const transfer = publicTransferDetails(asTransferFields(r));
    await reply(
      sendCtx,
      `Pedido${folioBit} registrado: ${summary}\nTotal: $${created.total.toFixed(0)}`,
    );
    if (transfer?.bank) {
      await reply(sendCtx, `Banco: ${transfer.bank}`);
    }
    if (transfer?.holder) {
      await reply(sendCtx, `Titular: ${transfer.holder}`);
    }
    if (transfer?.clabe) {
      await reply(
        sendCtx,
        `CLABE: ${formatClabeDisplay(transfer.clabe)}\n\nCuando transferas, envía la *foto del comprobante* en este chat.`,
      );
    } else {
      await reply(
        sendCtx,
        "Te compartiremos los datos de transferencia. Envía tu comprobante aquí cuando pagues.",
      );
    }
    await saveSession(admin, account.restaurant_id, waKey, {
      step: "await_spei",
      pendingOrderId: created.orderId,
    });
    return true;
  }

  await clearSession(admin, account.restaurant_id, waKey);
  let msg = `¡Pedido${folioBit} listo! ${summary}\nTotal: $${created.total.toFixed(0)}`;
  if (session.cashAmount != null) {
    msg += `\nPagas con: $${session.cashAmount.toFixed(0)}`;
  }
  if (menuUrl) msg += `\nSeguimiento: ${menuUrl}`;
  msg += `\n\n_Escribe BAJA si no quieres promociones._`;
  await reply(sendCtx, msg);

  const { data: cust } = await admin
    .from("customers")
    .select("wa_opt_in, orders_count")
    .eq("restaurant_id", account.restaurant_id)
    .eq("phone", mx10)
    .maybeSingle();
  if (cust && cust.wa_opt_in !== true && Number(cust.orders_count ?? 0) <= 1) {
    await reply(
      sendCtx,
      "¿Te avisamos de promociones por WhatsApp? Responde *SÍ QUIERO* o escribe BAJA para no recibirlas.",
    );
  }
  return true;
}
