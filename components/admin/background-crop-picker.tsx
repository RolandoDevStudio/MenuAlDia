"use client";

import { useCallback, useRef, useState } from "react";
import { Label } from "@/components/ui/label";

const PHONE_ASPECT = 9 / 16;
/** Typical maximized browser window (wider than 16:10 wallpaper). */
const DESKTOP_ASPECT = 16 / 9;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function coverVisibleFractions(imgAspect: number, viewAspect: number) {
  return {
    w: clamp(viewAspect / imgAspect, 0.08, 1),
    h: clamp(imgAspect / viewAspect, 0.08, 1),
  };
}

function focusFromPointer(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  visW: number,
  visH: number,
): { x: number; y: number } {
  const relX = (clientX - rect.left) / Math.max(1, rect.width);
  const relY = (clientY - rect.top) / Math.max(1, rect.height);
  const x =
    visW >= 0.999
      ? clamp(relX * 100, 0, 100)
      : clamp(((relX - visW / 2) / (1 - visW)) * 100, 0, 100);
  const y =
    visH >= 0.999
      ? clamp(relY * 100, 0, 100)
      : clamp(((relY - visH / 2) / (1 - visH)) * 100, 0, 100);
  return { x, y };
}

type Variant = "mobile" | "desktop";

const VARIANT: Record<
  Variant,
  {
    label: string;
    hint: string;
    previewLabel: string;
    aspect: number;
    previewWidth: string;
    previewFrame: string;
  }
> = {
  mobile: {
    label: "Qué se ve en el celular",
    hint: "Arrastra el recuadro. A la derecha, cómo queda en el teléfono.",
    previewLabel: "Celular",
    aspect: PHONE_ASPECT,
    previewWidth: "w-[5.5rem]",
    previewFrame: "aspect-[9/16]",
  },
  desktop: {
    label: "Qué se ve en la computadora",
    hint: "Arrastra el recuadro. La foto cubre toda la ventana; eliges qué parte se prioriza.",
    previewLabel: "Escritorio",
    aspect: DESKTOP_ASPECT,
    previewWidth: "w-[9.5rem]",
    previewFrame: "aspect-video",
  },
};

type Props = {
  variant: Variant;
  imageUrl: string;
  focusX: number;
  focusY: number;
  onChange: (next: { x: number; y: number }) => void;
};

/** Drag a viewport window over the wallpaper to set cover focus. */
export function BackgroundCropPicker({
  variant,
  imageUrl,
  focusX,
  focusY,
  onChange,
}: Props) {
  const copy = VARIANT[variant];
  const stripRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState({ w: 16, h: 10 });
  const dragging = useRef(false);

  const imgAspect = natural.w / Math.max(1, natural.h);
  const vis = coverVisibleFractions(imgAspect, copy.aspect);
  const leftPct = (focusX / 100) * (1 - vis.w) * 100;
  const topPct = (focusY / 100) * (1 - vis.h) * 100;

  const apply = useCallback(
    (clientX: number, clientY: number) => {
      const el = stripRef.current;
      if (!el) return;
      onChange(
        focusFromPointer(
          clientX,
          clientY,
          el.getBoundingClientRect(),
          vis.w,
          vis.h,
        ),
      );
    },
    [onChange, vis.h, vis.w],
  );

  const cursor =
    vis.w < 0.999 && vis.h < 0.999
      ? "cursor-move"
      : vis.h < 0.999
        ? "cursor-ns-resize"
        : "cursor-ew-resize";

  return (
    <div className="space-y-2">
      <Label>{copy.label}</Label>
      <p className="text-[11px] text-muted">{copy.hint}</p>
      <div className="flex items-start gap-3">
        <div
          ref={stripRef}
          className={`relative min-h-[7.5rem] flex-1 touch-none overflow-hidden rounded-xl bg-black/5 ${cursor}`}
          style={{ aspectRatio: `${natural.w} / ${natural.h}` }}
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            apply(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (!dragging.current) return;
            apply(e.clientX, e.clientY);
          }}
          onPointerUp={() => {
            dragging.current = false;
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-contain"
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setNatural({ w: img.naturalWidth, h: img.naturalHeight });
              }
            }}
          />
          <div
            className="pointer-events-none absolute border-2 border-brand bg-brand/15"
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: `${vis.w * 100}%`,
              height: `${vis.h * 100}%`,
            }}
          >
            <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand shadow" />
          </div>
        </div>
        <div className={`shrink-0 space-y-1 ${copy.previewWidth}`}>
          <div
            className={`w-full overflow-hidden rounded-xl border border-black/10 bg-black/5 shadow-inner ${copy.previewFrame}`}
            style={{
              backgroundImage: `url(${JSON.stringify(imageUrl)})`,
              backgroundSize: "cover",
              backgroundPosition: `${focusX}% ${focusY}%`,
              backgroundRepeat: "no-repeat",
            }}
            aria-hidden
          />
          <p className="text-center text-[10px] text-muted">
            {copy.previewLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
