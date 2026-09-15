"use client";

import { useMemo, useState } from "react";
import { Info, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { WhatsappBotGuideDialog } from "@/components/admin/whatsapp-bot-guide-dialog";
import { WhatsappUsageMetrics } from "@/components/admin/whatsapp-usage-metrics";
import { WHATSAPP_BOT_GUIDE_VERSION } from "@/lib/whatsapp-bot-guide";
import {
  addonStatusLabel,
  isWhatsappAiMarketingAddonActive,
} from "@/lib/whatsapp-bot/addon";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export type WhatsappAccountInitial = {
  status?: string | null;
  display_phone?: string | null;
  whatsapp_bot_enabled?: boolean | null;
  pull_menu_enabled?: boolean | null;
  chat_orders_enabled?: boolean | null;
  state_notifications_enabled?: boolean | null;
  upselling_enabled?: boolean | null;
  abandoned_cart_nudge?: boolean | null;
  vip_broadcast_enabled?: boolean | null;
  bot_menu_scope?: string | null;
  guide_ack_at?: string | null;
  guide_version?: string | null;
  whatsapp_ai_marketing_addon?: boolean | null;
  addon_trial_ends_at?: string | null;
  templates_status?: Record<string, string> | null;
  message_templates_config?: {
    menu_pull?: { body?: string };
    abandoned_cart?: { body?: string };
    order_confirm?: { body?: string };
    menu_del_dia?: { name?: string; language?: string; body?: string };
  } | null;
} | null;

type Props = {
  restaurantId: string;
  initial: WhatsappAccountInitial;
};

export function WhatsappBotSettings({ restaurantId, initial }: Props) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideRequireAck, setGuideRequireAck] = useState(false);
  const [pendingAction, setPendingAction] = useState<"enable" | null>(null);
  const [busy, setBusy] = useState(false);

  const [botEnabled, setBotEnabled] = useState(
    Boolean(initial?.whatsapp_bot_enabled),
  );
  const [pullMenu, setPullMenu] = useState(
    Boolean(initial?.pull_menu_enabled),
  );
  const [chatOrders, setChatOrders] = useState(
    Boolean(initial?.chat_orders_enabled),
  );
  const [stateNotifs, setStateNotifs] = useState(
    Boolean(initial?.state_notifications_enabled),
  );
  const [upselling, setUpselling] = useState(
    Boolean(initial?.upselling_enabled),
  );
  const [abandonedNudge, setAbandonedNudge] = useState(
    Boolean(initial?.abandoned_cart_nudge),
  );
  const [vipBroadcast, setVipBroadcast] = useState(
    Boolean(initial?.vip_broadcast_enabled),
  );
  const [menuScope, setMenuScope] = useState(
    initial?.bot_menu_scope === "all_active" ? "all_active" : "specials_only",
  );
  const [status, setStatus] = useState(initial?.status || "disconnected");
  const [guideAckAt, setGuideAckAt] = useState(initial?.guide_ack_at || null);
  const [guideVersion, setGuideVersion] = useState(
    initial?.guide_version || null,
  );
  const [addonFlag] = useState(Boolean(initial?.whatsapp_ai_marketing_addon));
  const [trialEnds] = useState(initial?.addon_trial_ends_at || null);
  const [templatesStatus, setTemplatesStatus] = useState(
    initial?.templates_status ?? {},
  );
  const [abandonedBody, setAbandonedBody] = useState(
    initial?.message_templates_config?.abandoned_cart?.body || "",
  );
  const [menuPullBody, setMenuPullBody] = useState(
    initial?.message_templates_config?.menu_pull?.body || "",
  );
  const [aiBusy, setAiBusy] = useState(false);
  const [vipBusy, setVipBusy] = useState(false);

  const addonAccount = {
    whatsapp_ai_marketing_addon: addonFlag,
    addon_trial_ends_at: trialEnds,
  };
  const addonActive = isWhatsappAiMarketingAddonActive(addonAccount);
  const addonLabel = addonStatusLabel(addonAccount);

  const guideAckOk = useMemo(
    () =>
      Boolean(guideAckAt) && guideVersion === WHATSAPP_BOT_GUIDE_VERSION,
    [guideAckAt, guideVersion],
  );

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/whatsapp/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurant_id: restaurantId, ...body }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        account?: WhatsappAccountInitial;
      };
      if (!res.ok) {
        toast.error(json.error || "No se pudo guardar");
        return false;
      }
      if (json.account) {
        if (json.account.guide_ack_at) setGuideAckAt(json.account.guide_ack_at);
        if (json.account.guide_version)
          setGuideVersion(json.account.guide_version);
        if (json.account.status) setStatus(json.account.status);
      }
      toast.success("Guardado");
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function saveTemplates() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/whatsapp/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          message_templates_config: {
            menu_pull: { body: menuPullBody },
            abandoned_cart: { body: abandonedBody },
          },
          templates_status: templatesStatus,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error || "No se pudo guardar plantillas");
        return;
      }
      toast.success("Textos guardados");
    } finally {
      setBusy(false);
    }
  }

  async function generateAi(scene: "menu_pull" | "abandoned_cart") {
    if (!addonActive) {
      toast.error("Requiere Add-On IA & Marketing");
      return;
    }
    setAiBusy(true);
    try {
      const res = await fetch("/api/admin/whatsapp/ai-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          scene,
          tone: "amigable",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        body?: string;
      };
      if (!res.ok) {
        toast.error(json.message || json.error || "IA no disponible");
        return;
      }
      if (scene === "menu_pull" && json.body) setMenuPullBody(json.body);
      if (scene === "abandoned_cart" && json.body) setAbandonedBody(json.body);
      toast.success("Borrador IA listo — revisa y guarda");
    } finally {
      setAiBusy(false);
    }
  }

  async function runVip(dryRun: boolean) {
    if (!addonActive) {
      toast.error("Requiere Add-On IA & Marketing");
      return;
    }
    setVipBusy(true);
    try {
      const res = await fetch("/api/admin/whatsapp/vip-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          dry_run: dryRun,
          limit: 40,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        would_send?: number;
        sent?: number;
        failed?: number;
      };
      if (!res.ok) {
        toast.error(json.error || "No se pudo difundir");
        return;
      }
      if (dryRun) {
        toast.message(`Simulación: se enviarían ${json.would_send ?? 0} mensajes`);
      } else {
        toast.success(
          `Enviados ${json.sent ?? 0}${json.failed ? ` · fallidos ${json.failed}` : ""}`,
        );
      }
    } finally {
      setVipBusy(false);
    }
  }

  function requestEnableBot(next: boolean) {
    if (!next) {
      setBotEnabled(false);
      void patch({ whatsapp_bot_enabled: false });
      return;
    }
    if (!guideAckOk) {
      setPendingAction("enable");
      setGuideRequireAck(true);
      setGuideOpen(true);
      return;
    }
    setBotEnabled(true);
    void patch({ whatsapp_bot_enabled: true, pull_menu_enabled: true });
    setPullMenu(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/5 bg-surface p-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Asistente de WhatsApp</p>
          <p className="mt-1 text-xs text-muted">
            Antes de conectar, lee la guía (número, Meta y costos). Estado:{" "}
            <span className="font-medium text-foreground">
              {status === "connected" ? "conectado" : "sin conectar"}
            </span>
            {initial?.display_phone
              ? ` · ${initial.display_phone}`
              : null}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setGuideRequireAck(false);
            setGuideOpen(true);
          }}
        >
          <Info className="h-4 w-4" />
          ¿Qué necesito saber?
        </Button>
      </div>

      <div className="space-y-3 rounded-2xl border border-black/5 bg-surface p-4">
        <div className="flex min-h-12 items-center justify-between gap-3">
          <div>
            <Label htmlFor="wa_bot_enabled">Activar asistente</Label>
            <p className="text-xs text-muted">
              Apagado por defecto. Meta cobra difusión Marketing en tu tarjeta
              de negocio si usas el módulo VIP.
            </p>
          </div>
          <Switch
            id="wa_bot_enabled"
            checked={botEnabled}
            disabled={busy}
            onCheckedChange={(v) => requestEnableBot(v)}
          />
        </div>

        <div className="flex min-h-12 items-center justify-between gap-3">
          <div>
            <Label htmlFor="wa_pull">Responder a MENU / hola</Label>
            <p className="text-xs text-muted">
              PULL: el cliente escribe primero (ventana de servicio Meta).
            </p>
          </div>
          <Switch
            id="wa_pull"
            checked={pullMenu}
            disabled={busy || !botEnabled}
            onCheckedChange={(v) => {
              setPullMenu(v);
              void patch({ pull_menu_enabled: v });
            }}
          />
        </div>

        <div className="flex min-h-12 items-center justify-between gap-3">
          <div>
            <Label htmlFor="wa_orders">Tomar pedidos por chat</Label>
            <p className="text-xs text-muted">
              Checkout en WhatsApp → tablero Pedidos.
            </p>
          </div>
          <Switch
            id="wa_orders"
            checked={chatOrders}
            disabled={busy || !botEnabled}
            onCheckedChange={(v) => {
              setChatOrders(v);
              void patch({ chat_orders_enabled: v });
            }}
          />
        </div>

        <div className="flex min-h-12 items-center justify-between gap-3">
          <div>
            <Label htmlFor="wa_notifs">Notificar cambios de estado</Label>
            <p className="text-xs text-muted">
              Avisa al cliente desde el tablero (requiere plantilla o ventana
              24h).
            </p>
          </div>
          <Switch
            id="wa_notifs"
            checked={stateNotifs}
            disabled={busy || !botEnabled}
            onCheckedChange={(v) => {
              setStateNotifs(v);
              void patch({ state_notifications_enabled: v });
            }}
          />
        </div>

        <div className="flex min-h-12 items-center justify-between gap-3">
          <div>
            <Label htmlFor="wa_upsell">Sugerir complemento (upsell)</Label>
            <p className="text-xs text-muted">
              Pro: un extra opcional en el chat (sin imagen). Apagado por
              defecto.
            </p>
          </div>
          <Switch
            id="wa_upsell"
            checked={upselling}
            disabled={busy || !botEnabled}
            onCheckedChange={(v) => {
              setUpselling(v);
              void patch({ upselling_enabled: v });
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="wa_menu_scope">Alcance del menú en PULL</Label>
          <select
            id="wa_menu_scope"
            className="flex h-11 w-full rounded-xl border border-black/10 bg-background px-3 text-sm"
            value={menuScope}
            disabled={busy || !botEnabled}
            onChange={(e) => {
              const scope =
                e.target.value === "all_active"
                  ? "all_active"
                  : "specials_only";
              setMenuScope(scope);
              void patch({ bot_menu_scope: scope });
            }}
          >
            <option value="specials_only">
              Solo especiales / menú del día
            </option>
            <option value="all_active">Catálogo activo (link)</option>
          </select>
        </div>
      </div>

      <WhatsappUsageMetrics restaurantId={restaurantId} />

      <div className="space-y-3 rounded-2xl border border-black/5 bg-surface p-4">
        <div>
          <p className="font-semibold">Add-On IA & Marketing</p>
          <p className="mt-1 text-xs text-muted">
            Estado:{" "}
            <span className="font-medium text-foreground">
              {addonLabel === "active"
                ? "activo"
                : addonLabel === "trial"
                  ? `trial hasta ${trialEnds ? new Date(trialEnds).toLocaleDateString("es-MX") : "—"}`
                  : addonLabel === "expired"
                    ? "trial expirado"
                    : "no contratado"}
            </span>
            . Vision SPEI, nudge de carrito y difusión VIP.
          </p>
        </div>

        <div className="flex min-h-12 items-center justify-between gap-3">
          <div>
            <Label htmlFor="wa_nudge">Nudge carrito abandonado (15 min)</Label>
            <p className="text-xs text-muted">
              1 mensaje máx. dentro de la ventana de servicio. Requiere add-on.
            </p>
          </div>
          <Switch
            id="wa_nudge"
            checked={abandonedNudge}
            disabled={busy || !botEnabled || !addonActive}
            onCheckedChange={(v) => {
              setAbandonedNudge(v);
              void patch({ abandoned_cart_nudge: v });
            }}
          />
        </div>

        <div className="flex min-h-12 items-center justify-between gap-3">
          <div>
            <Label htmlFor="wa_vip">Difusión VIP (Marketing)</Label>
            <p className="text-xs text-muted">
              Solo opt-in. Meta puede cobrar en tu tarjeta. Plantilla
              menu_del_dia APPROVED.
            </p>
          </div>
          <Switch
            id="wa_vip"
            checked={vipBroadcast}
            disabled={busy || !botEnabled || !addonActive}
            onCheckedChange={(v) => {
              setVipBroadcast(v);
              void patch({ vip_broadcast_enabled: v });
            }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={vipBusy || !addonActive || !vipBroadcast}
            onClick={() => void runVip(true)}
          >
            Simular VIP
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={vipBusy || !addonActive || !vipBroadcast}
            onClick={() => void runVip(false)}
          >
            Enviar VIP (opt-in)
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tpl_menu_status">Estado plantilla menu_del_dia</Label>
          <select
            id="tpl_menu_status"
            className="flex h-11 w-full rounded-xl border border-black/10 bg-background px-3 text-sm"
            value={templatesStatus.menu_del_dia || "PENDING"}
            disabled={busy}
            onChange={(e) =>
              setTemplatesStatus((prev) => ({
                ...prev,
                menu_del_dia: e.target.value,
              }))
            }
          >
            <option value="PENDING">PENDING</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="PAUSED">PAUSED</option>
          </select>
          <p className="text-[11px] text-muted">
            Márcalo APPROVED cuando Meta lo apruebe (manual por ahora).
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-black/5 bg-surface p-4">
        <p className="font-semibold">Editor de mensajes</p>
        <p className="text-xs text-muted">
          Textos locales (sesión 24h). La asistencia IA requiere el add-on.
        </p>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="menu_pull_body">MENU / saludo (opcional)</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1"
              disabled={aiBusy || !addonActive}
              onClick={() => void generateAi("menu_pull")}
            >
              <Sparkles className="h-3.5 w-3.5" />
              IA
            </Button>
          </div>
          <Textarea
            id="menu_pull_body"
            rows={3}
            value={menuPullBody}
            onChange={(e) => setMenuPullBody(e.target.value)}
            placeholder="Vacío = mensaje automático del bot"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="abandoned_body">Nudge carrito</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1"
              disabled={aiBusy || !addonActive}
              onClick={() => void generateAi("abandoned_cart")}
            >
              <Sparkles className="h-3.5 w-3.5" />
              IA
            </Button>
          </div>
          <Textarea
            id="abandoned_body"
            rows={3}
            value={abandonedBody}
            onChange={(e) => setAbandonedBody(e.target.value)}
            placeholder="¡Hola! ¿Seguimos con tu pedido?..."
          />
        </div>

        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={() => void saveTemplates()}
        >
          Guardar textos
        </Button>
      </div>

      <div className="rounded-2xl border border-dashed border-black/10 bg-background/50 p-4 text-sm text-muted">
        <p className="font-medium text-foreground">Conectar número (Meta)</p>
        <p className="mt-1">
          Embedded Signup se habilita cuando configures{" "}
          <code className="text-xs">META_APP_ID</code> / config en el servidor.
          Mientras tanto puedes guardar toggles y el webhook ya responde verify
          + mensajes si el número está vinculado en base de datos.
        </p>
        {guideAckOk ? (
          <p className="mt-2 text-xs text-accent">
            Guía aceptada ({WHATSAPP_BOT_GUIDE_VERSION}
            {guideAckAt
              ? ` · ${new Date(guideAckAt).toLocaleString("es-MX")}`
              : ""}
            ).
          </p>
        ) : (
          <p className="mt-2 text-xs">Aún no has confirmado la guía.</p>
        )}
      </div>

      <WhatsappBotGuideDialog
        open={guideOpen}
        onOpenChange={setGuideOpen}
        requireAck={guideRequireAck}
        onAcknowledge={async () => {
          const ok = await patch({
            ack_guide: true,
            guide_version: WHATSAPP_BOT_GUIDE_VERSION,
          });
          if (!ok) throw new Error("ack failed");
          setGuideAckAt(new Date().toISOString());
          setGuideVersion(WHATSAPP_BOT_GUIDE_VERSION);
          if (pendingAction === "enable") {
            setPendingAction(null);
            setBotEnabled(true);
            setPullMenu(true);
            await patch({
              whatsapp_bot_enabled: true,
              pull_menu_enabled: true,
            });
          }
        }}
      />
    </div>
  );
}
