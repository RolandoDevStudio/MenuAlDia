"use client";

import { cn } from "@/lib/utils";

type Props = {
  urlLabel: string;
  children: React.ReactNode;
  className?: string;
  screenClassName?: string;
  /**
   * Scale width + height to the window (keeps 375×812). For fullscreen demo modal.
   */
  fitContain?: boolean;
};

/** Header + padding + URL caption ≈ reserve this from the viewport. */
const MODAL_CHROME = "5.75rem";
const MODAL_GUTTER = "1rem";

/**
 * 2D frontal smartphone chrome sized to native mobile PWA viewport (375×812).
 * Single device bezel only — no nested browser chrome (that read as a 2nd mockup).
 */
export function PhoneFrame({
  urlLabel,
  children,
  className,
  screenClassName,
  fitContain = false,
}: Props) {
  const containSize = fitContain
    ? {
        // Whichever is tighter wins: window width or window height
        width: `min(calc(100dvw - ${MODAL_GUTTER}), calc((100dvh - ${MODAL_CHROME}) * 375 / 812))`,
        height: `min(calc(100dvh - ${MODAL_CHROME}), calc((100dvw - ${MODAL_GUTTER}) * 812 / 375))`,
        aspectRatio: "375 / 812",
        maxWidth: "100%",
      }
    : undefined;

  return (
    <div
      className={cn(
        fitContain
          ? "mx-auto flex h-full min-h-0 w-full flex-col items-center justify-center"
          : "mx-auto w-full max-w-[375px] shrink-0 transition-transform duration-200 md:motion-safe:hover:-translate-y-1",
        className,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-[2.5rem] border-[10px] border-slate-900 bg-slate-900",
          "shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)]",
          !fitContain && "aspect-[375/812] w-full",
        )}
        style={containSize}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-3"
          aria-hidden
        >
          <div className="h-5 w-24 rounded-full bg-black" />
        </div>
        <div
          className={cn(
            "absolute inset-0 overflow-hidden bg-white",
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
      <p
        className={cn(
          "mt-2 truncate text-center font-mono text-[11px] text-muted",
          fitContain && "max-w-full shrink-0 px-1",
        )}
        style={
          fitContain
            ? {
                width: `min(calc(100dvw - ${MODAL_GUTTER}), calc((100dvh - ${MODAL_CHROME}) * 375 / 812))`,
              }
            : undefined
        }
      >
        {urlLabel}
      </p>
    </div>
  );
}
