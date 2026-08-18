/** Database & domain types for Menú al Día */

import type { ThemeConfig } from "@/lib/theme";
import type { PlanType } from "@/lib/plans";

export type MemberRole = "owner" | "staff" | "super_admin";

export type PaymentMethod = "cash" | "transfer";

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
  schedule_text: string;
  shipping_cost: number;
  free_shipping: boolean;
  created_at: string;
  plan_type: PlanType;
  is_active: boolean;
  subscription_end_date: string;
  theme_config: ThemeConfig | Record<string, unknown>;
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
  sort_order: number;
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
  address: string;
  references: string;
  payment_method: PaymentMethod;
  cash_amount?: number | null;
  phone?: string | null;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  total: number;
  wa_message?: string;
}

export interface CartItem {
  dishId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  sideIds?: string[];
  sideNames?: string[];
  isDailyMenu?: boolean;
}

export interface CheckoutFormValues {
  customerName: string;
  address: string;
  references: string;
  paymentMethod: PaymentMethod;
  cashAmount?: number | null;
  phone?: string | null;
}

export interface PublicRestaurantMenu {
  restaurant: Restaurant;
  categories: Category[];
  dishes: Dish[];
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
