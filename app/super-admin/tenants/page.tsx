"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Restaurant } from "@/lib/types";
import type { PlanType } from "@/lib/plans";
import { PLAN_LABELS, PLAN_PRICES_MXN } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function TenantsPage() {
  const [rows, setRows] = useState<Restaurant[]>([]);
  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [cloneSource, setCloneSource] = useState("");
  const [cloneSlug, setCloneSlug] = useState("");
  const [cloneName, setCloneName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("restaurants")
      .select("*")
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    else setRows((data ?? []) as Restaurant[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (planFilter !== "all" && r.plan_type !== planFilter) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return (
        r.name.toLowerCase().includes(s) || r.slug.toLowerCase().includes(s)
      );
    });
  }, [rows, q, planFilter]);

  async function patch(
    id: string,
    patch: Partial<Pick<Restaurant, "plan_type" | "is_active" | "subscription_end_date">>,
  ) {
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("restaurants")
      .update(patch)
      .eq("id", id);
    if (err) setError(err.message);
    else await load();
  }

  async function cloneTenant() {
    setBusy(true);
    setMessage(null);
    setError(null);
    const res = await fetch("/api/super-admin/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_slug: cloneSource,
        new_slug: cloneSlug,
        new_name: cloneName,
      }),
    });
    const json = (await res.json()) as { error?: string; slug?: string };
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Error al clonar");
      return;
    }
    setMessage(`Clonado: /${json.slug}`);
    setCloneSlug("");
    setCloneName("");
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Suscriptores</h1>
        <p className="text-sm text-muted">Planes, estado y vencimiento.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar nombre o slug"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="h-11 rounded-lg border border-black/10 bg-surface px-3 text-sm"
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
        >
          <option value="all">Todos los planes</option>
          <option value="catalog">Catálogo</option>
          <option value="daily">Menú al Día</option>
          <option value="pro">Pro</option>
        </select>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-accent">{message}</p> : null}

      <ul className="space-y-3">
        {filtered.map((r) => (
          <li
            key={r.id}
            className="space-y-3 rounded-2xl border border-black/5 bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.name}</p>
                <p className="text-xs text-muted">/{r.slug}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Activo</span>
                <Switch
                  checked={r.is_active !== false}
                  onCheckedChange={(on) => patch(r.id, { is_active: on })}
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Plan</Label>
                <select
                  className="h-11 w-full rounded-lg border border-black/10 bg-background px-3 text-sm"
                  value={r.plan_type || "catalog"}
                  onChange={(e) =>
                    patch(r.id, { plan_type: e.target.value as PlanType })
                  }
                >
                  {(Object.keys(PLAN_LABELS) as PlanType[]).map((p) => (
                    <option key={p} value={p}>
                      {PLAN_LABELS[p]} (${PLAN_PRICES_MXN[p]})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Vence</Label>
                <Input
                  type="date"
                  value={r.subscription_end_date?.slice(0, 10) ?? ""}
                  onChange={(e) =>
                    patch(r.id, {
                      subscription_end_date: new Date(
                        e.target.value + "T23:59:59",
                      ).toISOString(),
                    })
                  }
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <section className="rounded-2xl border border-black/10 bg-surface p-4 space-y-3">
        <h2 className="text-sm font-semibold">Clonar plantilla</h2>
        <div className="space-y-1.5">
          <Label>Origen (slug)</Label>
          <Input
            list="seed-slugs"
            value={cloneSource}
            onChange={(e) => setCloneSource(e.target.value)}
            placeholder="demo-fonda"
          />
          <datalist id="seed-slugs">
            {rows.map((r) => (
              <option key={r.id} value={r.slug} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label>Nuevo slug</Label>
          <Input
            value={cloneSlug}
            onChange={(e) => setCloneSlug(e.target.value)}
            placeholder="mi-fonda"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Nombre</Label>
          <Input
            value={cloneName}
            onChange={(e) => setCloneName(e.target.value)}
            placeholder="Mi Fonda"
          />
        </div>
        <Button
          className="w-full"
          disabled={busy || !cloneSource || !cloneSlug || !cloneName}
          onClick={cloneTenant}
        >
          {busy ? "Clonando…" : "Clonar tenant"}
        </Button>
      </section>
    </div>
  );
}
