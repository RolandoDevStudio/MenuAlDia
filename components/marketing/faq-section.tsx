"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { LandingFaqItem } from "@/lib/landing-content";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

type Props = {
  items: LandingFaqItem[];
};

export function FaqSection({ items }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (items.length === 0) return null;

  return (
    <div>
      <Reveal>
        <h2 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-brand-dark sm:text-5xl">
          Preguntas frecuentes
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted">
          Lo esencial antes de activar tu menú.
        </p>
      </Reveal>
      <ul className="mt-8 space-y-2">
        {items.map((item, i) => {
          const open = openIndex === i;
          return (
            <Reveal key={`${item.q}-${i}`} as="li" delayMs={i * 60}>
              <div className="rounded-xl border border-black/10 bg-white/90">
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  aria-expanded={open}
                  onClick={() => setOpenIndex(open ? null : i)}
                >
                  <span className="text-sm font-semibold text-foreground">
                    {item.q}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted transition-transform duration-200",
                      open && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
                {open ? (
                  <p className="border-t border-black/5 px-4 py-3 text-sm leading-relaxed text-muted">
                    {item.a}
                  </p>
                ) : null}
              </div>
            </Reveal>
          );
        })}
      </ul>
    </div>
  );
}
