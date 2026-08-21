"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PLAN_LABELS, type PlanType } from "@/lib/plans";
import { Button } from "@/components/ui/button";

type RequestRow = {
  id: string;
  restaurant_id: string;
  request_type: string;
  from_plan: string;
  to_plan: string | null;
  reason: string;
  status: string;
  created_at: string;
  restaurants?: {
    name?: string;
    slug?: string;
    plan_type?: string;
    is_active?: boolean;
    grace_ends_at?: string | null;
    purge_scheduled_at?: string | null;
  } | null;
};

export function PlanRequestsConsole() {
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/super-admin/plan-requests?status=${encodeURIComponent(status)}`,
      );
      const json = (await res.json()) as {
        requests?: RequestRow[];
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "No se pudo cargar");
        setRows([]);
        return;
      }
      setRows(json.requests ?? []);
    } catch {
      setError("Error de red");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(id: string, action: "approve" | "reject") {
    const note =
      action === "reject"
        ? window.prompt("Nota de rechazo (opcional)") ?? ""
        : "";
    setBusyId(id);
    try {
      const res = await fetch("/api/super-admin/plan-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, review_note: note }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Falló la revisión");
        return;
      }
      await load();
    } catch {
      setError("Error de red");
    } finally {
      setBusyId(null);
    }
  }

  async function syncLifecycle() {
    setSyncMsg(null);
    try {
      const res = await fetch("/api/super-admin/lifecycle-sync", {
        method: "POST",
      });
      const json = (await res.json()) as {
        synced?: number;
        purge_due?: { name?: string; slug?: string }[];
        error?: string;
      };
      if (!res.ok) {
        setSyncMsg(json.error ?? "Sync falló");
        return;
      }
      const due = json.purge_due?.length ?? 0;
      setSyncMsg(
        `Sincronizados: ${json.synced ?? 0}. En cola de purga: ${due}.`,
      );
    } catch {
      setSyncMsg("Error de red");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Solicitudes de plan</h1>
          <p className="text-sm text-muted">
            Aprobar cancelaciones (gracia) o cambios de plan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-10 rounded-lg border border-black/10 bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="pending">Pendientes</option>
            <option value="approved">Aprobadas</option>
            <option value="rejected">Rechazadas</option>
            <option value="cancelled">Canceladas por tenant</option>
            <option value="all">Todas</option>
          </select>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            Recargar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void syncLifecycle()}
            title="Marca vencidos con ventana de gracia/purga"
          >
            Sync vencidos
          </Button>
        </div>
      </div>

      {syncMsg ? <p className="text-xs text-muted">{syncMsg}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">Sin solicitudes en este filtro.</p>
      ) : (
        <ul className="divide-y divide-black/5 rounded-xl border border-black/5 bg-surface">
          {rows.map((r) => {
            const name = r.restaurants?.name ?? r.restaurant_id.slice(0, 8);
            return (
              <li key={r.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      <Link
                        href={`/super-admin/tenants?edit=${encodeURIComponent(r.restaurant_id)}`}
                        className="text-brand hover:underline"
                      >
                        {name}
                      </Link>
                    </p>
                    <p className="text-xs text-muted">
                      {new Date(r.created_at).toLocaleString("es-MX")} ·{" "}
                      {r.request_type === "cancel"
                        ? "Cancelación"
                        : `Cambio → ${PLAN_LABELS[(r.to_plan as PlanType) || "catalog"] ?? r.to_plan}`}{" "}
                      · desde{" "}
                      {PLAN_LABELS[(r.from_plan as PlanType) || "catalog"] ??
                        r.from_plan}
                    </p>
                    {r.reason ? (
                      <p className="mt-1 text-xs text-muted">“{r.reason}”</p>
                    ) : null}
                  </div>
                  <span className="rounded-md bg-black/5 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                    {r.status}
                  </span>
                </div>
                {r.status === "pending" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyId === r.id}
                      onClick={() => void review(r.id, "approve")}
                    >
                      Aprobar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === r.id}
                      onClick={() => void review(r.id, "reject")}
                    >
                      Rechazar
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
