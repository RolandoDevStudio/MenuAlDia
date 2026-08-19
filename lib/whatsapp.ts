import type { CartItem, CheckoutFormValues, Restaurant } from "@/lib/types";
import { formatMxn } from "@/lib/money";

export function normalizeWhatsAppPhone(phone: string): string {
  return phone.replace(/\D/g, "");
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
  lines.push(`*Pedido — ${restaurant.name}*`);
  lines.push("");
  for (const item of items) {
    const sideBit =
      item.sideNames && item.sideNames.length > 0
        ? ` (+ ${item.sideNames.join(", ")})`
        : "";
    lines.push(
      `• ${item.quantity}x ${item.name}${sideBit} — ${formatMxn(item.unitPrice * item.quantity)}`,
    );
  }
  lines.push("");
  if (shipping > 0) lines.push(`Envío: ${formatMxn(shipping)}`);
  else lines.push("Envío: Gratis");
  lines.push(`*Total: ${formatMxn(total)}*`);
  lines.push("");
  lines.push(`Cliente: ${checkout.customerName}`);
  lines.push(`Dirección: ${checkout.address}`);
  if (checkout.mapsUrl?.trim()) {
    lines.push(`Maps: ${checkout.mapsUrl.trim()}`);
  }
  if (checkout.references) {
    lines.push(`Referencias de la dirección: ${checkout.references}`);
  }
  if (checkout.paymentMethod === "cash") {
    lines.push(
      `Pago: Efectivo (paga con ${formatMxn(checkout.cashAmount ?? 0)})`,
    );
  } else {
    lines.push("Pago: Transferencia");
    lines.push(
      "Por favor, ¿me puedes compartir los datos para transferir (banco / CLABE / cuenta)?",
    );
  }
  return lines.join("\n");
}

export function buildWaMeUrl(phone: string, message: string): string {
  const digits = normalizeWhatsAppPhone(phone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
