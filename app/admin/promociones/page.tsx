"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeCouponCode } from "@/lib/coupons";

type Coupon = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_subtotal: number | null;
  ends_at: string | null;
  max_uses: number | null;
  use_count: number;
  max_uses_per_customer: number | null;
  is_active: boolean;
};

export default function AdminPromocionesPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">(
    "percent",
  );
  const [discountValue, setDiscountValue] = useState("10");
  const [minSubtotal, setMinSubtotal] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [maxPerCustomer, setMaxPerCustomer] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/tenant-coupons");
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
    setError(null);
    const res = await fetch("/api/admin/tenant-coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: normalizeCouponCode(code),
        discount_type: discountType,
        discount_value: Number(discountValue),
        min_subtotal: minSubtotal || null,
        ends_on: endsOn || null,
        max_uses: maxUses || null,
        max_uses_per_customer: maxPerCustomer || null,
      }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "No se pudo crear");
      return;
    }
    setCode("");
    await load();
  }

  async function toggle(c: Coupon) {
    await fetch("/api/admin/tenant-coupons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, is_active: !c.is_active }),
    });
    await load();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">Promociones</h1>
        <p className="text-sm text-muted">
          Cupones para el carrito de tu menú público (WhatsApp).
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-black/5 bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Código</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="TACOMARTES"
            />
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
              <option value="fixed">Monto fijo</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Valor</Label>
            <Input
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Mín. compra (MXN)</Label>
            <Input
              value={minSubtotal}
              onChange={(e) => setMinSubtotal(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Vence</Label>
            <Input
              type="date"
              value={endsOn}
              onChange={(e) => setEndsOn(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Máx. usos totales</Label>
            <Input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Máx. por cliente (teléfono)</Label>
            <Input
              value={maxPerCustomer}
              onChange={(e) => setMaxPerCustomer(e.target.value)}
            />
          </div>
        </div>
        <Button type="button" onClick={() => void create()}>
          Crear
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <ul className="divide-y divide-black/5 rounded-xl border border-black/5">
        {coupons.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
          >
            <div>
              <p className="font-semibold">{c.code}</p>
              <p className="text-xs text-muted">
                {c.discount_type === "percent"
                  ? `${c.discount_value}%`
                  : `$${c.discount_value}`}
                {c.min_subtotal ? ` · min $${c.min_subtotal}` : ""} ·{" "}
                {c.is_active ? "activo" : "off"}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void toggle(c)}
            >
              {c.is_active ? "Off" : "On"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
