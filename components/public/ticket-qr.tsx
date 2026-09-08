"use client";

import { useEffect, useRef } from "react";
import QRCodeStyling from "qr-code-styling";

export function TicketQr({
  url,
  size = 168,
}: {
  url: string;
  size?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !url) return;
    host.replaceChildren();
    const qr = new QRCodeStyling({
      width: size,
      height: size,
      type: "svg",
      data: url,
      margin: 4,
      qrOptions: { errorCorrectionLevel: "M" },
      dotsOptions: { color: "#111111", type: "square" },
      backgroundOptions: { color: "#ffffff" },
    });
    qr.append(host);
    return () => {
      host.replaceChildren();
    };
  }, [url, size]);

  return (
    <div
      ref={hostRef}
      className="mx-auto inline-flex items-center justify-center bg-white"
      aria-hidden
    />
  );
}
