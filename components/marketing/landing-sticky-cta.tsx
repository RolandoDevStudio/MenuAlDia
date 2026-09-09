"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onPrimaryClick: () => void;
  onWhatsAppClick: () => void;
};

function scrollToDemoStage() {
  document
    .getElementById("demo-stage")
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * Mobile-only sticky conversion bar.
 * WhatsApp lives here (not as a floating FAB) so nothing overlaps the CTAs.
 */
export function LandingStickyCta({
  onPrimaryClick,
  onWhatsAppClick,
}: Props) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-surface/95 px-3 pt-2.5 backdrop-blur md:hidden"
      style={{
        paddingBottom: "max(0.65rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto flex max-w-3xl gap-2">
        <Button
          type="button"
          className="landing-cta min-h-11 min-w-0 flex-[1.15] px-3 text-sm"
          onClick={onPrimaryClick}
        >
          Prueba gratis
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 shrink-0 px-3 text-sm"
          onClick={scrollToDemoStage}
        >
          Demo
        </Button>
        <Button
          type="button"
          className="min-h-11 min-w-11 shrink-0 gap-0 bg-[#25D366] px-3 text-white hover:bg-[#1ebe57]"
          aria-label="Hablar por WhatsApp"
          onClick={onWhatsAppClick}
        >
          <MessageCircle className="h-5 w-5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
