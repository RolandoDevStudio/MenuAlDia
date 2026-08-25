"use client";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";

type Props = {
  onCtaClick: () => void;
  ctaLabel?: string;
};

/**
 * Short visual breath between dense pricing/ROI and FAQ —
 * one idea + soft CTA, no extra marketing clutter.
 */
export function LandingBreathStrip({
  onCtaClick,
  ctaLabel = "Hablar por WhatsApp",
}: Props) {
  return (
    <Reveal>
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center sm:gap-8">
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-brand-dark sm:text-3xl">
            Actívate el mismo día
          </p>
          <p className="mt-1 max-w-md text-sm text-muted">
            Te respondemos por WhatsApp y dejas tu menú listo para recibir
            pedidos — sin comisiones de intermediarios.
          </p>
        </div>
        <Button
          type="button"
          className="landing-cta min-h-11 shrink-0"
          onClick={onCtaClick}
        >
          {ctaLabel}
        </Button>
      </div>
    </Reveal>
  );
}
