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
        "mx-auto w-full max-w-[280px] shrink-0 transition-transform duration-200 motion-safe:hover:-translate-y-1 motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-[2.25rem] border-[10px] border-slate-900 bg-slate-900",
          "shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)]",
        )}
      >
        <div className="flex justify-center bg-slate-900 pb-1.5 pt-2">
          <div className="h-5 w-24 rounded-full bg-black" aria-hidden />
        </div>
        <div className="flex items-center gap-1.5 border-b border-black/20 bg-slate-800 px-3 py-1.5">
          <Lock className="h-3 w-3 shrink-0 text-emerald-400" aria-hidden />
          <p className="min-w-0 flex-1 truncate font-mono text-[10px] leading-none text-slate-300">
            {urlLabel}
          </p>
        </div>
        <div
          className={cn(
            "relative aspect-[9/19.5] w-full overflow-hidden bg-white",
            screenClassName,
          )}
        >
          {children}
        </div>
        <div className="flex justify-center bg-slate-900 py-2" aria-hidden>
          <div className="h-1 w-16 rounded-full bg-slate-700" />
        </div>
      </div>
    </div>
  );
}
