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
 * 2D frontal smartphone chrome (Tailwind only).
 * Children fill the screen area below the address bar.
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
        "mx-auto w-full max-w-[240px] shrink-0 transition-transform duration-200 motion-safe:hover:-translate-y-1 motion-reduce:hover:translate-y-0 sm:max-w-[250px]",
        className,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-[2rem] border-[8px] border-slate-900 bg-slate-900",
          "shadow-[0_20px_40px_-12px_rgba(0,0,0,0.3)]",
        )}
      >
        <div className="flex justify-center bg-slate-900 pb-1 pt-1.5">
          <div className="h-4 w-20 rounded-full bg-black" aria-hidden />
        </div>
        <div className="flex items-center gap-1.5 border-b border-black/20 bg-slate-800 px-2.5 py-1">
          <Lock className="h-3 w-3 shrink-0 text-emerald-400" aria-hidden />
          <p className="min-w-0 flex-1 truncate font-mono text-[9px] leading-none text-slate-300">
            {urlLabel}
          </p>
        </div>
        <div
          className={cn(
            "relative aspect-[9/14] max-h-[min(22rem,50dvh)] w-full overflow-hidden bg-white",
            screenClassName,
          )}
        >
          {children}
        </div>
        <div className="flex justify-center bg-slate-900 py-1.5" aria-hidden>
          <div className="h-1 w-14 rounded-full bg-slate-700" />
        </div>
      </div>
    </div>
  );
}
