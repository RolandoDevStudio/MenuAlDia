"use client";

import { useEffect, useState } from "react";
import {
  FALLBACK_PLAN_PRICES,
  type PlanPricesMap,
  type PlanType,
} from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SuperAdminSettingsPage() {
  const [prices, setPrices] = useState<PlanPricesMap>(FALLBACK_PLAN_PRICES);
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [contactBlurb, setContactBlurb] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/super-admin/settings");
      if (!res.ok) return;
      const data = (await res.json()) as Record<string, unknown>;
      if (data.plan_prices && typeof data.plan_prices === "object") {
        setPrices({
          ...FALLBACK_PLAN_PRICES,
          ...(data.plan_prices as PlanPricesMap),
        });
      }
      const landing = data.landing_content as
        | {
            heroTitle?: string;
            heroSubtitle?: string;
            contactBlurb?: string;
          }
        | undefined;
      if (landing) {
        setHeroTitle(landing.heroTitle ?? "");
        setHeroSubtitle(landing.heroSubtitle ?? "");
        setContactBlurb(landing.contactBlurb ?? "");
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const r1 = await fetch("/api/super-admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "plan_prices", value: prices }),
    });
    const r2 = await fetch("/api/super-admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "landing_content",
        value: { heroTitle, heroSubtitle, contactBlurb },
      }),
    });
    setSaving(false);
    if (!r1.ok || !r2.ok) {
      setError("No se pudo guardar (¿migración 004 aplicada?)");
      return;
    }
    setMessage("CMS y precios guardados");
  }

  function setMonthly(plan: PlanType, monthly: number) {
    setPrices((p) => ({
      ...p,
      [plan]: { monthly, annual: monthly * 10 },
    }));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-6">
      <div>
        <h1 className="text-xl font-semibold">CMS Landing y precios</h1>
        <p className="text-sm text-muted">
          Edita copy y precios que alimentan la landing y recordatorios de pago.
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border border-black/5 bg-surface p-4">
        <h2 className="text-sm font-semibold">Landing</h2>
        <div className="space-y-1.5">
          <Label>Título hero</Label>
          <Input
            className="min-h-11"
            value={heroTitle}
            onChange={(e) => setHeroTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Subtítulo</Label>
          <Input
            className="min-h-11"
            value={heroSubtitle}
            onChange={(e) => setHeroSubtitle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Blurb contacto</Label>
          <Input
            className="min-h-11"
            value={contactBlurb}
            onChange={(e) => setContactBlurb(e.target.value)}
          />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-black/5 bg-surface p-4">
        <h2 className="text-sm font-semibold">Precios mensuales (MXN)</h2>
        {(["catalog", "daily", "pro"] as PlanType[]).map((plan) => (
          <div key={plan} className="flex items-center gap-3">
            <Label className="w-24 capitalize">{plan}</Label>
            <Input
              className="min-h-11"
              inputMode="numeric"
              value={String(prices[plan].monthly)}
              onChange={(e) => setMonthly(plan, Number(e.target.value) || 0)}
            />
          </div>
        ))}
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      <Button
        type="button"
        className="min-h-11 w-full"
        disabled={saving}
        onClick={() => void save()}
      >
        {saving ? "Guardando…" : "Guardar"}
      </Button>
    </div>
  );
}
