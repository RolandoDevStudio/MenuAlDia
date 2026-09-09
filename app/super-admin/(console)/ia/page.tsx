"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type PackRow = {
  id: string;
  restaurant_id: string;
  pack_size: number;
  amount_mxn: number | null;
  notes: string;
  created_at: string;
  restaurants?: { name?: string; slug?: string } | null;
};

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  plan_type: string;
  ai_image_bonus: number;
  ai_paused: boolean;
};

type Payload = {
  vertexConfigured: boolean;
  todayCount: number;
  dailyLimit: number;
  packMeta: { size: number; priceMxn: number };
  settings: Record<string, unknown>;
  byKind: Record<string, { ok: number; fail: number }>;
  pendingPacks: PackRow[];
  tenants: TenantRow[];
};

export default function SuperAdminAiPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(1200);
  const [scanLimit, setScanLimit] = useState(8);
  const [packSize, setPackSize] = useState(10);
  const [packPrice, setPackPrice] = useState(29);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/ai");
      const json = (await res.json()) as Payload & { error?: string };
      if (!res.ok) throw new Error(json.error || "Error");
      setData(json);
      const s = json.settings ?? {};
      setPaused(s.ai_paused === true || s.ai_paused === "true");
      setDailyLimit(Number(s.ai_daily_global_limit) || json.dailyLimit || 1200);
      setScanLimit(Number(s.ai_scan_monthly_limit) || 8);
      setPackSize(Number(s.ai_image_pack_size) || json.packMeta.size);
      setPackPrice(Number(s.ai_image_pack_price_mxn) || json.packMeta.priceMxn);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings() {
    const res = await fetch("/api/super-admin/ai", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ai_paused: paused,
        ai_daily_global_limit: dailyLimit,
        ai_scan_monthly_limit: scanLimit,
        ai_image_pack_size: packSize,
        ai_image_pack_price_mxn: packPrice,
      }),
    });
    if (!res.ok) {
      toast.error("No se pudieron guardar los ajustes");
      return;
    }
    toast.success("Ajustes de IA guardados");
    await load();
  }

  async function reviewPack(id: string, action: "approve" | "reject") {
    const res = await fetch("/api/super-admin/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: id, action }),
    });
    if (!res.ok) {
      toast.error("No se pudo actualizar el pack");
      return;
    }
    toast.success(action === "approve" ? "Pack aprobado" : "Pack rechazado");
    await load();
  }

  async function patchTenant(
    tenantId: string,
    patch: { ai_image_bonus?: number; tenant_ai_paused?: boolean },
  ) {
    const res = await fetch("/api/super-admin/ai", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, ...patch }),
    });
    if (!res.ok) {
      toast.error("No se pudo actualizar el tenant");
      return;
    }
    toast.success("Tenant actualizado");
    await load();
  }

  if (loading && !data) {
    return <p className="text-sm text-muted">Cargando IA…</p>;
  }

  const pct = data
    ? Math.min(100, Math.round((data.todayCount / Math.max(1, data.dailyLimit)) * 100))
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">IA · Vertex</h1>
        <p className="text-sm text-muted">
          Cupos, packs y métricas. Vertex configurado:{" "}
          <strong>{data?.vertexConfigured ? "sí" : "no"}</strong>
        </p>
      </div>

      <div className="rounded-2xl border border-black/10 bg-surface p-4">
        <p className="text-sm font-semibold">Uso de hoy</p>
        <p className="mt-1 text-2xl font-semibold">
          {data?.todayCount ?? 0} / {data?.dailyLimit ?? 0}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/5">
          <div
            className="h-full bg-brand"
            style={{ width: `${pct}%` }}
          />
        </div>
        {pct >= 80 ? (
          <p className="mt-2 text-xs text-amber-700">
            Atención: más del 80% del tope diario de plataforma.
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-black/10 bg-surface p-4 space-y-3">
        <p className="text-sm font-semibold">Controles</p>
        <div className="flex min-h-11 items-center justify-between">
          <Label htmlFor="ai-paused">IA pausada (global)</Label>
          <Switch
            id="ai-paused"
            checked={paused}
            onCheckedChange={setPaused}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Tope diario global</Label>
            <Input
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1">
            <Label>Escaneos / mes (tenant)</Label>
            <Input
              type="number"
              value={scanLimit}
              onChange={(e) => setScanLimit(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1">
            <Label>Tamaño pack imágenes</Label>
            <Input
              type="number"
              value={packSize}
              onChange={(e) => setPackSize(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1">
            <Label>Precio pack (MXN)</Label>
            <Input
              type="number"
              value={packPrice}
              onChange={(e) => setPackPrice(Number(e.target.value) || 0)}
            />
          </div>
        </div>
        <Button type="button" onClick={() => void saveSettings()}>
          Guardar controles
        </Button>
      </div>

      <div className="rounded-2xl border border-black/10 bg-surface p-4">
        <p className="text-sm font-semibold">Este mes por tipo</p>
        <ul className="mt-2 space-y-1 text-sm">
          {Object.entries(data?.byKind ?? {}).map(([kind, v]) => (
            <li key={kind} className="flex justify-between gap-2">
              <span>{kind}</span>
              <span className="text-muted">
                ok {v.ok} · fail {v.fail}
              </span>
            </li>
          ))}
          {Object.keys(data?.byKind ?? {}).length === 0 ? (
            <li className="text-muted">Sin uso aún</li>
          ) : null}
        </ul>
      </div>

      <div className="rounded-2xl border border-black/10 bg-surface p-4 space-y-3">
        <p className="text-sm font-semibold">
          Packs pendientes ({data?.pendingPacks.length ?? 0})
        </p>
        {(data?.pendingPacks ?? []).map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/5 p-3"
          >
            <div>
              <p className="font-medium">
                {p.restaurants?.name ?? p.restaurant_id}
              </p>
              <p className="text-xs text-muted">
                +{p.pack_size} imágenes · ${p.amount_mxn ?? "—"} MXN
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => void reviewPack(p.id, "approve")}
              >
                Confirmar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void reviewPack(p.id, "reject")}
              >
                Rechazar
              </Button>
            </div>
          </div>
        ))}
        {(data?.pendingPacks.length ?? 0) === 0 ? (
          <p className="text-sm text-muted">No hay solicitudes.</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-black/10 bg-surface p-4 space-y-2">
        <p className="text-sm font-semibold">Tenants · bonus / pausa</p>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {(data?.tenants ?? []).map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-black/5 px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.name}</p>
                <p className="text-[11px] text-muted">
                  {t.plan_type} · bonus {t.ai_image_bonus ?? 0}
                </p>
              </div>
              <Input
                type="number"
                className="w-20"
                defaultValue={t.ai_image_bonus ?? 0}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n) || n === (t.ai_image_bonus ?? 0)) {
                    return;
                  }
                  void patchTenant(t.id, { ai_image_bonus: n });
                }}
              />
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={Boolean(t.ai_paused)}
                  onChange={(e) =>
                    void patchTenant(t.id, {
                      tenant_ai_paused: e.target.checked,
                    })
                  }
                />
                Pausar
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
