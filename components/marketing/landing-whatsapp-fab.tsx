"use client";

import { MessageCircle } from "lucide-react";
import { buildWaMeUrl, SALES_WHATSAPP } from "@/lib/whatsapp";

const MESSAGE =
  "Hola, quiero información de Menú al Día para mi negocio.";

export function LandingWhatsAppFab() {
  const url = buildWaMeUrl(SALES_WHATSAPP, MESSAGE);
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label="WhatsApp ventas"
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
