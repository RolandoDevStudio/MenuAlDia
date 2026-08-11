import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 20% 0%, #f0d4b8 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 90% 20%, #d4e8dc 0%, transparent 50%), linear-gradient(180deg, #faf6f1 0%, #f3e8dc 100%)",
        }}
      />
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
        <p
          className="font-[family-name:var(--font-display)] text-5xl tracking-wide text-brand sm:text-7xl motion-safe:animate-[rise_0.7s_ease-out]"
          style={{
            animationFillMode: "both",
          }}
        >
          Menú al Día
        </p>
        <p
          className="mt-4 max-w-md text-lg text-muted motion-safe:animate-[rise_0.7s_ease-out]"
          style={{ animationDelay: "80ms", animationFillMode: "both" }}
        >
          Actualiza el menú del día en menos de 2 minutos, genera un flyer para
          WhatsApp y recibe pedidos sin comisiones.
        </p>
        <div
          className="mt-8 flex flex-col items-start gap-3 motion-safe:animate-[rise_0.7s_ease-out]"
          style={{ animationDelay: "160ms", animationFillMode: "both" }}
        >
          <Link
            href="/demo"
            className="rounded-lg bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
          >
            Ver menú demo
          </Link>
          <Link
            href="/admin/login"
            className="text-sm font-medium text-muted underline-offset-4 hover:text-brand-dark hover:underline"
          >
            Entrar al admin
          </Link>
        </div>
      </div>
    </main>
  );
}
