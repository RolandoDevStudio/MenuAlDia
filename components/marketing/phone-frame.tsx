"use client";

import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  urlLabel: string;
  children: React.ReactNode;
  className?: string;
  screenClassName?: string;
};

/**
 * 2D frontal smartphone chrome sized to native mobile PWA viewport (375×812).
 */
export function PhoneFrame({
  urlLabel,
  children,
  className,
  screenClassName,
}: Props) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[375px] shrink-0 transition-transform duration-200 md:motion-safe:hover:-translate-y-1",
        className,
      )}
    >
      <div
        className={cn(
          "relative aspect-[375/812] w-full overflow-hidden rounded-[2.5rem] border-[10px] border-slate-900 bg-slate-900",
          "shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)]",
        )}
      >
        <div className="absolute inset-x-0 top-0 z-20 bg-slate-900/95">
          <div className="flex justify-center pb-1 pt-2">
            <div className="h-5 w-24 rounded-full bg-black" aria-hidden />
          </div>
          <div className="flex h-9 items-center gap-1.5 px-3 pb-2 pt-1">
            <Lock className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
            <p className="min-w-0 flex-1 truncate font-mono text-[11px] leading-none text-slate-300">
              {urlLabel}
            </p>
          </div>
        </div>
        <div
          className={cn(
            "absolute inset-0 overflow-hidden bg-white pt-[3.75rem]",
            screenClassName,
          )}
        >
          <div className="relative h-full w-full">{children}</div>
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pb-2 pt-6"
          aria-hidden
        >
          <div className="h-1 w-16 rounded-full bg-slate-700/90" />
        </div>
      </div>
    </div>
  );
}
