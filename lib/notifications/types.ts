export type NotificationAudience = "tenant" | "super_admin";

export type NotificationType =
  | "appointment_lead"
  | "new_order"
  | "loyalty_goal"
  | "reminder_daily_menu"
  | "reminder_subscription"
  | "sa_payment_receipt"
  | "sa_new_tenant"
  | "sa_invoice_request"
  | "sa_plan_request";

export type AppNotification = {
  id: string;
  created_at: string;
  audience: NotificationAudience;
  restaurant_id: string | null;
  type: string;
  title: string;
  body: string;
  href: string;
  payload: Record<string, unknown>;
  read_at: string | null;
};
