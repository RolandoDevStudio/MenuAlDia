"use client";

import { useEffect, useRef } from "react";
import QRCodeStyling from "qr-code-styling";

const PREVIEW_SIZE = 280;
const EXPORT_SIZE = 720;
const LOGO_RATIO = 0.22;

export type MarketingQrApi = {
  download: (extension: "png" | "svg") => Promise<void>;
  getPngBlob: (size?: number) => Promise<Blob>;
};

type Props = {
  url: string;
  fileBase: string;
  dotColor: string;
  bgColor: string;
  logoUrl: string | null;
  showLogo: boolean;
  onPngUrl: (objectUrl: string | null) => void;
  onApi: (api: MarketingQrApi) => void;
  onLogoBlocked: () => void;
};

function quietZone(size: number): number {
  return Math.max(12, Math.round(size * 0.04));
}

function qrOptions(params: {
  size: number;
  url: string;
  dotColor: string;
  bgColor: string;
  image: string | undefined;
}) {
  return {
    width: params.size,
    height: params.size,
    type: "svg" as const,
    data: params.url,
    margin: quietZone(params.size),
    qrOptions: { errorCorrectionLevel: "H" as const },
    image: params.image,
    imageOptions: {
      crossOrigin: "anonymous",
      hideBackgroundDots: true,
      imageSize: LOGO_RATIO,
      margin: 4,
    },
    dotsOptions: {
      color: params.dotColor,
      type: "rounded" as const,
    },
    cornersSquareOptions: { color: params.dotColor, type: "extra-rounded" as const },
    cornersDotOptions: { color: params.dotColor, type: "dot" as const },
    backgroundOptions: { color: params.bgColor },
  };
}

function toBlob(raw: Blob | Buffer | null, mime: string): Blob {
  if (!raw) throw new Error("No se pudo generar el QR");
  if (raw instanceof Blob) return raw;
  return new Blob([raw as BlobPart], { type: mime });
}

export function MarketingQrCanvas({
  url,
  fileBase,
  dotColor,
  bgColor,
  logoUrl,
  showLogo,
  onPngUrl,
  onApi,
  onLogoBlocked,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);
  const pngUrlRef = useRef<string | null>(null);
  const blockedRef = useRef(false);
  const onPngUrlRef = useRef(onPngUrl);
  const onApiRef = useRef(onApi);
  const onLogoBlockedRef = useRef(onLogoBlocked);

  useEffect(() => {
    onPngUrlRef.current = onPngUrl;
    onApiRef.current = onApi;
    onLogoBlockedRef.current = onLogoBlocked;
  });

  const image = showLogo && logoUrl ? logoUrl : undefined;

  useEffect(() => {
    if (showLogo) blockedRef.current = false;
  }, [showLogo]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!hostRef.current) return;

      const tryWithImage = image;
      const opts = qrOptions({
        size: PREVIEW_SIZE,
        url,
        dotColor,
        bgColor,
        image: tryWithImage,
      });

      if (!qrRef.current) {
        hostRef.current.innerHTML = "";
        qrRef.current = new QRCodeStyling(opts);
        qrRef.current.append(hostRef.current);
      } else {
        qrRef.current.update(opts);
      }

      async function pngFor(img: string | undefined) {
        const exportQr = new QRCodeStyling(
          qrOptions({
            size: EXPORT_SIZE,
            url,
            dotColor,
            bgColor,
            image: img,
          }),
        );
        return toBlob(await exportQr.getRawData("png"), "image/png");
      }

      try {
        const blob = await pngFor(tryWithImage);
        if (cancelled) return;
        if (pngUrlRef.current) URL.revokeObjectURL(pngUrlRef.current);
        const objectUrl = URL.createObjectURL(blob);
        pngUrlRef.current = objectUrl;
        onPngUrlRef.current(objectUrl);
      } catch {
        if (tryWithImage && !blockedRef.current) {
          blockedRef.current = true;
          onLogoBlockedRef.current();
        } else if (!cancelled) {
          onPngUrlRef.current(null);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [url, dotColor, bgColor, image]);

  useEffect(() => {
    onApiRef.current({
      download: async (extension) => {
        if (!qrRef.current) throw new Error("El QR aún no está listo");
        const size = extension === "png" ? EXPORT_SIZE : PREVIEW_SIZE;
        const exportQr = new QRCodeStyling(
          qrOptions({
            size,
            url,
            dotColor,
            bgColor,
            image,
          }),
        );
        await exportQr.download({ name: fileBase, extension });
      },
      getPngBlob: async (size = EXPORT_SIZE) => {
        const exportQr = new QRCodeStyling(
          qrOptions({
            size,
            url,
            dotColor,
            bgColor,
            image,
          }),
        );
        return toBlob(await exportQr.getRawData("png"), "image/png");
      },
    });
  }, [fileBase, url, dotColor, bgColor, image]);

  useEffect(() => {
    return () => {
      if (pngUrlRef.current) URL.revokeObjectURL(pngUrlRef.current);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="mx-auto flex h-[280px] w-[280px] items-center justify-center overflow-hidden rounded-xl bg-white"
    />
  );
}
