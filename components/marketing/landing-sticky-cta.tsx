"use client";

import { Button } from "@/components/ui/button";

type Props = {
  onPrimaryClick: () => void;
};

function scrollToDemoStage() {
  document
    .getElementById("demo-stage")
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

/** Mobile-only sticky CTA above the WhatsApp FAB. */
export function LandingStickyCta({ onPrimaryClick }: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-surface/95 px-4 py-3 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-3xl gap-2">
        <Button
          type="button"
          className="landing-cta min-h-11 flex-1"
          onClick={onPrimaryClick}
        >
          Solicitar prueba gratis
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 shrink-0"
          onClick={scrollToDemoStage}
        >
          Ver demo
        </Button>
      </div>
    </div>
  );
}
