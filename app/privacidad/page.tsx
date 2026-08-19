import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";

export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <BrandLogo variant="lockup" size="sm" href="/" />
      <h1 className="mt-8 font-[family-name:var(--font-display)] text-4xl text-brand-dark">
        Aviso de privacidad
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Menú al Día (el &quot;Servicio&quot;) trata datos de contacto y de
        operación del negocio (nombre, WhatsApp, dirección, pedidos) para
        prestar la plataforma SaaS. No vendemos datos personales a terceros.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Los pedidos enviados por WhatsApp quedan bajo el control del negocio
        suscriptor. Puedes solicitar acceso, rectificación o baja escribiendo a
        nuestro WhatsApp de soporte.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Este aviso es informativo y se alineará a la LFPDPPP conforme el
        producto madure. Última actualización: agosto 2026.
      </p>
      <Link href="/" className="mt-8 inline-block text-sm font-semibold text-brand">
        Volver al inicio
      </Link>
    </main>
  );
}
