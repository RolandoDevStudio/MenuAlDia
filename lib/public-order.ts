import { createPublicClient } from "@/lib/supabase/public";
import { parseFulfillment } from "@/lib/fulfillment";
import { publicTransferDetails } from "@/lib/transfer-details";
import type { PublicTransferDetails } from "@/lib/transfer-details";
import type {
  FulfillmentMode,
  OrderStatus,
  PaymentMethod,
  Restaurant,
} from "@/lib/types";
import {
  PUBLIC_ORDER_TOKEN_RE,
  sanitizePublicCartItems,
} from "@/lib/public-order-sanitize";
import type { CartItem } from "@/lib/types";

export { PUBLIC_ORDER_TOKEN_RE, sanitizePublicCartItems };

export type PublicOrderSnapshot = {
  folio: number | null;
  status: OrderStatus | string;
  createdAt: string;
  total: number;
  fulfillment: FulfillmentMode;
  tableLabel: string | null;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  shippingPending: boolean;
  discount: number;
  couponCode: string | null;
  paymentMethod: PaymentMethod;
  restaurantName: string;
  restaurantLogo: string | null;
  restaurantSlug: string;
  businessType: string;
  transfer: PublicTransferDetails | null;
};

type RpcRow = {
  folio?: number | null;
  status?: string;
  created_at?: string;
  total?: number | string;
  fulfillment?: string;
  table_label?: string | null;
  items?: unknown;
  subtotal?: number | string;
  shipping?: number | string;
  shipping_pending?: boolean | string;
  discount?: number | string;
  coupon_code?: string | null;
  payment_method?: string;
  restaurant_name?: string;
  restaurant_logo?: string | null;
  restaurant_slug?: string;
  business_type?: string;
  show_transfer_details?: boolean;
  bank_account_holder?: string;
  bank_name?: string;
  bank_clabe?: string;
};

function asNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function mapRpcRow(row: RpcRow): PublicOrderSnapshot | null {
  const fulfillment = parseFulfillment(row.fulfillment) ?? "pickup";
  const slug = String(row.restaurant_slug ?? "").trim();
  const name = String(row.restaurant_name ?? "").trim();
  if (!slug || !name) return null;
  const paymentMethod: PaymentMethod =
    row.payment_method === "transfer" ? "transfer" : "cash";
  const restaurant = {
    show_transfer_details: Boolean(row.show_transfer_details),
    bank_account_holder: row.bank_account_holder ?? "",
    bank_name: row.bank_name ?? "",
    bank_clabe: row.bank_clabe ?? "",
  } as Restaurant;
  return {
    folio: row.folio ?? null,
    status: row.status ?? "submitted",
    createdAt: row.created_at ?? new Date().toISOString(),
    total: asNumber(row.total),
    fulfillment,
    tableLabel: row.table_label ? String(row.table_label) : null,
    items: sanitizePublicCartItems(row.items),
    subtotal: asNumber(row.subtotal),
    shipping: asNumber(row.shipping),
    shippingPending:
      row.shipping_pending === true || row.shipping_pending === "true",
    discount: asNumber(row.discount),
    couponCode: row.coupon_code ? String(row.coupon_code) : null,
    paymentMethod,
    restaurantName: name,
    restaurantLogo: row.restaurant_logo ? String(row.restaurant_logo) : null,
    restaurantSlug: slug,
    businessType: String(row.business_type ?? "restaurante"),
    transfer:
      paymentMethod === "transfer" ? publicTransferDetails(restaurant) : null,
  };
}

export async function fetchPublicOrderByToken(
  token: string,
): Promise<PublicOrderSnapshot | null> {
  if (!PUBLIC_ORDER_TOKEN_RE.test(token)) return null;
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("public_order_by_token", {
    p_token: token,
  });
  if (error || data == null) return null;
  const row = (typeof data === "string" ? JSON.parse(data) : data) as RpcRow;
  return mapRpcRow(row);
}
