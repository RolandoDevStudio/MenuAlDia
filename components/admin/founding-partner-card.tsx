import { formatMxn } from "@/lib/money";
import { PLAN_LABELS, type PlanType } from "@/lib/plans";
import type { FoundingPartnerPrices } from "@/lib/commercial-offer";
import {
  FALLBACK_FOUNDING_PARTNER_PRICES,
  hasActiveCommercialOffer,
  type CommercialOfferRestaurant,
} from "@/lib/commercial-offer";

type Props = {
  restaurant: CommercialOfferRestaurant & {
    plan_type?: string | null;
    is_founding_partner?: boolean | null;
  };
  foundingPrices?: FoundingPartnerPrices;
};

export function FoundingPartnerCard({
  restaurant,
  foundingPrices = FALLBACK_FOUNDING_PARTNER_PRICES,
}: Props) {
  const kind = restaurant.commercial_offer_kind;
  const show =
    hasActiveCommercialOffer(restaurant) ||
    restaurant.is_founding_partner === true;
  if (!show) return null;

  const plan = (restaurant.plan_type || "catalog") as PlanType;
  const label =
    restaurant.commercial_offer_label?.trim() ||
    (kind === "founding" || restaurant.is_founding_partner
      ? "Negocio Fundador"
      : "Promoción comercial");
  const monthly =
    Number(restaurant.commercial_monthly_price) > 0
      ? Number(restaurant.commercial_monthly_price)
      : foundingPrices[plan];
  const freeMonths = Number(restaurant.commercial_free_months) || 0;
  const duration =
    restaurant.commercial_duration === "months"
      ? `${restaurant.commercial_duration_months ?? "?"} meses`
      : "de por vida";
  const isFounding =
    kind === "founding" || restaurant.is_founding_partner === true;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-5">
      <h3 className="text-lg font-bold text-amber-950">
        Membresía: {label}
      </h3>
      <p className="mt-1 text-sm text-stone-700">
        {isFounding
          ? "Formas parte de los comercios pioneros de Menú al Día. Tu cuenta tiene beneficios preferenciales."
          : "Tu cuenta tiene una promoción comercial activa con tarifa preferencial."}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
        <div className="rounded-lg border border-black/5 bg-white/80 p-3">
          <span className="block font-semibold text-stone-500">
            Periodo inicial
          </span>
          <span className="text-base font-bold text-green-700">
            {freeMonths > 0
              ? `${freeMonths} mes${freeMonths === 1 ? "" : "es"} gratis`
              : "Sin mes gratis"}
          </span>
        </div>
        <div className="rounded-lg border border-black/5 bg-white/80 p-3">
          <span className="block font-semibold text-stone-500">
            Tu plan ({PLAN_LABELS[plan]})
          </span>
          <span className="text-base font-bold text-amber-800">
            {formatMxn(monthly)} / mes
          </span>
        </div>
        <div className="rounded-lg border border-black/5 bg-white/80 p-3">
          <span className="block font-semibold text-stone-500">Vigencia</span>
          <span className="text-base font-bold text-blue-800">
            Congelado {duration}
          </span>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-stone-500">
        Catálogo {formatMxn(foundingPrices.catalog)} · Menú al Día{" "}
        {formatMxn(foundingPrices.daily)} · Pro{" "}
        {formatMxn(foundingPrices.pro)} (tarifas de referencia del programa;
        tu monto congelado es el de tu plan actual). Un mes intermedio a tarifa
        especial se opera al renovar.
      </p>

      {isFounding ? (
        <details className="mt-3 cursor-pointer text-xs text-stone-500">
          <summary className="font-medium hover:underline">
            Ver detalles del Programa Negocio Fundador
          </summary>
          <div className="mt-2 space-y-1 border-t border-stone-200 pt-2">
            <p>
              <strong>Tus compromisos:</strong> brindar una breve
              reseña/testimonio tras tu primer mes de uso y permitir la
              inclusión del logo de tu negocio en nuestra landing como comercio
              usuario.
            </p>
            <p>
              <strong>Aviso legal:</strong> el término “Negocio Fundador” /
              “Socio Fundador” corresponde a una membresía comercial
              preferencial de uso de software con tarifa congelada. No
              representa sociedad mercantil, participación accionaria, ni
              derechos sobre las utilidades o propiedad intelectual de Menú al
              Día.
            </p>
          </div>
        </details>
      ) : null}
    </div>
  );
}
