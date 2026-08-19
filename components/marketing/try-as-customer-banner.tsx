"use client";

import { MessageCircle } from "lucide-react";
import { isCanonicalDemoSlug } from "@/lib/canonical-demos";

export function TryAsCustomerBanner({ slug }: { slug: string }) {
  if (!isCanonicalDemoSlug(slug)) return null;

  return (
    <div className="border-b border-brand/20 bg-brand/10 px-4 py-3 text-sm text-foreground">
      <p className="mx-auto flex max-w-3xl gap-2 leading-snug">
        <MessageCircle
          className="mt-0.5 h-4 w-4 shrink-0 text-brand"
          aria-hidden
        />
        <span>
          <strong className="font-semibold">¿Quieres ver cómo funciona?</strong>{" "}
          Agrega un producto al carrito y pulsa{" "}
          <em className="not-italic font-semibold">Enviar por WhatsApp</em>. Así
          arma el cliente el pedido y así le llega el mensaje estructurado al
          WhatsApp del negocio (pruébalo tú mismo como comprador).
        </span>
      </p>
    </div>
  );
}
