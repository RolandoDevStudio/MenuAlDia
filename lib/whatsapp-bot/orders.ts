import type { OrderLogPayload } from "@/lib/types";
import type { ServiceClient, WaCartLine } from "@/lib/whatsapp-bot/session";
import type { FulfillmentMode, PaymentMethod } from "@/lib/types";

export async function createBotOrder(opts: {
  admin: ServiceClient;
  restaurantId: string;
  customerName: string;
  phone: string;
  waId: string;
  lines: WaCartLine[];
  fulfillment: FulfillmentMode;
  payment: PaymentMethod;
  cashAmount?: number | null;
  address?: string;
  orderKind?: "order" | "appointment";
  shippingOnQuote?: boolean;
}): Promise<{ orderId: string; folio: number | null; publicToken: string | null; total: number } | null> {
  const subtotal = opts.lines.reduce(
    (s, l) => s + l.unitPrice * l.quantity,
    0,
  );
  const shipping = 0;
  const total = subtotal + shipping;
  const shippingPending =
    opts.fulfillment === "delivery" && opts.shippingOnQuote === true;

  const payload: OrderLogPayload = {
    customer_name: opts.customerName,
    phone: opts.phone,
    fulfillment: opts.fulfillment,
    payment_method: opts.payment,
    cash_amount: opts.cashAmount ?? null,
    items: opts.lines.map((l) => ({
      dishId: l.dishId,
      name: l.name,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
    })),
    subtotal,
    shipping,
    total,
    source: "whatsapp_bot",
    wa_id: opts.waId,
    order_kind: opts.orderKind ?? "order",
    payment_status: opts.payment === "transfer" ? "pending" : undefined,
    shipping_pending: shippingPending || undefined,
  };
  if (opts.address) payload.address = opts.address;

  const { data: customerId } = await opts.admin.rpc("upsert_customer_by_phone", {
    p_restaurant_id: opts.restaurantId,
    p_name: opts.customerName,
    p_phone: opts.phone,
    p_bump_order: true,
  });

  await opts.admin
    .from("customers")
    .update({ wa_id: opts.waId })
    .eq("restaurant_id", opts.restaurantId)
    .eq("phone", opts.phone);

  const insert = await opts.admin
    .from("orders")
    .insert({
      restaurant_id: opts.restaurantId,
      customer_id: customerId ?? null,
      payload,
      total,
      status: "submitted",
    })
    .select("id, folio, public_token")
    .maybeSingle();

  if (!insert.data?.id) return null;

  await opts.admin.from("order_logs").insert({
    restaurant_id: opts.restaurantId,
    payload,
  });

  try {
    const { emitTenantNotification } = await import("@/lib/notifications/emit");
    await emitTenantNotification({
      restaurantId: opts.restaurantId,
      type: "new_order",
      title: insert.data.folio
        ? `Nuevo pedido WA #${insert.data.folio}`
        : "Nuevo pedido WhatsApp",
      body: `${opts.customerName} · $${total.toFixed(0)}`,
      href: "/admin/orders",
      payload: { phone: opts.phone, source: "whatsapp_bot" },
    });
  } catch {
    /* non-fatal */
  }

  return {
    orderId: insert.data.id,
    folio: insert.data.folio ?? null,
    publicToken: insert.data.public_token ?? null,
    total,
  };
}

export async function attachPaymentProof(opts: {
  admin: ServiceClient;
  orderId: string;
  restaurantId: string;
  buffer: Buffer;
  mimeType: string;
  /** When true, run Gemini Vision assist (add-on). Never auto-approves. */
  runVision?: boolean;
  businessName?: string;
}): Promise<{
  ok: boolean;
  path?: string;
  error?: boolean;
  spei_match?: boolean | null;
}> {
  const ext = opts.mimeType.includes("png")
    ? "png"
    : opts.mimeType.includes("webp")
      ? "webp"
      : "jpg";
  const path = `${opts.restaurantId}/${opts.orderId}/${Date.now()}.${ext}`;

  const { error: upErr } = await opts.admin.storage
    .from("wa-payment-proofs")
    .upload(path, opts.buffer, {
      contentType: opts.mimeType,
      upsert: false,
    });

  const { data: order } = await opts.admin
    .from("orders")
    .select("payload, total")
    .eq("id", opts.orderId)
    .eq("restaurant_id", opts.restaurantId)
    .maybeSingle();

  const payload = {
    ...((order?.payload as OrderLogPayload) ?? {}),
  } as OrderLogPayload;

  if (upErr) {
    payload.payment_proof_error = true;
    payload.payment_status = "pending";
    await opts.admin
      .from("orders")
      .update({ payload })
      .eq("id", opts.orderId);
    try {
      const { emitTenantNotification } = await import(
        "@/lib/notifications/emit"
      );
      await emitTenantNotification({
        restaurantId: opts.restaurantId,
        type: "payment_proof_error",
        title: "Comprobante SPEI no descargado",
        body: "Solicítalo manualmente al cliente por WhatsApp.",
        href: "/admin/orders",
        payload: { orderId: opts.orderId },
      });
    } catch {
      /* non-fatal */
    }
    return { ok: false, error: true };
  }

  payload.payment_proof_path = path;
  payload.payment_proof_url = null;
  payload.payment_proof_error = false;
  payload.payment_status = "pending";

  let spei_match: boolean | null | undefined;
  if (opts.runVision) {
    try {
      const { analyzeSpeiProof } = await import(
        "@/lib/whatsapp-bot/spei-vision"
      );
      const vision = await analyzeSpeiProof({
        buffer: opts.buffer,
        mimeType: opts.mimeType,
        expectedTotal: Number(order?.total ?? payload.total ?? 0),
        businessName: opts.businessName,
      });
      if (vision) {
        payload.spei_match = vision.spei_match;
        spei_match = vision.spei_match;
        if (vision.notes) {
          (payload as OrderLogPayload & { spei_vision_notes?: string }).spei_vision_notes =
            vision.notes;
        }
      }
    } catch {
      /* vision is assistive only */
    }
  }

  await opts.admin.from("orders").update({ payload }).eq("id", opts.orderId);
  return { ok: true, path, spei_match: spei_match ?? null };
}
