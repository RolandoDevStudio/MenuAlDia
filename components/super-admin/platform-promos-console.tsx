"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLAN_LABELS, type PlanType } from "@/lib/plans";
import { Emoji } from "@/components/ui-emoji";
import { UI_EMOJI } from "@/lib/ui-emoji";

type Coupon = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  plan_scope: string;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  redemption_count: number;
  is_active: boolean;
  label: string;
};

export function PlatformPromosConsole() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">(
    "percent",
  );
  const [discountValue, setDiscountValue] = useState("20");
  const [planScope, setPlanScope] = useState("all");
  const [endsOn, setEndsOn] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/super-admin/platform-coupons");
    const json = (await res.json()) as { coupons?: Coupon[]; error?: string };
    if (!res.ok) {
      setError(json.error ?? "Error");
      return;
    }
    setCoupons(json.coupons ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/platform-coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          discount_type: discountType,
          discount_value: Number(discountValue),
          plan_scope: planScope,
          ends_on: endsOn || null,
          max_redemptions: maxUses || null,
          label,
          is_active: true,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "No se pudo crear");
        return;
      }
      setCode("");
      setLabel("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(c: Coupon) {
    await fetch("/api/super-admin/platform-coupons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, is_active: !c.is_active }),
    });
    await load();
  }

  async function remove(c: Coupon) {
    const used = Number(c.redemption_count ?? 0);
    const ok = window.confirm(
      used > 0
        ? `¿Eliminar ${c.code}? Tiene ${used} canje(s). Se borrará el historial de canjes de este cupón y podrás reutilizar el código.`
        : `¿Eliminar ${c.code}? Podrás volver a crear el mismo código.`,
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/super-admin/platform-coupons?id=${encodeURIComponent(c.id)}`,
        { method: "DELETE" },
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "No se pudo eliminar");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">
          <Emoji char={UI_EMOJI.promos} />
          Promociones (cupones B2B)
        </h1>
        <p className="text-sm text-muted">
          Descuentos sobre planes de suscripción. El canje ocurre al registrar
          el pago SPEI. Elimina un cupón para liberar el código y reutilizarlo.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-black/5 bg-surface p-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Código</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="LANZAMIENTO50"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Etiqueta</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <select
            className="flex h-11 w-full rounded-lg border border-black/10 bg-background px-3 text-sm"
            value={discountType}
            onChange={(e) =>
              setDiscountType(e.target.value as "percent" | "fixed")
            }
          >
            <option value="percent">Porcentaje</option>
            <option value="fixed">Monto fijo (MXN)</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Valor</Label>
          <Input
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            inputMode="decimal"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Plan</Label>
          <select
            className="flex h-11 w-full rounded-lg border border-black/10 bg-background px-3 text-sm"
            value={planScope}
            onChange={(e) => setPlanScope(e.target.value)}
          >
            <option value="all">Todos</option>
            {(Object.keys(PLAN_LABELS) as PlanType[]).map((p) => (
              <option key={p} value={p}>
                {PLAN_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Vence (día completo)</Label>
          <Input
            type="date"
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Máx. usos (vacío = ilimitado)</Label>
          <Input
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            inputMode="numeric"
          />
        </div>
        <div className="flex items-end">
          <Button type="button" disabled={busy} onClick={() => void create()}>
            <Emoji char={UI_EMOJI.create} />
            Crear cupón
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <ul className="divide-y divide-black/5 rounded-xl border border-black/5 bg-surface">
        {coupons.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
          >
            <div>
              <p className="font-semibold">
                {c.code}{" "}
                <span className="text-xs font-normal text-muted">
                  {c.is_active ? "activo" : "inactivo"}
                </span>
              </p>
              <p className="text-xs text-muted">
                {c.discount_type === "percent"
                  ? `${c.discount_value}%`
                  : `$${c.discount_value}`}{" "}
                · {c.plan_scope} · usos {c.redemption_count}
                {c.max_redemptions != null ? `/${c.max_redemptions}` : ""}
                {c.label ? ` · ${c.label}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void toggle(c)}
              >
                {c.is_active ? "Desactivar" : "Activar"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-red-700 hover:bg-red-50 hover:text-red-800"
                disabled={busy}
                onClick={() => void remove(c)}
              >
                Eliminar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
