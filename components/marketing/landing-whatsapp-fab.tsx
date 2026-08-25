"use client";

import { MessageCircle } from "lucide-react";
import {
  buildWaMeUrl,
  formatSalesWhatsAppDisplay,
  SALES_WHATSAPP,
} from "@/lib/whatsapp";

type Props = {
  phone?: string;
  giroLabel?: string;
};

export function LandingWhatsAppFab({
  phone = SALES_WHATSAPP,
  giroLabel,
}: Props) {
  const message = giroLabel
    ? `Hola, quiero información de Menú al Día para mi negocio (${giroLabel}).`
    : "Hola, quiero información de Menú al Día para mi negocio.";
  const url = buildWaMeUrl(phone, message);
  const display = formatSalesWhatsAppDisplay(phone);

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label={`WhatsApp ventas ${display}`}
      className="landing-fab-pulse fixed bottom-[4.75rem] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition duration-200 hover:scale-105 active:scale-95 motion-safe:animate-[rise_0.7s_ease-out] md:bottom-5 md:z-50"
      style={{
        marginBottom: "env(safe-area-inset-bottom)",
        animationFillMode: "both",
        animationDelay: "400ms",
      }}
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}
