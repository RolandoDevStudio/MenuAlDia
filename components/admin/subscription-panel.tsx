"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { formatMxn } from "@/lib/money";
import { PLAN_LABELS, type PlanType } from "@/lib/plans";
import { normalizeCouponCode, type SpeiInfo } from "@/lib/coupons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function speiAmountText(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function CopyRow({
  label,
  display,
  copyValue,
  mono,
}: {
  label: string;
  display: string;
  copyValue: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted">{label}</p>
        <p className={mono ? "break-all font-mono text-sm" : "text-sm"}>
          {display}
        </p>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="min-h-11 shrink-0"
        onClick={() => void copy()}
        aria-label={`Copiar ${label}`}
      >
        <Copy className="h-4 w-4" />
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

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

  const transferAmount = payAmount ?? listAmount;

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
        <div className="divide-y divide-black/5 rounded-lg bg-background/80 px-3 py-1 text-xs">
          <p className="py-2 font-semibold">Datos SPEI</p>
          {spei.bank ? (
            <p className="py-2 text-sm">Banco: {spei.bank}</p>
          ) : null}
          {spei.beneficiary ? (
            <CopyRow
              label="Beneficiario"
              display={spei.beneficiary}
              copyValue={spei.beneficiary}
            />
          ) : null}
          {spei.clabe ? (
            <CopyRow
              label="CLABE"
              display={spei.clabe}
              copyValue={spei.clabe.replace(/\s/g, "")}
              mono
            />
          ) : null}
          {spei.concept_hint ? (
            <CopyRow
              label="Concepto"
              display={spei.concept_hint}
              copyValue={spei.concept_hint}
            />
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

      <CopyRow
        label="Monto a transferir"
        display={
          discount > 0
            ? `${formatMxn(transferAmount)} (lista ${formatMxn(listAmount)} − ${formatMxn(discount)}${label ? ` · ${label}` : ""})`
            : formatMxn(transferAmount)
        }
        copyValue={speiAmountText(transferAmount)}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {msg ? <p className="text-xs text-accent">{msg}</p> : null}
    </div>
  );
}
