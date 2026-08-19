import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";

export default function TerminosPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <BrandLogo variant="lockup" size="sm" href="/" />
      <h1 className="mt-8 font-[family-name:var(--font-display)] text-4xl text-brand-dark">
        Términos de servicio
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Al usar Menú al Día aceptas una suscripción SaaS para publicar tu menú
        digital y recibir pedidos vía WhatsApp. El Servicio no actúa como
        intermediario de pagos ni de delivery.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Eres responsable del contenido de tu catálogo, precios, cumplimiento
        sanitario/fiscal de tu giro y de la relación con tus clientes. Podemos
        suspender cuentas por abuso, fraude o mora.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Los planes y precios pueden actualizarse con aviso previo. Última
        actualización: agosto 2026.
      </p>
      <Link href="/" className="mt-8 inline-block text-sm font-semibold text-brand">
        Volver al inicio
      </Link>
    </main>
  );
}
