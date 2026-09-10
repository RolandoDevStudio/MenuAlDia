import { formatMxn } from "@/lib/money";
import {
  deliveryModeLabel,
  normalizeBusinessType,
  shippingCostLabel,
  supportsDineIn,
} from "@/lib/business-labels";
import type {
  BusinessType,
  FulfillmentMode,
  OrderStatus,
  Restaurant,
} from "@/lib/types";

export const FULFILLMENT_MODES: readonly FulfillmentMode[] = [
  "pickup",
  "delivery",
  "dine_in",
] as const;

export const FULFILLMENT_LABELS: Record<FulfillmentMode, string> = {
  pickup: "Recoger",
  delivery: "Envío",
  dine_in: "Comedor",
};

export function fulfillmentLabelFor(
  mode: FulfillmentMode,
  businessType?: BusinessType | string | null,
): string {
  if (mode === "delivery") return deliveryModeLabel(businessType);
  if (mode === "pickup") {
    return normalizeBusinessType(businessType) === "servicios"
      ? "En el local"
      : "Recoger";
  }
  return FULFILLMENT_LABELS[mode];
}

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "submitted",
  "preparing",
  "ready",
  "closed",
  "cancelled",
] as const;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  submitted: "Recibido",
  preparing: "Preparando",
  ready: "Listo",
  closed: "Cerrado",
  cancelled: "Cancelado",
};

const STATUS_CYCLE: OrderStatus[] = [
  "submitted",
  "preparing",
  "ready",
  "closed",
];

export function parseFulfillment(raw: unknown): FulfillmentMode | null {
  if (raw === "pickup" || raw === "delivery" || raw === "dine_in") return raw;
  return null;
}

export function parseOrderStatus(raw: unknown): OrderStatus | null {
  if (
    raw === "submitted" ||
    raw === "preparing" ||
    raw === "ready" ||
    raw === "closed" ||
    raw === "cancelled"
  ) {
    return raw;
  }
  return null;
}

export function nextOrderStatus(current: string): OrderStatus {
  const i = STATUS_CYCLE.indexOf(current as OrderStatus);
  if (i < 0) return "preparing";
  return STATUS_CYCLE[Math.min(i + 1, STATUS_CYCLE.length - 1)]!;
}

type ModeFlags = Pick<
  Restaurant,
  "offers_pickup" | "offers_delivery" | "offers_dine_in"
> & {
  business_type?: BusinessType | string | null;
};

export function restaurantFulfillmentModes(r: ModeFlags): FulfillmentMode[] {
  const modes: FulfillmentMode[] = [];
  if (r.offers_pickup !== false) modes.push("pickup");
  if (r.offers_delivery !== false) modes.push("delivery");
  if (r.offers_dine_in === true && supportsDineIn(r.business_type)) {
    modes.push("dine_in");
  }
  return modes.length > 0 ? modes : ["pickup"];
}

export function defaultFulfillment(r: ModeFlags): FulfillmentMode {
  const modes = restaurantFulfillmentModes(r);
  if (modes.includes("delivery")) return "delivery";
  return modes[0] ?? "pickup";
}

export function fulfillmentChargesShipping(mode: FulfillmentMode): boolean {
  return mode === "delivery";
}

export function restaurantShippingOnQuote(
  r: Pick<Restaurant, "shipping_on_quote">,
): boolean {
  return r.shipping_on_quote === true;
}

/** Amount to add at checkout for delivery (0 when free or on quote). */
export function checkoutShippingAmount(
  r: Pick<
    Restaurant,
    "free_shipping" | "shipping_cost" | "shipping_on_quote"
  >,
  mode: FulfillmentMode,
): number {
  if (!fulfillmentChargesShipping(mode)) return 0;
  if (restaurantShippingOnQuote(r)) return 0;
  if (r.free_shipping || Number(r.shipping_cost) === 0) return 0;
  return Number(r.shipping_cost) || 0;
}

export function offersPublicVenue(r: ModeFlags): boolean {
  const modes = restaurantFulfillmentModes(r);
  return modes.includes("pickup") || modes.includes("dine_in");
}

export function offersPublicDelivery(r: ModeFlags): boolean {
  return restaurantFulfillmentModes(r).includes("delivery");
}

export function publicFulfillmentHint(
  r: ModeFlags & {
    free_shipping?: boolean;
    shipping_cost?: number;
    shipping_on_quote?: boolean;
    business_type?: BusinessType | string | null;
  },
): string {
  const modes = restaurantFulfillmentModes(r);
  const shipLabel = shippingCostLabel(r.business_type);
  if (modes.length === 1 && modes[0] === "pickup") {
    return "Solo recogida en local";
  }
  if (modes.length === 1 && modes[0] === "dine_in") {
    return "Solo comedor";
  }
  if (modes.includes("delivery")) {
    if (r.shipping_on_quote === true) {
      return `${shipLabel} por cotizar`;
    }
    if (r.free_shipping || Number(r.shipping_cost) === 0) {
      return normalizeBusinessType(r.business_type) === "servicios"
        ? "Traslado incluido"
        : "Envío gratis";
    }
    return `${shipLabel} ${formatMxn(Number(r.shipping_cost))}`;
  }
  return modes.map((m) => fulfillmentLabelFor(m, r.business_type)).join(" · ");
}
