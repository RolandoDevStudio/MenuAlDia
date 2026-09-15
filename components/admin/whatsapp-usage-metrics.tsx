"use client";

import { useCallback, useEffect, useState } from "react";
import type { WaMetricsSummary } from "@/lib/whatsapp-bot/metrics";

export function WhatsappUsageMetrics({ restaurantId }: { restaurantId: string }) {
  const [metrics, setMetrics] = useState<WaMetricsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/whatsapp/metrics?days=30&_=${encodeURIComponent(restaurantId)}`,
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        metrics?: WaMetricsSummary;
      };
      if (!res.ok || !json.metrics) {
        setError(json.error || "No se pudieron cargar métricas");
        setMetrics(null);
        return;
      }
      setMetrics(json.metrics);
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-3 rounded-2xl border border-black/5 bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">Uso y costo estimado (Meta)</p>
          <p className="mt-1 text-xs text-muted">
            Últimos {metrics?.days ?? 30} días             · Solo metadatos (sin cuerpos de chat). Retención limitada: sesiones
            ~48h, wamid ~14d, logs ~120d, comprobantes SPEI ~90d.
          </p>
        </div>
        <button
          type="button"
          className="text-xs font-medium text-brand underline-offset-2 hover:underline"
          onClick={() => void load()}
        >
          Actualizar
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : error ? (
        <p className="text-sm text-amber-900">{error}</p>
      ) : metrics ? (
        <>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Entrantes
              </dt>
              <dd className="text-lg font-semibold">{metrics.inbound}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Salientes
              </dt>
              <dd className="text-lg font-semibold">{metrics.outbound}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Marketing
              </dt>
              <dd className="text-lg font-semibold">
                {metrics.byCategory.marketing}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Est. MXN
              </dt>
              <dd className="text-lg font-semibold text-brand">
                ~${metrics.estimatedMxn}
              </dd>
            </div>
          </dl>
          <p className="text-[11px] text-muted">
            Servicio {metrics.byCategory.service} · Utilidad{" "}
            {metrics.byCategory.utility} · Fallidos {metrics.failed} · ~US$
            {metrics.estimatedUsd.toFixed(2)}
          </p>
          <p className="text-[11px] leading-snug text-muted">
            {metrics.disclaimer}
          </p>
        </>
      ) : null}
    </div>
  );
}
