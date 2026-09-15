import { decryptSecret } from "@/lib/crypto-secret";
import { ORDER_STATUS_LABELS, parseOrderStatus } from "@/lib/fulfillment";
import { mx10ToWaE164 } from "@/lib/phone";
import { createServiceClient } from "@/lib/supabase/admin";
import type { OrderLogPayload } from "@/lib/types";
import { sendWaText } from "@/lib/whatsapp-cloud";

export type WaNotifyResult = {
  attempted: boolean;
  sent: boolean;
  warning?: string;
};

/** Best-effort status ping; never throws — callers must not fail the PATCH. */
export async function notifyOrderStatusViaWhatsApp(opts: {
  restaurantId: string;
  orderId: string;
  status: string;
  payload: OrderLogPayload;
}): Promise<WaNotifyResult> {
  try {
    const admin = createServiceClient();
    const { data: account } = await admin
      .from("restaurant_whatsapp_accounts")
      .select(
        "whatsapp_bot_enabled, state_notifications_enabled, status, phone_number_id, access_token_encrypted, templates_status",
      )
      .eq("restaurant_id", opts.restaurantId)
      .maybeSingle();

    if (
      !account?.whatsapp_bot_enabled ||
      !account.state_notifications_enabled ||
      account.status !== "connected" ||
      !account.phone_number_id ||
      !account.access_token_encrypted
    ) {
      return { attempted: false, sent: false };
    }

    const phone = opts.payload.phone;
    if (!phone || phone.length !== 10) {
      return { attempted: false, sent: false };
    }

    const parsed = parseOrderStatus(opts.status);
    if (!parsed || parsed === "submitted") {
      return { attempted: false, sent: false };
    }

    const label = ORDER_STATUS_LABELS[parsed];
    const folio =
      opts.payload.customer_name != null
        ? `Hola ${opts.payload.customer_name.split(" ")[0]}`
        : "Hola";
    const text = `${folio}, tu pedido ahora está: *${label}*. Gracias por preferirnos.`;

    let accessToken: string;
    try {
      accessToken = decryptSecret(account.access_token_encrypted);
    } catch {
      return {
        attempted: true,
        sent: false,
        warning:
          "Estado actualizado en panel. Notificación por WhatsApp no enviada (token inválido).",
      };
    }

    const toE164 = mx10ToWaE164(phone);
    if (!toE164) {
      return { attempted: false, sent: false };
    }

    const result = await sendWaText({
      phoneNumberId: account.phone_number_id,
      accessToken,
      toE164,
      text,
    });

    await admin.from("wa_message_log").insert({
      restaurant_id: opts.restaurantId,
      direction: "outbound",
      category: "service",
      wamid: result.wamid ?? null,
      ok: result.ok,
    });

    if (!result.ok) {
      const templates = (account.templates_status ?? {}) as Record<
        string,
        string
      >;
      const templateOk = templates.estado_pedido === "APPROVED";
      return {
        attempted: true,
        sent: false,
        warning: templateOk
          ? "Estado actualizado en panel. Notificación por WhatsApp no enviada (ventana de 24h cerrada sin poder usar plantilla)."
          : "Estado actualizado en panel. Notificación por WhatsApp no enviada (ventana de 24h cerrada sin plantilla aprobada).",
      };
    }

    return { attempted: true, sent: true };
  } catch (err) {
    console.error("[notifyOrderStatusViaWhatsApp]", err);
    return {
      attempted: true,
      sent: false,
      warning:
        "Estado actualizado en panel. Notificación por WhatsApp no enviada.",
    };
  }
}
