"use client";

import { useId } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { mark: 28, text: "text-base" },
  md: { mark: 40, text: "text-2xl" },
  lg: { mark: 64, text: "text-4xl sm:text-5xl" },
  xl: { mark: 96, text: "text-5xl sm:text-6xl" },
} as const;

function MenuMark({
  className,
  size,
}: {
  className?: string;
  size: number;
}) {
  const uid = useId().replace(/:/g, "");
  const sun = `mad-sun-${uid}`;
  const cover = `mad-cover-${uid}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="40 40 280 290"
      width={size}
      height={Math.round(size * (290 / 280))}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={sun} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#EA580C" />
          <stop offset="100%" stopColor="#FBBF24" />
        </linearGradient>
        <linearGradient id={cover} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EA580C" />
          <stop offset="100%" stopColor="#C2410C" />
        </linearGradient>
      </defs>
      <path d="M 200 130 A 56 56 0 0 1 312 130 Z" fill={`url(#${sun})`} />
      <g stroke="#F59E0B" strokeWidth="5" strokeLinecap="round">
        <line x1="256" y1="58" x2="256" y2="44" />
        <line x1="220" y1="68" x2="212" y2="56" />
        <line x1="292" y1="68" x2="300" y2="56" />
        <line x1="188" y1="92" x2="176" y2="84" />
        <line x1="324" y1="92" x2="336" y2="84" />
        <line x1="168" y1="124" x2="154" y2="122" />
        <line x1="344" y1="124" x2="358" y2="122" />
      </g>
      <path
        d="M 256 142 L 366 102 C 370 100, 376 103, 376 108 L 376 272 C 376 277, 370 281, 366 283 L 256 322 Z"
        fill="#FFFDF9"
        stroke="#1C1917"
        strokeWidth="8"
        strokeLinejoin="round"
      />
      <rect x="276" y="148" width="36" height="46" rx="4" fill="#EA580C" />
      <g stroke="#1C1917" strokeWidth="5" strokeLinecap="round">
        <line x1="322" y1="156" x2="356" y2="156" />
        <line x1="322" y1="170" x2="356" y2="170" />
        <line x1="322" y1="184" x2="346" y2="184" />
        <line x1="276" y1="212" x2="356" y2="212" />
        <line x1="276" y1="228" x2="356" y2="228" />
        <line x1="276" y1="244" x2="356" y2="244" />
        <line x1="276" y1="260" x2="336" y2="260" />
      </g>
      <path
        d="M 256 142 L 146 102 C 142 100, 136 103, 136 108 L 136 272 C 136 277, 142 281, 146 283 L 256 322 Z"
        fill={`url(#${cover})`}
        stroke="#1C1917"
        strokeWidth="8"
        strokeLinejoin="round"
      />
      <circle
        cx="196"
        cy="208"
        r="18"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="4"
      />
      <g stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round">
        <line x1="196" y1="182" x2="196" y2="186" />
        <line x1="196" y1="230" x2="196" y2="234" />
        <line x1="170" y1="208" x2="174" y2="208" />
        <line x1="222" y1="208" x2="218" y2="208" />
        <line x1="178" y1="190" x2="181" y2="193" />
        <line x1="214" y1="226" x2="211" y2="223" />
        <line x1="178" y1="226" x2="181" y2="223" />
        <line x1="214" y1="190" x2="211" y2="193" />
      </g>
      <line
        x1="256"
        y1="142"
        x2="256"
        y2="322"
        stroke="#1C1917"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Props = {
  variant?: "mark" | "lockup";
  size?: keyof typeof SIZES;
  href?: string | null;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({
  variant = "lockup",
  size = "md",
  href = "/",
  className,
}: Props) {
  const s = SIZES[size];

  const wordmark = (
    <span
      className={cn(
        "font-extrabold tracking-tight leading-none text-foreground",
        s.text,
      )}
      style={{ fontFamily: "var(--font-brand), var(--font-sans), system-ui" }}
    >
      Menu<span className="text-brand">Al</span>Día
    </span>
  );

  const inner =
    variant === "mark" ? (
      <span className="inline-flex items-center" aria-label="Menú al Día">
        <MenuMark size={s.mark} />
      </span>
    ) : (
      <span
        className="inline-flex items-center gap-2.5"
        aria-label="Menú al Día"
      >
        <MenuMark size={s.mark} />
        {wordmark}
      </span>
    );

  if (href === null) {
    return <span className={cn("inline-flex", className)}>{inner}</span>;
  }

  return (
    <Link href={href} className={cn("inline-flex", className)}>
      {inner}
    </Link>
  );
}

export function PoweredByMenuAlDia({ className }: { className?: string }) {
  return (
    <a
      href="https://menualdia.app"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] text-muted hover:text-brand",
        className,
      )}
    >
      <MenuMark size={18} className="opacity-90" />
      <span>
        Hecho con{" "}
        <span className="font-semibold text-foreground">Menú al Día</span>
      </span>
    </a>
  );
}
