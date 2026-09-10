"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PLAN_LABELS, type PlanType } from "@/lib/plans";
import {
  FOUNDING_OFFER_LABEL,
  formatOfferPreview,
  type CommercialDuration,
  type CommercialOfferKind,
  type FoundingPartnerPrices,
} from "@/lib/commercial-offer";

const selectClass =
  "h-11 w-full rounded-lg border border-black/10 bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand";

export type CommercialOfferFormState = {
  kind: CommercialOfferKind;
  label: string;
  freeMonths: number;
  monthlyPrice: string;
  duration: CommercialDuration;
  durationMonths: string;
};

export function defaultOfferFormState(
  kind: CommercialOfferKind = "none",
  planType: PlanType = "catalog",
  foundingPrices?: FoundingPartnerPrices,
): CommercialOfferFormState {
  if (kind === "none") {
    return {
      kind: "none",
      label: "",
      freeMonths: 0,
      monthlyPrice: "",
      duration: "lifetime",
      durationMonths: "12",
    };
  }
  const price = foundingPrices?.[planType] ?? (kind === "founding" ? 120 : 0);
  return {
    kind,
    label: kind === "founding" ? FOUNDING_OFFER_LABEL : "Promoción comercial",
    freeMonths: kind === "founding" ? 1 : 0,
    monthlyPrice: String(price),
    duration: "lifetime",
    durationMonths: "12",
  };
}

export function offerFormFromRestaurant(
  r: {
    commercial_offer_kind?: string | null;
    commercial_offer_label?: string | null;
    commercial_free_months?: number | null;
    commercial_monthly_price?: number | null;
    commercial_duration?: string | null;
    commercial_duration_months?: number | null;
    plan_type?: string | null;
    is_founding_partner?: boolean | null;
  },
  foundingPrices: FoundingPartnerPrices,
): CommercialOfferFormState {
  const kind =
    r.commercial_offer_kind === "founding" ||
    r.commercial_offer_kind === "custom"
      ? r.commercial_offer_kind
      : r.is_founding_partner
        ? "founding"
        : "none";
  if (kind === "none") return defaultOfferFormState("none");
  const plan = (r.plan_type || "catalog") as PlanType;
  return {
    kind,
    label:
      r.commercial_offer_label?.trim() ||
      (kind === "founding" ? FOUNDING_OFFER_LABEL : "Promoción comercial"),
    freeMonths: Number(r.commercial_free_months) || (kind === "founding" ? 1 : 0),
    monthlyPrice: String(
      r.commercial_monthly_price != null &&
        Number(r.commercial_monthly_price) > 0
        ? Number(r.commercial_monthly_price)
        : foundingPrices[plan],
    ),
    duration: r.commercial_duration === "months" ? "months" : "lifetime",
    durationMonths: String(r.commercial_duration_months || 12),
  };
}

type Props = {
  value: CommercialOfferFormState;
  onChange: (next: CommercialOfferFormState) => void;
  planType: PlanType;
  foundingPrices: FoundingPartnerPrices;
  /** When preset changes to founding, caller may also flip is_founding_partner */
  onFoundingPreset?: (enabled: boolean) => void;
  /** Suggest syncing subscription_end when free months change on create */
  showEndDateHint?: boolean;
};

export function CommercialOfferFields({
  value,
  onChange,
  planType,
  foundingPrices,
  onFoundingPreset,
  showEndDateHint,
}: Props) {
  const monthly = Number(value.monthlyPrice) || 0;

  function applyPreset(kind: CommercialOfferKind) {
    const next = defaultOfferFormState(kind, planType, foundingPrices);
    onChange(next);
    onFoundingPreset?.(kind === "founding");
  }

  function syncPriceForPlan(nextPlan: PlanType) {
    if (value.kind === "none") return;
    onChange({
      ...value,
      monthlyPrice: String(foundingPrices[nextPlan]),
    });
  }

  // Expose for parent when plan changes — parent should call via effect
  void syncPriceForPlan;

  const preview =
    value.kind === "none"
      ? "Sin promoción comercial (precio de lista)."
      : formatOfferPreview({
          freeMonths: value.freeMonths,
          monthlyPrice: monthly,
          duration: value.duration,
          durationMonths: Number(value.durationMonths) || null,
          planLabel: PLAN_LABELS[planType],
          label: value.label || FOUNDING_OFFER_LABEL,
        });

  return (
    <div className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
      <div>
        <p className="text-sm font-semibold text-amber-950">Oferta comercial</p>
        <p className="text-[11px] text-muted">
          Trato recurrente del tenant. Los cupones siguen siendo para un solo
          pago.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Preset</Label>
        <select
          className={selectClass}
          value={value.kind}
          onChange={(e) => applyPreset(e.target.value as CommercialOfferKind)}
        >
          <option value="none">Sin promoción</option>
          <option value="founding">Negocio Fundador</option>
          <option value="custom">Personalizada</option>
        </select>
      </div>

      {value.kind !== "none" ? (
        <>
          <div className="space-y-1.5">
            <Label>Etiqueta visible al comercio</Label>
            <Input
              value={value.label}
              onChange={(e) => onChange({ ...value, label: e.target.value })}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Meses gratis</Label>
              <Input
                type="number"
                min={0}
                max={12}
                value={value.freeMonths}
                onChange={(e) =>
                  onChange({
                    ...value,
                    freeMonths: Math.max(
                      0,
                      Math.min(12, Number(e.target.value) || 0),
                    ),
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Precio mensual congelado (MXN)</Label>
              <Input
                type="number"
                min={1}
                value={value.monthlyPrice}
                onChange={(e) =>
                  onChange({ ...value, monthlyPrice: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Vigencia</Label>
              <select
                className={selectClass}
                value={value.duration}
                onChange={(e) =>
                  onChange({
                    ...value,
                    duration: e.target.value as CommercialDuration,
                  })
                }
              >
                <option value="lifetime">De por vida</option>
                <option value="months">N meses</option>
              </select>
            </div>
            {value.duration === "months" ? (
              <div className="space-y-1.5">
                <Label>Cantidad de meses</Label>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={value.durationMonths}
                  onChange={(e) =>
                    onChange({ ...value, durationMonths: e.target.value })
                  }
                />
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <p className="text-xs leading-relaxed text-amber-950/80">{preview}</p>
      {showEndDateHint && value.kind !== "none" && value.freeMonths > 0 ? (
        <p className="text-[11px] text-muted">
          Al crear: la fecha de vencimiento inicial será hoy +{" "}
          {value.freeMonths * 30} días (cortesía).
        </p>
      ) : null}
    </div>
  );
}

/** Suggested monthly from founding template when plan changes under an active offer. */
export function suggestedFoundingPrice(
  planType: PlanType,
  foundingPrices: FoundingPartnerPrices,
): string {
  return String(foundingPrices[planType]);
}
