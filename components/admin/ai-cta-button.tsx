"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Hide the sparkles icon */
  hideIcon?: boolean;
  /** primary = filled shimmer; soft = outline glow for secondary AI actions */
  tone?: "primary" | "soft";
};

/**
 * Highlighted CTA for Admin AI features — shimmer + soft glow so IA stands out.
 */
export function AiCtaButton({
  className,
  children,
  hideIcon,
  tone = "primary",
  type = "button",
  ...props
}: Props) {
  const primary = tone === "primary";
  return (
    <button
      type={type}
      className={cn(
        "group relative inline-flex min-h-10 items-center justify-center gap-2 overflow-hidden",
        "rounded-xl px-3.5 py-2 text-sm font-semibold",
        "shadow-md transition-[transform,box-shadow] duration-200",
        "hover:-translate-y-0.5 hover:shadow-lg",
        "active:translate-y-0 active:shadow-md",
        "disabled:pointer-events-none disabled:opacity-55",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
        primary ? "ai-cta text-white" : "ai-cta-soft border border-brand/25 text-brand-dark",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "ai-cta-shine pointer-events-none absolute inset-0",
          !primary && "opacity-40",
        )}
        aria-hidden
      />
      {!hideIcon ? (
        <Sparkles
          className={cn(
            "relative h-4 w-4 shrink-0 motion-safe:group-hover:animate-[ai-sparkle_1.2s_ease-in-out_infinite]",
            !primary && "text-brand",
          )}
          aria-hidden
        />
      ) : null}
      <span className="relative">{children}</span>
    </button>
  );
}
