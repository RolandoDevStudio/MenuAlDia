"use client";

import { useCallback, useEffect, useState } from "react";
import { WHATSAPP_ADDON_TRIAL_DAYS } from "@/lib/constants/legal";
import { WHATSAPP_AI_MARKETING_ADDON } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type AddonAccount = {
  whatsapp_ai_marketing_addon?: boolean | null;
  addon_trial_ends_at?: string | null;
} | null;

export function WhatsappAddonSaPanel({ restaurantId }: { restaurantId: string }) {
  const [account, setAccount] = useState<AddonAccount>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/super-admin/whatsapp-addon?restaurant_id=${encodeURIComponent(restaurantId)}`,
    );
    if (!res.ok) return;
    const json = (await res.json()) as { account?: AddonAccount };
    setAccount(json.account ?? null);
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/super-admin/whatsapp-addon", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurant_id: restaurantId, ...body }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        account?: AddonAccount;
      };
      if (!res.ok) {
        toast.error(json.error || "No se pudo guardar");
        return;
      }
      setAccount(json.account ?? null);
      toast.success("Add-On WhatsApp actualizado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-black/10 p-3">
      <p className="text-sm font-semibold">
        WhatsApp — {WHATSAPP_AI_MARKETING_ADDON.label}
      </p>
      <p className="text-[11px] text-muted">
        Vision SPEI, VIP y editor IA. Trial{" "}
        {WHATSAPP_ADDON_TRIAL_DAYS} días o flag permanente.
      </p>
      <div className="flex min-h-10 items-center justify-between gap-3">
        <Label htmlFor="sa_wa_addon">Add-on activo</Label>
        <Switch
          id="sa_wa_addon"
          checked={Boolean(account?.whatsapp_ai_marketing_addon)}
          disabled={busy}
          onCheckedChange={(v) =>
            void patch({ whatsapp_ai_marketing_addon: v })
          }
        />
      </div>
      {account?.addon_trial_ends_at ? (
        <p className="text-[11px] text-muted">
          Trial hasta{" "}
          {new Date(account.addon_trial_ends_at).toLocaleString("es-MX")}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void patch({ start_trial_days: WHATSAPP_ADDON_TRIAL_DAYS })
          }
        >
          Iniciar trial {WHATSAPP_ADDON_TRIAL_DAYS} días
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy || !account?.addon_trial_ends_at}
          onClick={() => void patch({ addon_trial_ends_at: null })}
        >
          Limpiar trial
        </Button>
      </div>
    </div>
  );
}
