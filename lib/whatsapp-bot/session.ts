import type { createServiceClient } from "@/lib/supabase/admin";
import type { FulfillmentMode, PaymentMethod } from "@/lib/types";

export type ServiceClient = ReturnType<typeof createServiceClient>;

export type WaBotStep =
  | "idle"
  | "pick_item"
  | "ask_upsell"
  | "ask_fulfillment"
  | "ask_address"
  | "ask_payment"
  | "ask_cash"
  | "await_spei"
  | "cita_confirm";

export type WaCartLine = {
  dishId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

export type WaSessionState = {
  step: WaBotStep;
  lines?: WaCartLine[];
  fulfillment?: FulfillmentMode;
  address?: string;
  payment?: PaymentMethod;
  cashAmount?: number;
  pendingOrderId?: string;
  menuItems?: { id: string; name: string; price: number }[];
  upsellItem?: { id: string; name: string; price: number };
  upsellOffered?: boolean;
  nudgeSentAt?: string;
  updatedHint?: string;
};

export type WaAccountCtx = {
  restaurant_id: string;
  phone_number_id: string;
  access_token: string;
  whatsapp_bot_enabled: boolean;
  pull_menu_enabled: boolean;
  chat_orders_enabled: boolean;
  state_notifications_enabled: boolean;
  upselling_enabled: boolean;
  abandoned_cart_nudge: boolean;
  vip_broadcast_enabled: boolean;
  bot_menu_scope: string;
  whatsapp_ai_marketing_addon: boolean;
  addon_trial_ends_at?: string | null;
};

export async function loadSession(
  admin: ServiceClient,
  restaurantId: string,
  waId: string,
): Promise<WaSessionState> {
  const { data } = await admin
    .from("wa_session_state")
    .select("state")
    .eq("restaurant_id", restaurantId)
    .eq("wa_id", waId)
    .maybeSingle();
  const state = (data?.state ?? {}) as Partial<WaSessionState>;
  return { ...state, step: state.step ?? "idle" };
}

export async function saveSession(
  admin: ServiceClient,
  restaurantId: string,
  waId: string,
  state: WaSessionState,
): Promise<void> {
  await admin.from("wa_session_state").upsert({
    restaurant_id: restaurantId,
    wa_id: waId,
    state,
    updated_at: new Date().toISOString(),
  });
}

export async function clearSession(
  admin: ServiceClient,
  restaurantId: string,
  waId: string,
): Promise<void> {
  await admin
    .from("wa_session_state")
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("wa_id", waId);
}

export function looksFrustrated(text: string): boolean {
  const t = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  return (
    /\b(humano|persona|gerente|reclama|reclamo|enojad|molest|horrible|pesimo|pésimo|habla con|asesor)\b/.test(
      t,
    ) || t.includes("queja")
  );
}
