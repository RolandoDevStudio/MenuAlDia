import { requireTenantSession } from "@/lib/admin-session";
import { PlanGate } from "@/components/admin/plan-gate";
import { WhatsappBotSettings } from "@/components/admin/whatsapp-bot-settings";
import { can } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

export default async function WhatsappBotSettingsPage() {
  const session = await requireTenantSession();
  const plan = session.restaurant.plan_type || "catalog";

  if (!can(plan, "whatsapp_bot")) {
    return (
      <PlanGate
        plan={plan}
        feature="whatsapp_bot"
        title="Asistente WhatsApp (Pro + CRM)"
      >
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          Responde MENU, toma pedidos por chat y notifica estados. Incluido en
          Pro + CRM. La difusión VIP y Vision SPEI son un módulo adicional.
        </p>
      </PlanGate>
    );
  }

  const supabase = await createClient();
  const { data: account } = await supabase
    .from("restaurant_whatsapp_accounts")
    .select(
      "status, display_phone, whatsapp_bot_enabled, pull_menu_enabled, chat_orders_enabled, state_notifications_enabled, upselling_enabled, abandoned_cart_nudge, vip_broadcast_enabled, bot_menu_scope, guide_ack_at, guide_version, whatsapp_ai_marketing_addon, addon_trial_ends_at, templates_status, message_templates_config",
    )
    .eq("restaurant_id", session.restaurant.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-brand-dark">
          WhatsApp bot
        </h1>
        <p className="mt-1 text-sm text-muted">
          Conecta la API oficial de Meta y controla el asistente (apagado por
          defecto).
        </p>
      </div>
      <WhatsappBotSettings
        restaurantId={session.restaurant.id}
        initial={account}
      />
    </div>
  );
}
