"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { WhatsappBotGuideDialog } from "@/components/admin/whatsapp-bot-guide-dialog";
import { WHATSAPP_BOT_GUIDE_VERSION } from "@/lib/whatsapp-bot-guide";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type WhatsappAccountInitial = {
  status?: string | null;
  display_phone?: string | null;
  whatsapp_bot_enabled?: boolean | null;
  pull_menu_enabled?: boolean | null;
  chat_orders_enabled?: boolean | null;
  state_notifications_enabled?: boolean | null;
  bot_menu_scope?: string | null;
  guide_ack_at?: string | null;
  guide_version?: string | null;
  whatsapp_ai_marketing_addon?: boolean | null;
  addon_trial_ends_at?: string | null;
  templates_status?: Record<string, string> | null;
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
  const [menuScope, setMenuScope] = useState(
    initial?.bot_menu_scope === "all_active" ? "all_active" : "specials_only",
  );
  const [status, setStatus] = useState(initial?.status || "disconnected");
  const [guideAckAt, setGuideAckAt] = useState(initial?.guide_ack_at || null);
  const [guideVersion, setGuideVersion] = useState(
    initial?.guide_version || null,
  );

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
              Próximas fases: checkout en WhatsApp → tablero Pedidos.
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
