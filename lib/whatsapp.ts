import type { CartItem, CheckoutFormValues, Restaurant } from "@/lib/types";
import { formatMxn } from "@/lib/money";

export function normalizeWhatsAppPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function addonLines(item: CartItem): string[] {
  const fromAddons = item.addons ?? [];
  if (fromAddons.length > 0) {
    return fromAddons.map((a) => {
      const delta =
        a.priceDelta > 0 ? ` (+${formatMxn(a.priceDelta)})` : "";
      return `   └ ${a.name}${delta}`;
    });
  }
  if (item.sideNames && item.sideNames.length > 0) {
    return item.sideNames.map((n) => `   └ ${n}`);
  }
  return [];
}

export function buildOrderMessage(params: {
  restaurant: Pick<Restaurant, "name">;
  items: CartItem[];
  checkout: CheckoutFormValues;
  shipping: number;
  total: number;
}): string {
  const { restaurant, items, checkout, shipping, total } = params;
  const lines: string[] = [];
  lines.push(`🍽️ *Pedido — ${restaurant.name}*`);
  lines.push("");
  lines.push("📋 *Detalle*");

  const comboGroups = new Map<string, { title: string; items: CartItem[] }>();
  const singles: CartItem[] = [];

  for (const item of items) {
    if (item.comboId && item.comboTitle) {
      const g = comboGroups.get(item.comboId) ?? {
        title: item.comboTitle,
        items: [],
      };
      g.items.push(item);
      comboGroups.set(item.comboId, g);
    } else {
      singles.push(item);
    }
  }

  function lineTotal(item: CartItem) {
    const addons = (item.addons ?? []).reduce((s, a) => s + a.priceDelta, 0);
    return (item.unitPrice + addons) * item.quantity;
  }

  for (const [, group] of comboGroups) {
    lines.push(`🔥 *${group.title}*`);
    for (const item of group.items) {
      lines.push(
        `• ${item.quantity}x ${item.name} — ${formatMxn(lineTotal(item))}`,
      );
      lines.push(...addonLines(item));
    }
    lines.push("");
  }

  for (const item of singles) {
    lines.push(
      `• ${item.quantity}x ${item.name} — ${formatMxn(lineTotal(item))}`,
    );
    lines.push(...addonLines(item));
  }

  lines.push("");
  if (shipping > 0) lines.push(`🚚 Envío: ${formatMxn(shipping)}`);
  else lines.push("🚚 Envío: Gratis");
  lines.push(`💰 *Total estimado: ${formatMxn(total)}*`);
  lines.push("");
  lines.push(`👤 ${checkout.customerName}`);
  lines.push(`📍 ${checkout.address}`);
  if (checkout.mapsUrl?.trim()) {
    lines.push(`🗺️ ${checkout.mapsUrl.trim()}`);
  }
  if (checkout.references) {
    lines.push(`📝 ${checkout.references}`);
  }
  if (checkout.paymentMethod === "cash") {
    lines.push(
      `💵 Efectivo (paga con ${formatMxn(checkout.cashAmount ?? 0)})`,
    );
  } else {
    lines.push("🏦 Transferencia");
    lines.push(
      "Por favor, ¿me puedes compartir los datos para transferir (banco / CLABE / cuenta)?",
    );
  }
  return lines.join("\n");
}

/** Marketing copy for sharing a combo link. */
export function buildComboShareMessage(params: {
  businessName: string;
  comboTitle: string;
  description?: string;
  itemNames: string[];
  price: number;
  url: string;
}): string {
  const includes = params.itemNames.slice(0, 6).join(", ");
  const lines = [
    `🔥 *${params.comboTitle}* — ${params.businessName}`,
    "",
    params.description?.trim() || "Paquete especial por tiempo limitado.",
    "",
    `Incluye: ${includes}`,
    `💰 Solo ${formatMxn(params.price)}`,
    "",
    `Pide aquí 👉 ${params.url}`,
  ];
  return lines.join("\n");
}

export function buildWaMeUrl(phone: string, message: string): string {
  const digits = normalizeWhatsAppPhone(phone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Sales WhatsApp (landing FAB / contact). */
export const SALES_WHATSAPP = "5218130947324";
