import Image from "next/image";
import type { LandingShowcaseLogo } from "@/lib/landing-content";
import { Reveal } from "@/components/marketing/reveal";

type Props = {
  logos: LandingShowcaseLogo[];
};

function LogoLink({ logo }: { logo: LandingShowcaseLogo }) {
  return (
    <a
      href={`/${logo.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Ver menú de ${logo.name}`}
      className="group flex h-16 w-36 shrink-0 items-center justify-center rounded-xl border border-black/5 bg-white px-4 py-2 shadow-sm transition hover:border-brand/30 hover:shadow-md"
    >
      <Image
        src={logo.logoUrl}
        alt={logo.name}
        width={120}
        height={48}
        className="max-h-10 w-auto object-contain opacity-80 grayscale transition group-hover:opacity-100 group-hover:grayscale-0"
        unoptimized
      />
    </a>
  );
}

export function LogoShowcase({ logos }: Props) {
  if (!logos.length) return null;

  const loop = [...logos, ...logos];

  return (
    <Reveal className="space-y-5">
      <div className="text-center sm:text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">
          Confianza
        </p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-wide text-brand-dark sm:text-4xl">
          Negocios que ya usan Menú al Día
        </h2>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Toca un logo y abre su menú público en vivo.
        </p>
      </div>

      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-white to-transparent sm:w-12" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-white to-transparent sm:w-12" />

        <div className="flex w-max gap-3 motion-safe:animate-[logo-marquee_32s_linear_infinite] motion-reduce:flex-wrap motion-reduce:w-full motion-reduce:justify-center motion-reduce:animate-none">
          {(logos.length >= 4 ? loop : logos).map((logo, i) => (
            <LogoLink key={`${logo.restaurantId}-${i}`} logo={logo} />
          ))}
        </div>
      </div>
    </Reveal>
  );
}
