/** Database & domain types for Menú al Día (aligned with supabase/migrations/001_init.sql) */

export type MemberRole = "owner" | "staff";

export type PaymentMethod = "cash" | "transfer";

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

export interface OrderLogPayload {
  customer_name: string;
  address: string;
  references: string;
  payment_method: PaymentMethod;
  cash_amount?: number | null;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  total: number;
  wa_message?: string;
}

/** Cart line item (client-side + order payload) */
export interface CartItem {
  dishId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  /** Guarniciones elegidas (solo menú del día) */
  sideIds?: string[];
  sideNames?: string[];
  /** true si es paquete del menú del día */
  isDailyMenu?: boolean;
}

export interface CheckoutFormValues {
  customerName: string;
  address: string;
  references: string;
  paymentMethod: PaymentMethod;
  cashAmount?: number | null;
}

/** Public page aggregate */
export interface PublicRestaurantMenu {
  restaurant: Restaurant;
  categories: Category[];
  dishes: Dish[];
  dailyMenu: DailyMenuSelection | null;
  dailyDishes: Dish[];
  dailySides: Dish[];
}

/** Admin dashboard aggregate */
export interface AdminDailyMenuState {
  restaurant: Restaurant;
  selection: DailyMenuSelection;
  allMains: Dish[];
  allSides: Dish[];
  selectedMainIds: string[];
  selectedSideIds: string[];
}

/** JSON-compatible values (order payloads, etc.) */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
