import type { CartItem, CheckoutFormValues, Restaurant } from "@/lib/types";
import { formatMxn } from "@/lib/money";
import { formatQty, resolveUnitType } from "@/lib/units";

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
  discount?: number;
  couponCode?: string | null;
  subtotalBeforeDiscount?: number;
}): string {
  const {
    restaurant,
    items,
    checkout,
    shipping,
    total,
    discount = 0,
    couponCode,
    subtotalBeforeDiscount,
  } = params;
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
      const unit = resolveUnitType(item.unitType);
      lines.push(
        `• ${formatQty(item.quantity, unit)} ${item.name} — ${formatMxn(lineTotal(item))}`,
      );
      lines.push(...addonLines(item));
    }
    lines.push("");
  }

  for (const item of singles) {
    const unit = resolveUnitType(item.unitType);
    lines.push(
      `• ${formatQty(item.quantity, unit)} ${item.name} — ${formatMxn(lineTotal(item))}`,
    );
    lines.push(...addonLines(item));
  }

  lines.push("");
  if (checkout.fulfillment === "pickup") {
    lines.push("🏪 Modalidad: Recoger en el local");
  } else if (shipping > 0) {
    lines.push(`🚚 Envío: ${formatMxn(shipping)}`);
  } else {
    lines.push("🚚 Envío: Gratis");
  }
  if (discount > 0 && couponCode) {
    lines.push(
      `🏷️ Cupón ${couponCode}: −${formatMxn(discount)}${
        subtotalBeforeDiscount != null
          ? ` (subtotal ${formatMxn(subtotalBeforeDiscount)})`
          : ""
      }`,
    );
  }
  lines.push(`💰 *Total estimado: ${formatMxn(total)}*`);
  lines.push("");
  lines.push(`👤 ${checkout.customerName}`);
  if (checkout.fulfillment === "pickup") {
    lines.push("🏪 Recoger en el local");
  } else {
    lines.push(`📍 ${checkout.address}`);
    if (checkout.mapsUrl?.trim()) {
      lines.push(`🗺️ ${checkout.mapsUrl.trim()}`);
    }
    if (checkout.references) {
      lines.push(`📝 ${checkout.references}`);
    }
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

/** Status / listas de difusión: link al menú (+ opcionales de hoy). */
export function buildBroadcastMessage(params: {
  businessName: string;
  menuUrl: string;
  dailyLabel?: string;
  itemNames?: string[];
  packagePrice?: number | null;
  shareCta?: string;
}): string {
  const lines: string[] = [];
  lines.push(`✨ *${params.businessName}*`);
  lines.push("");
  if (params.itemNames && params.itemNames.length > 0) {
    lines.push(`📋 *${params.dailyLabel || "Hoy"}*`);
    for (const name of params.itemNames.slice(0, 8)) {
      lines.push(`• ${name}`);
    }
    if (
      typeof params.packagePrice === "number" &&
      params.packagePrice > 0
    ) {
      lines.push(`💰 Paquete desde ${formatMxn(params.packagePrice)}`);
    }
    lines.push("");
  }
  const cta = params.shareCta?.trim() || "Mira el menú y pide aquí";
  lines.push(`${cta} 👉`);
  lines.push(params.menuUrl);
  return lines.join("\n");
}

/** Cita Express (giro servicios): mensaje al WhatsApp del negocio. */
export function buildAppointmentMessage(params: {
  businessName: string;
  serviceName: string;
  serviceNames?: string[];
  price?: number;
  dateLabel: string;
  timeLabel: string;
  customerName: string;
  customerPhone: string;
  customerNote?: string;
}): string {
  const services =
    params.serviceNames && params.serviceNames.length > 0
      ? params.serviceNames
      : [params.serviceName];
  const lines: string[] = [
    `Hola, quiero agendar en *${params.businessName}*.`,
    "",
    `👤 Cliente: *${params.customerName.trim()}*`,
    `📱 Tel: ${params.customerPhone.trim()}`,
    "",
  ];
  if (services.length === 1) {
    lines.push(`✂️ Servicio: *${services[0]}*`);
  } else {
    lines.push("✂️ Servicios:");
    for (const s of services) lines.push(`• ${s}`);
  }
  if (typeof params.price === "number" && params.price > 0) {
    lines.push(`💰 Precio ref.: ${formatMxn(params.price)}`);
  }
  lines.push(`📅 Día tentativo: ${params.dateLabel}`);
  lines.push(`⏰ Hora: ${params.timeLabel}`);
  if (params.customerNote?.trim()) {
    lines.push(`📝 ${params.customerNote.trim()}`);
  }
  lines.push("");
  lines.push("¿Me confirmas disponibilidad?");
  return lines.join("\n");
}

/** Sales WhatsApp (landing FAB / contact) — fallback if CMS vacío. */
export const SALES_WHATSAPP = "528130947324";

/**
 * Digits for wa.me from CMS / env / default.
 * Accepts "+52 81 3094 7324", "5218130947324", etc.
 */
export function resolveSalesWhatsApp(cmsPhone?: string | null): string {
  const fromCms = normalizeWhatsAppPhone(cmsPhone ?? "");
  if (fromCms.length >= 10) return fromCms;
  const fromEnv = normalizeWhatsAppPhone(
    process.env.NEXT_PUBLIC_SALES_WHATSAPP || "",
  );
  if (fromEnv.length >= 10) return fromEnv;
  return SALES_WHATSAPP;
}

/**
 * Display form for MX sales numbers (strip leading 521/52 country marker).
 * e.g. 528130947324 → "81 3094 7324"
 */
export function formatSalesWhatsAppDisplay(
  phone: string = SALES_WHATSAPP,
): string {
  const digits = phone.replace(/\D/g, "");
  const local =
    digits.startsWith("521") && digits.length >= 13
      ? digits.slice(3)
      : digits.startsWith("52") && digits.length >= 12
        ? digits.slice(2)
        : digits;
  if (local.length === 10) {
    return `${local.slice(0, 2)} ${local.slice(2, 6)} ${local.slice(6)}`;
  }
  return local || phone;
}