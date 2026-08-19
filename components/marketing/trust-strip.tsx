import { Reveal } from "@/components/marketing/reveal";

const BULLETS = [
  "Pedidos por WhatsApp sin comisiones de intermediarios",
  "Menú listo el mismo día — sin app nueva para tus clientes",
  "Hecho para fondas, locales y tiendas en México",
] as const;

export function TrustStrip() {
  return (
    <Reveal className="rounded-2xl border border-black/10 bg-surface/90 px-5 py-6">
      <blockquote className="font-[family-name:var(--font-display)] text-2xl leading-snug text-brand-dark sm:text-3xl">
        “Antes mandaba la lista por WhatsApp una y otra vez. Ahora el cliente
        abre el link, pide y yo solo confirmo.”
      </blockquote>
      <p className="mt-3 text-sm text-muted">
        — Dueña de fonda (ejemplo de uso · testimonio placeholder)
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
    </Reveal>
  );
}
