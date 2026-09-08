"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type UsagePayload = {
  paused: boolean;
  scans: { used: number; limit: number; remaining: number };
  images: {
    used: number;
    limit: number;
    bonus: number;
    total: number;
    remaining: number;
  };
  pack: { size: number; priceMxn: number; pending: boolean };
};

export function AiUsagePanel() {
  const [data, setData] = useState<UsagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ai/usage");
      const json = (await res.json()) as UsagePayload & { message?: string };
      if (!res.ok) {
        toast.error(json.message || "No se pudo cargar el uso de IA");
        return;
      }
      setData(json);
    } catch {
      toast.error("Error de red al cargar uso de IA");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function requestPack() {
    setRequesting(true);
    try {
      const res = await fetch("/api/admin/ai/pack-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as { message?: string };
      if (!res.ok) {
        toast.error(json.message || "No se pudo solicitar el pack");
        return;
      }
      toast.success("Solicitud enviada. El superadmin confirmará el pago.");
      await load();
    } catch {
      toast.error("Error de red al solicitar pack");
    } finally {
      setRequesting(false);
    }
  }

  if (loading && !data) {
    return <p className="text-sm text-muted">Cargando uso de IA…</p>;
  }

  if (!data) return null;

  const showPackCta =
    !data.paused && data.images.remaining === 0 && !data.pack.pending;

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted">
        Los escaneos y las imágenes (flyer, banner, fondo) cuentan por mes.
      </p>

      {data.paused ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          IA pausada. No se pueden escanear menús ni generar imágenes por ahora.
        </p>
      ) : null}

      <ul className="space-y-2 text-sm">
        <li className="flex items-center justify-between gap-3">
          <span className="text-muted">Escaneos de menú</span>
          <span className="font-semibold tabular-nums">
            {data.scans.used} / {data.scans.limit}
          </span>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span className="text-muted">
            Imágenes IA
            {data.images.bonus > 0 ? (
              <span className="ml-1 text-[11px]">
                (plan {data.images.limit} + bonus {data.images.bonus})
              </span>
            ) : null}
          </span>
          <span className="font-semibold tabular-nums">
            {data.images.used} / {data.images.total}
          </span>
        </li>
      </ul>

      {data.pack.pending ? (
        <p className="text-xs text-muted">
          Solicitud de pack pendiente (+{data.pack.size} imágenes · $
          {data.pack.priceMxn} MXN).
        </p>
      ) : null}

      {showPackCta ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={requesting}
          onClick={() => void requestPack()}
        >
          {requesting
            ? "Enviando…"
            : `Pedir pack (+${data.pack.size} · $${data.pack.priceMxn} MXN)`}
        </Button>
      ) : null}
    </div>
  );
}
