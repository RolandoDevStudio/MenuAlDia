"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const ACRYLIC_SIZE = { w: 1080, h: 1620 } as const;
export const STICKER_SIZE = { w: 1080, h: 1080 } as const;

export type PrintTemplateKind = "acrylic" | "sticker";

type SheetProps = {
  id: string;
  businessName: string;
  cta: string;
  qrPngUrl: string | null;
  logoUrl: string | null;
  primary: string;
};

export function AcrylicSheet({
  id,
  businessName,
  cta,
  qrPngUrl,
  logoUrl,
  primary,
}: SheetProps) {
  return (
    <div
      id={id}
      className="flex flex-col items-center justify-between bg-[#faf6f1] text-center"
      style={{
        width: ACRYLIC_SIZE.w,
        height: ACRYLIC_SIZE.h,
        padding: 96,
        color: "#1c1410",
      }}
    >
      <div className="flex flex-col items-center gap-6">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            width={160}
            height={160}
            className="h-40 w-40 object-contain"
            crossOrigin="anonymous"
          />
        ) : null}
        <p
          className="font-[family-name:var(--font-display)] leading-tight"
          style={{ fontSize: 72, color: primary }}
        >
          {businessName}
        </p>
        <p className="max-w-[900px] text-balance font-semibold" style={{ fontSize: 40 }}>
          {cta}
        </p>
      </div>
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        {qrPngUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrPngUrl} alt="" width={560} height={560} className="h-[560px] w-[560px]" />
        ) : (
          <div className="h-[560px] w-[560px] bg-black/5" />
        )}
      </div>
      <p className="text-2xl font-medium tracking-wide text-black/45">
        Escanea con la cámara
      </p>
    </div>
  );
}

export function StickerSheet({
  id,
  businessName,
  cta,
  qrPngUrl,
  logoUrl,
  primary,
}: SheetProps) {
  return (
    <div
      id={id}
      className="flex items-center justify-center"
      style={{
        width: STICKER_SIZE.w,
        height: STICKER_SIZE.h,
        background: primary,
      }}
    >
      <div
        className="flex flex-col items-center justify-center text-center text-white"
        style={{ width: 800, height: 800 }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            width={120}
            height={120}
            className="mb-4 h-[120px] w-[120px] object-contain"
            crossOrigin="anonymous"
          />
        ) : (
          <p className="mb-4 font-[family-name:var(--font-display)] text-4xl leading-tight">
            {businessName}
          </p>
        )}
        <div className="rounded-[2.5rem] bg-white p-6">
          {qrPngUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrPngUrl} alt="" width={480} height={480} className="h-[480px] w-[480px]" />
          ) : (
            <div className="h-[480px] w-[480px] bg-black/5" />
          )}
        </div>
        <p className="mt-6 max-w-[720px] text-balance font-semibold" style={{ fontSize: 36 }}>
          {cta}
        </p>
      </div>
    </div>
  );
}

function ScaledPreview({
  width,
  height,
  circular,
  active,
  children,
}: {
  width: number;
  height: number;
  circular?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.22);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / width) || 0.22);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, active]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "overflow-hidden border border-black/10 bg-black/5 p-2",
        circular ? "rounded-full" : "rounded-xl",
      )}
    >
      <div style={{ height: height * scale }} className="relative w-full">
        <div
          className={cn("origin-top-left", circular && "rounded-full overflow-hidden")}
          style={{ width, transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function MarketingPrintPreview({
  kind,
  businessName,
  cta,
  qrPngUrl,
  logoUrl,
  primary,
  active = true,
}: {
  kind: PrintTemplateKind;
  businessName: string;
  cta: string;
  qrPngUrl: string | null;
  logoUrl: string | null;
  primary: string;
  active?: boolean;
}) {
  const sheet =
    kind === "acrylic" ? (
      <AcrylicSheet
        id="kit-print-preview"
        businessName={businessName}
        cta={cta}
        qrPngUrl={qrPngUrl}
        logoUrl={logoUrl}
        primary={primary}
      />
    ) : (
      <StickerSheet
        id="kit-print-preview"
        businessName={businessName}
        cta={cta}
        qrPngUrl={qrPngUrl}
        logoUrl={logoUrl}
        primary={primary}
      />
    );

  const size = kind === "acrylic" ? ACRYLIC_SIZE : STICKER_SIZE;

  return (
    <>
      <div className="pointer-events-none fixed left-[-10000px] top-0" aria-hidden>
        {kind === "acrylic" ? (
          <AcrylicSheet
            id="kit-print-node"
            businessName={businessName}
            cta={cta}
            qrPngUrl={qrPngUrl}
            logoUrl={logoUrl}
            primary={primary}
          />
        ) : (
          <StickerSheet
            id="kit-print-node"
            businessName={businessName}
            cta={cta}
            qrPngUrl={qrPngUrl}
            logoUrl={logoUrl}
            primary={primary}
          />
        )}
      </div>
      <ScaledPreview
        width={size.w}
        height={size.h}
        circular={kind === "sticker"}
        active={active}
      >
        {sheet}
      </ScaledPreview>
    </>
  );
}
