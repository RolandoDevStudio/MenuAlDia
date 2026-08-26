"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2 } from "lucide-react";
import { StorageImage } from "@/components/ui/storage-image";
import { cn } from "@/lib/utils";

const FADE_MS = 200;

export function ZoomableMenuPhoto({
  src,
  alt,
  className,
  sizes = "(max-width: 640px) 100vw, 512px",
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const requestClose = useCallback(() => {
    if (closing) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setOpen(false);
      setClosing(false);
      return;
    }
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, FADE_MS);
  }, [closing]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      requestClose();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, requestClose]);

  return (
    <>
      <button
        type="button"
        className={cn("relative block h-full w-full overflow-hidden", className)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="Ver foto grande"
      >
        <StorageImage
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
        />
        <span className="pointer-events-none absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
          <Maximize2 className="h-4 w-4" aria-hidden />
        </span>
      </button>
      {mounted && open
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Foto ampliada"
              className={cn(
                "fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4",
                closing ? "menu-overlay-out" : "menu-overlay-in",
              )}
              onClick={requestClose}
            >
              <div
                className="max-h-[90dvh] max-w-[min(90vw,48rem)]"
                onClick={(e) => e.stopPropagation()}
              >
                <StorageImage
                  src={src}
                  alt={alt}
                  width={1600}
                  height={1600}
                  sizes="90vw"
                  className="h-auto max-h-[90dvh] w-auto object-contain"
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
