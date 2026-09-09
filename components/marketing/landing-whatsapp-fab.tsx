"use client";

import { MessageCircle } from "lucide-react";
import { buildWaMeUrl, SALES_WHATSAPP } from "@/lib/whatsapp";
import { trackLandingEvent } from "@/lib/landing-events";

type Props = {
  phone?: string;
  giroLabel?: string;
};

/** Desktop-only floating WhatsApp (mobile uses the sticky bar instead). */
export function LandingWhatsAppFab({
  phone = SALES_WHATSAPP,
  giroLabel,
}: Props) {
  const message = giroLabel
    ? `Hola, quiero información de Menú al Día para mi negocio (${giroLabel}).`
    : "Hola, quiero información de Menú al Día para mi negocio.";
  const url = buildWaMeUrl(phone, message);

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label="Hablar por WhatsApp"
      onClick={() => trackLandingEvent("wa_fab")}
      className="landing-fab-pulse fixed bottom-6 right-6 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition duration-200 hover:scale-105 active:scale-95 md:flex"
      style={{
        marginBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <MessageCircle className="h-7 w-7" aria-hidden />
    </a>
  );
}
