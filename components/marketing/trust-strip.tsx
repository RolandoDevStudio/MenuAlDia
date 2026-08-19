import type { LandingTestimonial } from "@/lib/landing-content";
import { Reveal } from "@/components/marketing/reveal";

const BULLETS = [
  "Pedidos por WhatsApp sin comisiones de intermediarios",
  "Menú listo el mismo día — sin app nueva para tus clientes",
  "Hecho para fondas, locales y tiendas en México",
] as const;

type Props = {
  testimonials?: LandingTestimonial[];
};

export function TrustStrip({ testimonials = [] }: Props) {
  const hasQuotes = testimonials.length > 0;

  return (
    <Reveal className="rounded-2xl border border-brand/15 bg-white/90 px-5 py-7 shadow-sm sm:px-8">
      {hasQuotes ? (
        <div className="space-y-6">
          {testimonials.map((t, i) => {
            const initial =
              t.initial?.slice(0, 1).toUpperCase() ||
              t.author.trim().charAt(0).toUpperCase() ||
              "·";
            return (
              <div
                key={`${t.author}-${i}`}
                className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6"
              >
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-white shadow-md"
                  aria-hidden
                >
                  {initial}
                </div>
                <div className="min-w-0">
                  <blockquote className="font-[family-name:var(--font-display)] text-3xl leading-snug text-brand-dark sm:text-4xl">
                    <span className="text-brand/40" aria-hidden>
                      “
                    </span>
                    {t.quote}
                    <span className="text-brand/40" aria-hidden>
                      ”
                    </span>
                  </blockquote>
                  <p className="mt-3 text-sm text-muted">
                    — {t.author}
                    {t.role ? ` · ${t.role}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
          <ul className="space-y-2 text-sm text-foreground">
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
      ) : (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">
            Confianza
          </p>
          <h3 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-brand-dark sm:text-4xl">
            Así lo usan locales en México
          </h3>
          <p className="mt-2 max-w-lg text-sm text-muted">
            Menú digital, flyer para WhatsApp y pedidos sin intermediarios —
            pensado para el ritmo de un negocio local.
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
      )}
    </Reveal>
  );
}
