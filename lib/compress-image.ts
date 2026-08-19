/**
 * Client-side image compression → WebP before Supabase Storage upload.
 * Caps: product 600px, banner/combo 1200px; target < 200KB.
 */

export type CompressKind = "product" | "banner";

const MAX_EDGE: Record<CompressKind, number> = {
  product: 600,
  banner: 1200,
};

const TARGET_BYTES = 200 * 1024;

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

async function canvasToWebp(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("No se pudo comprimir a WebP"));
        else resolve(blob);
      },
      "image/webp",
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

  let quality = 0.82;
  let blob = await canvasToWebp(canvas, quality);
  while (blob.size > TARGET_BYTES && quality > 0.45) {
    quality -= 0.08;
    blob = await canvasToWebp(canvas, quality);
  }

  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.webp`, { type: "image/webp" });
}
