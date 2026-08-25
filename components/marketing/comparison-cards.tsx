"use client";

import type { LucideIcon } from "lucide-react";
import {
  HandHeart,
  MapPin,
  Megaphone,
  QrCode,
  RefreshCw,
  UserX,
  Users,
  Zap,
} from "lucide-react";
import {
  DEFAULT_COMPARISON_ROWS,
  type ComparisonRowId,
  type LandingComparisonImages,
} from "@/lib/landing-content";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

type Props = {
  images?: LandingComparisonImages;
};

const ROW_ICONS: Record<
  ComparisonRowId,
  { problem: LucideIcon; solution: LucideIcon }
> = {
  control: { problem: RefreshCw, solution: Zap },
  attraction: { problem: QrCode, solution: Megaphone },
  retention: { problem: UserX, solution: Users },
  value: { problem: HandHeart, solution: MapPin },
};

export function ComparisonCards({ images = {} }: Props) {
  return (
    <div className="mt-8 space-y-4">
      <div className="hidden items-center gap-3 px-1 sm:flex">
        <p className="flex-1 text-center text-xs font-semibold uppercase tracking-wide text-muted">
          Pago único / menú común
        </p>
        <span className="w-8" aria-hidden />
        <p className="flex-1 text-center text-xs font-semibold uppercase tracking-wide text-accent">
          Menú al Día
        </p>
      </div>

      <ul className="space-y-4">
        {DEFAULT_COMPARISON_ROWS.map((row, i) => {
          const problemSrc =
            images[`${row.id}_problem`] ?? row.defaultProblemArt;
          const solutionSrc =
            images[`${row.id}_solution`] ?? row.defaultSolutionArt;
          const icons = ROW_ICONS[row.id];

          return (
            <Reveal key={row.id} as="li" delayMs={i * 70}>
              <article
                className={cn(
                  "overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm",
                  "grid gap-0 sm:grid-cols-[1fr_auto_1fr]",
                )}
              >
                <Half
                  tone="problem"
                  title={row.problemTitle}
                  body={row.problemBody}
                  src={problemSrc}
                  Icon={icons.problem}
                  mobileLabel="El problema"
                />
                <div
                  className="flex items-center justify-center bg-gradient-to-b from-transparent via-black/[0.03] to-transparent px-2 py-1 sm:flex-col sm:px-0 sm:py-6"
                  aria-hidden
                >
                  <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-dark sm:rotate-0">
                    vs
                  </span>
                </div>
                <Half
                  tone="solution"
                  title={row.solutionTitle}
                  body={row.solutionBody}
                  src={solutionSrc}
                  Icon={icons.solution}
                  mobileLabel="Menú al Día"
                />
              </article>
            </Reveal>
          );
        })}
      </ul>

      <p className="text-center text-sm font-medium text-brand-dark">
        Ayudamos a que tus clientes vuelvan cada semana y aumentes tus ventas.
      </p>
    </div>
  );
}

function Half({
  tone,
  title,
  body,
  src,
  Icon,
  mobileLabel,
}: {
  tone: "problem" | "solution";
  title: string;
  body: string;
  src: string;
  Icon: LucideIcon;
  mobileLabel: string;
}) {
  const isSolution = tone === "solution";
  return (
    <div
      className={cn(
        "flex flex-col p-3 sm:p-4",
        isSolution ? "bg-accent/[0.06]" : "bg-[#f3f0ec]/80",
      )}
    >
      <p
        className={cn(
          "mb-2 text-[10px] font-semibold uppercase tracking-wide sm:hidden",
          isSolution ? "text-accent" : "text-muted",
        )}
      >
        {mobileLabel}
      </p>

      {/* Mobile: compact Lucide mark */}
      <div
        className={cn(
          "mb-2 flex h-10 w-10 items-center justify-center rounded-xl sm:hidden",
          isSolution ? "bg-accent/15 text-accent" : "bg-black/5 text-muted",
        )}
        aria-hidden
      >
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </div>

      {/* Desktop / tablet: full art */}
      <div
        className={cn(
          "relative hidden aspect-[8/5] w-full overflow-hidden rounded-xl sm:block",
          isSolution ? "ring-1 ring-accent/20" : "ring-1 ring-black/5",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>

      <h3
        className={cn(
          "font-[family-name:var(--font-display)] text-lg tracking-wide sm:mt-3",
          isSolution ? "text-accent" : "text-foreground",
        )}
      >
        {title}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
