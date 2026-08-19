import { Reveal } from "@/components/marketing/reveal";

const BULLETS = [
  "Pedidos por WhatsApp sin comisiones de intermediarios",
  "Menú listo el mismo día — sin app nueva para tus clientes",
  "Hecho para fondas, locales y tiendas en México",
] as const;

export function TrustStrip() {
  return (
    <Reveal className="rounded-2xl border border-brand/15 bg-white/90 px-5 py-7 shadow-sm sm:px-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-white shadow-md"
          aria-hidden
        >
          L
        </div>
        <div className="min-w-0">
          <blockquote className="font-[family-name:var(--font-display)] text-3xl leading-snug text-brand-dark sm:text-4xl">
            <span className="text-brand/40" aria-hidden>
              “
            </span>
            Antes mandaba la lista por WhatsApp una y otra vez. Ahora el cliente
            abre el link, pide y yo solo confirmo.
            <span className="text-brand/40" aria-hidden>
              ”
            </span>
          </blockquote>
          <p className="mt-3 text-sm text-muted">
            — Dueña de fonda · ejemplo de uso (testimonio placeholder)
          </p>
          <ul className="mt-5 space-y-2 text-sm text-foreground">
            {BULLETS.map((b) => (
              <li key={b} className="flex gap-2">
                <span className="text-brand" aria-hidden>
                  •
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Reveal>
  );
}
