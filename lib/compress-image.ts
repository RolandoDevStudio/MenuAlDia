/**
 * Client-side image compression → WebP before Supabase Storage upload.
 * Caps: product 800px, banner 1200px, og 1350px, flyer 1080px, scan 1280px JPEG.
 */

export type CompressKind = "product" | "banner" | "og" | "flyer" | "scan";

const MAX_EDGE: Record<CompressKind, number> = {
  product: 800,
  banner: 1200,
  og: 1350,
  flyer: 1080,
  scan: 1280,
};

const TARGET_BYTES = 140 * 1024;
const SCAN_TARGET_BYTES = 400 * 1024;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("No se pudo comprimir la imagen"));
        else resolve(blob);
      },
      type,
      quality,
    );
  });
}

export async function compressImage(
  file: File,
  kind: CompressKind = "product",
): Promise<File> {
  const maxEdge = MAX_EDGE[kind];
  const img = await loadImage(file);
  let { width, height } = img;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.drawImage(img, 0, 0, width, height);

  const base = file.name.replace(/\.[^.]+$/, "") || "image";

  if (kind === "scan") {
    let quality = 0.75;
    let blob = await canvasToBlob(canvas, "image/jpeg", quality);
    while (blob.size > SCAN_TARGET_BYTES && quality > 0.45) {
      quality -= 0.08;
      blob = await canvasToBlob(canvas, "image/jpeg", quality);
    }
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  }

  let quality = 0.8;
  let blob = await canvasToBlob(canvas, "image/webp", quality);
  while (blob.size > TARGET_BYTES && quality > 0.45) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, "image/webp", quality);
  }
  return new File([blob], `${base}.webp`, { type: "image/webp" });
}

/** Crop image blob to target aspect (center crop) via canvas. */
export async function cropImageToAspect(
  source: Blob,
  aspectW: number,
  aspectH: number,
  maxEdge = 1920,
): Promise<File> {
  const img = await loadImage(source);
  const targetAspect = aspectW / aspectH;
  const srcAspect = img.width / Math.max(1, img.height);
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (srcAspect > targetAspect) {
    sw = Math.round(img.height * targetAspect);
    sx = Math.round((img.width - sw) / 2);
  } else if (srcAspect < targetAspect) {
    sh = Math.round(img.width / targetAspect);
    sy = Math.round((img.height - sh) / 2);
  }
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
  const blob = await canvasToBlob(canvas, "image/webp", 0.85);
  return new File([blob], "ai-asset.webp", { type: "image/webp" });
}
