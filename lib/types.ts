/** Database & domain types for Menú al Día */

import type { ThemeConfig } from "@/lib/theme";
import type { PlanType } from "@/lib/plans";

export type MemberRole = "owner" | "staff" | "super_admin";

export type PaymentMethod = "cash" | "transfer";

export type BusinessType = "restaurante" | "servicios" | "productos";

export type { PlanType, ThemeConfig };

export interface Restaurant {
  id: string;
  slug: string;
  name: string;
  slogan: string;
  logo_url: string | null;
  phone_whatsapp: string;
  address: string;
  maps_url: string | null;
  city: string;
  state: string;
  schedule_text: string;
  shipping_cost: number;
  free_shipping: boolean;
  created_at: string;
  plan_type: PlanType;
  is_active: boolean;
  subscription_end_date: string;
  theme_config: ThemeConfig | Record<string, unknown>;
  business_type: BusinessType;
  owner_name: string;
  instagram_url?: string | null;
  facebook_url?: string | null;
  tiktok_url?: string | null;
  offers_delivery?: boolean;
  terms_version_accepted?: string | null;
  terms_accepted_at?: string | null;
  loyalty_goal?: number;
  loyalty_reward_label?: string;
  /** Lifecycle after cancel/expiry */
  grace_ends_at?: string | null;
  purge_scheduled_at?: string | null;
  purged_at?: string | null;
}

export interface TenantPayment {
  id: string;
  restaurant_id: string;
  amount: number;
  currency: string;
  paid_at: string;
  method: "transfer" | "cash" | "card" | "other";
  plan_type: PlanType;
  period_days: number;
  reference: string;
  notes: string;
  created_by: string | null;
  created_at: string;
  receipt_url?: string | null;
  needs_invoice?: boolean;
  invoice_status?: "global" | "pending" | "issued" | "cancelled";
  invoice_folio?: string;
  invoice_at?: string | null;
  voided_at?: string | null;
  void_reason?: string;
}

export interface AuditLog {
  id: string;
  restaurant_id: string;
  actor_user_id: string | null;
  actor_label: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  summary: string;
  created_at: string;
}

export interface PlanTemplate {
  id: string;
  business_type: BusinessType;
  plan_type: PlanType;
  slug_key: string;
  name: string;
  theme_config: ThemeConfig | Record<string, unknown>;
  snapshot: Record<string, unknown>;
  is_active: boolean;
  updated_at: string;
}

export interface RestaurantMember {
  user_id: string;
  restaurant_id: string;
  role: MemberRole;
}

export interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  is_fixed_catalog: boolean;
}

export interface Dish {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string;
  photo_url: string | null;
  price: number;
  is_side: boolean;
  is_active: boolean;
  is_popular?: boolean;
  sort_order: number;
  archived_at?: string | null;
  /** Cart / order checkout */
  allow_purchase?: boolean;
  /** Cita Express (servicios) */
  allow_booking?: boolean;
  /** Sell unit (tienda): piece, kg, liter */
  unit_type?: "unit" | "kg" | "liter";
  step_value?: number;
}

export interface DishAddon {
  id: string;
  dish_id: string;
  name: string;
  price_delta: number;
  sort_order: number;
  is_active: boolean;
  archived_at?: string | null;
  created_at?: string;
}

export interface Combo {
  id: string;
  restaurant_id: string;
  slug: string;
  title: string;
  description: string;
  photo_url: string | null;
  fixed_price: number | null;
  is_active: boolean;
  sort_order: number;
  archived_at?: string | null;
  created_at?: string;
  allow_purchase?: boolean;
  allow_booking?: boolean;
}

export interface ComboItem {
  combo_id: string;
  dish_id: string;
  quantity: number;
  sort_order: number;
}

export interface ComboWithItems extends Combo {
  items: Array<ComboItem & { dish: Dish }>;
}

export interface DailyMenuSelection {
  id: string;
  restaurant_id: string;
  package_price: number;
  max_sides: number;
  menu_date: string;
  updated_at: string;
}

export interface DailyMenuDish {
  daily_menu_id: string;
  dish_id: string;
}

export interface DailyMenuSide {
  daily_menu_id: string;
  dish_id: string;
}

export interface OrderLog {
  id: string;
  restaurant_id: string;
  payload: OrderLogPayload;
  created_at: string;
}

export interface Customer {
  id: string;
  restaurant_id: string;
  name: string;
  phone: string | null;
  address: string;
  orders_count: number;
  last_order_at: string | null;
  created_at: string;
  notes?: string;
  allergies_alert?: string;
  favorite_service?: string;
  birthday?: string | null;
  tags?: string[];
  visit_count?: number;
  visits_toward_reward?: number;
  last_visit_at?: string | null;
  rewards_redeemed?: number;
}

export interface CustomerPhoto {
  id: string;
  restaurant_id: string;
  customer_id: string;
  storage_path: string;
  created_at: string;
  signed_url?: string | null;
}

export interface CustomerVisit {
  id: string;
  restaurant_id: string;
  customer_id: string;
  created_at: string;
  note: string;
}

export interface Order {
  id: string;
  restaurant_id: string;
  customer_id: string | null;
  payload: OrderLogPayload;
  total: number;
  status: string;
  created_at: string;
}

export interface OrderLogPayload {
  customer_name: string;
  /** @deprecated Prefer fulfillment; address no longer persisted for privacy */
  address?: string;
  maps_url?: string | null;
  references?: string;
  fulfillment?: "pickup" | "delivery";
  payment_method: PaymentMethod;
  cash_amount?: number | null;
  phone?: string | null;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  total: number;
  wa_message?: string;
  /** Legacy camelCase from older clients */
  customerName?: string;
  mapsUrl?: string;
  paymentMethod?: PaymentMethod;
}

export interface CartAddon {
  id: string;
  name: string;
  priceDelta: number;
}

export interface CartItem {
  dishId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  /** @deprecated use addons */
  sideIds?: string[];
  /** @deprecated use addons */
  sideNames?: string[];
  addons?: CartAddon[];
  isDailyMenu?: boolean;
  comboId?: string;
  comboTitle?: string;
  /** Snapshot from dish/combo at add time */
  allowPurchase?: boolean;
  allowBooking?: boolean;
  unitType?: "unit" | "kg" | "liter";
  stepValue?: number;
}

export interface CheckoutFormValues {
  fulfillment: "pickup" | "delivery";
  customerName: string;
  address: string;
  mapsUrl?: string;
  references: string;
  paymentMethod: PaymentMethod;
  cashAmount?: number | null;
  phone?: string | null;
}

export interface PublicRestaurantMenu {
  restaurant: Restaurant;
  categories: Category[];
  dishes: Dish[];
  addonsByDishId: Record<string, DishAddon[]>;
  combos: ComboWithItems[];
  dailyMenu: DailyMenuSelection | null;
  dailyDishes: Dish[];
  dailySides: Dish[];
}

export interface AdminDailyMenuState {
  restaurant: Restaurant;
  selection: DailyMenuSelection;
  allMains: Dish[];
  allSides: Dish[];
  selectedMainIds: string[];
  selectedSideIds: string[];
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
