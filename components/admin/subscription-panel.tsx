"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMxn } from "@/lib/money";
import { PLAN_LABELS, type PlanType } from "@/lib/plans";
import { normalizeCouponCode, type SpeiInfo } from "@/lib/coupons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SubscriptionPanel({
  planType,
}: {
  planType: PlanType;
}) {
  const [listAmount, setListAmount] = useState(0);
  const [spei, setSpei] = useState<SpeiInfo | null>(null);
  const [code, setCode] = useState("");
  const [payAmount, setPayAmount] = useState<number | null>(null);
  const [discount, setDiscount] = useState(0);
  const [label, setLabel] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/platform-coupons/validate");
    const json = (await res.json()) as {
      listAmount?: number;
      spei?: SpeiInfo;
    };
    if (res.ok) {
      setListAmount(json.listAmount ?? 0);
      setSpei(json.spei ?? null);
      setPayAmount(json.listAmount ?? 0);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function apply() {
    setError(null);
    setMsg(null);
    const res = await fetch("/api/admin/platform-coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: normalizeCouponCode(code) }),
    });
    const json = (await res.json()) as {
      error?: string;
      payAmount?: number;
      discount?: number;
      listAmount?: number;
      label?: string;
      spei?: SpeiInfo;
    };
    if (!res.ok) {
      setError(json.error ?? "Cupón no válido");
      setPayAmount(listAmount);
      setDiscount(0);
      setLabel(null);
      return;
    }
    setPayAmount(json.payAmount ?? listAmount);
    setDiscount(json.discount ?? 0);
    setListAmount(json.listAmount ?? listAmount);
    setLabel(json.label ?? null);
    if (json.spei) setSpei(json.spei);
    setMsg("Cupón aplicado (vista previa). No consume usos hasta el pago.");
  }

  return (
    <div id="suscripcion" className="space-y-3 rounded-xl border border-black/5 bg-surface p-4">
      <div>
        <h2 className="text-sm font-semibold">Suscripción</h2>
        <p className="text-xs text-muted">
          Plan {PLAN_LABELS[planType]} · precio lista{" "}
          {formatMxn(listAmount)} / mes. Paga por SPEI y soporte confirma el
          abono.
        </p>
      </div>

      {spei && (spei.clabe || spei.bank) ? (
        <div className="rounded-lg bg-background/80 px-3 py-2 text-xs">
          <p className="font-semibold">Datos SPEI</p>
          {spei.bank ? <p>Banco: {spei.bank}</p> : null}
          {spei.beneficiary ? <p>Beneficiario: {spei.beneficiary}</p> : null}
          {spei.clabe ? (
            <p className="font-mono">CLABE: {spei.clabe}</p>
          ) : null}
          {spei.concept_hint ? (
            <p className="mt-1 text-muted">{spei.concept_hint}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted">
          Los datos bancarios los comparte soporte al renovar.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="min-w-[10rem] flex-1 space-y-1">
          <Label htmlFor="platform_coupon">Cupón</Label>
          <Input
            id="platform_coupon"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="PRIMERMES"
          />
        </div>
        <div className="flex items-end">
          <Button type="button" variant="secondary" onClick={() => void apply()}>
            Aplicar
          </Button>
        </div>
      </div>

      <p className="text-sm font-semibold text-brand">
        Monto a transferir: {formatMxn(payAmount ?? listAmount)}
        {discount > 0 ? (
          <span className="ml-2 text-xs font-normal text-muted">
            (lista {formatMxn(listAmount)} − {formatMxn(discount)}
            {label ? ` · ${label}` : ""})
          </span>
        ) : null}
      </p>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {msg ? <p className="text-xs text-accent">{msg}</p> : null}
    </div>
  );
}
