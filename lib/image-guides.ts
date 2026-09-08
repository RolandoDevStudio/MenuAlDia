/** Recommended sizes and downloadable proportion guides for admin uploads. */

export type ImageGuideId = "og" | "banner" | "logo" | "product" | "background";

export type ImageGuide = {
  id: ImageGuideId;
  width: number;
  height: number;
  filename: string;
  hint: string;
  safeNote: string;
  frameClass: string;
  objectClass: string;
};

export const OG_SHARE_SIZE = { width: 1080, height: 1350 } as const;

export const IMAGE_GUIDES: Record<ImageGuideId, ImageGuide> = {
  og: {
    id: "og",
    width: 1080,
    height: 1350,
    filename: "guia-whatsapp-1080x1350.png",
    hint: "1080×1350 px, vertical 4:5 (publicación de Instagram, no story). En el chat de WhatsApp se ve más alta que una foto apaisada. Título y platillo al centro; no uses 9:16, se recorta arriba y abajo.",
    safeNote: "Zona segura — flyer al centro",
    frameClass: "mx-auto aspect-[4/5] w-full max-w-[220px]",
    objectClass: "h-full w-full object-cover",
  },
  banner: {
    id: "banner",
    width: 1200,
    height: 320,
    filename: "guia-banner-menu-1200x320.png",
    hint: "1200×320 px, paisaje muy ancho. Solo se ve arriba del menú público, no en WhatsApp. Evita texto arriba y abajo: en el teléfono se recorta.",
    safeNote: "Zona segura — poco texto, al centro",
    frameClass: "aspect-[15/4] w-full",
    objectClass: "h-full w-full object-cover",
  },
  logo: {
    id: "logo",
    width: 800,
    height: 800,
    filename: "guia-logo-800x800.png",
    hint: "800×800 px, cuadrado. PNG o foto con fondo simple. No es el preview de WhatsApp.",
    safeNote: "Logo al centro, con margen",
    frameClass: "mx-auto aspect-square h-36 w-36",
    objectClass: "h-full w-full object-contain bg-white",
  },
  product: {
    id: "product",
    width: 800,
    height: 800,
    filename: "guia-foto-800x800.png",
    hint: "800×800 px, cuadrada. El platillo o producto al centro. Al subirla se comprime a WebP (~800 px).",
    safeNote: "Sujeto al centro",
    frameClass: "aspect-square w-full max-w-xs",
    objectClass: "h-full w-full object-cover",
  },
  background: {
    id: "background",
    width: 1920,
    height: 1200,
    filename: "guia-fondo-1920x1200.png",
    hint: "1920×1200 px (16:10). Cubre toda la ventana; en Ajustes eliges el recuadro de escritorio y el del celular. Activa “Usar imagen de fondo” y guarda.",
    safeNote: "16:10 — ventana de escritorio",
    frameClass: "aspect-[16/10] w-full",
    objectClass: "h-full w-full object-cover",
  },
};

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

/** Client-only: PNG with the exact pixel size for Canva / external editors. */
export function downloadImageGuide(id: ImageGuideId): void {
  const g = IMAGE_GUIDES[id];
  const canvas = document.createElement("canvas");
  canvas.width = g.width;
  canvas.height = g.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const unit = Math.min(g.width, g.height);
  ctx.fillStyle = "#f4efe8";
  ctx.fillRect(0, 0, g.width, g.height);

  ctx.strokeStyle = "#c45c26";
  ctx.lineWidth = Math.max(4, Math.round(unit * 0.012));
  const pad = Math.round(unit * 0.03);

  if (id === "background") {
    ctx.fillStyle = "#ebe4dc";
    ctx.fillRect(0, 0, g.width, g.height);
    const colW = Math.round(g.width * (512 / 1920));
    const colX = Math.round((g.width - colW) / 2);
    ctx.fillStyle = "rgba(196, 92, 38, 0.12)";
    ctx.fillRect(colX, 0, colW, g.height);
    ctx.setLineDash([18, 12]);
    ctx.strokeStyle = "#c45c26";
    ctx.lineWidth = 4;
    ctx.strokeRect(colX, pad, colW, g.height - pad * 2);
    ctx.setLineDash([]);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#1c1410";
    ctx.font = "600 42px system-ui, sans-serif";
    ctx.fillText("1920 × 1200 px (16:10)", g.width / 2, g.height / 2 - 48);
    ctx.fillStyle = "#6b5e54";
    ctx.font = "28px system-ui, sans-serif";
    ctx.fillText("Cubre la ventana; el recorte se elige en Ajustes", g.width / 2, g.height / 2 + 8);
    ctx.font = "24px system-ui, sans-serif";
    ctx.fillText("Computadora y celular por separado", g.width / 2, g.height / 2 + 52);
    ctx.fillStyle = "#8a7a70";
    ctx.font = "22px system-ui, sans-serif";
    ctx.fillText(
      "Guía Menú al Día — úsala de fondo en Canva. No subas este archivo.",
      g.width / 2,
      g.height - 36,
    );
  } else {
  ctx.strokeRect(pad, pad, g.width - pad * 2, g.height - pad * 2);

  const insetX = Math.round(g.width * 0.08);
  const insetY = Math.round(g.height * 0.14);
  ctx.setLineDash([Math.round(unit * 0.04), Math.round(unit * 0.025)]);
  ctx.strokeStyle = "rgba(196, 92, 38, 0.55)";
  ctx.lineWidth = Math.max(2, Math.round(unit * 0.006));
  ctx.strokeRect(insetX, insetY, g.width - insetX * 2, g.height - insetY * 2);
  ctx.setLineDash([]);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1c1410";
  const sizeFont = Math.max(18, Math.round(unit * 0.09));
  ctx.font = `600 ${sizeFont}px system-ui, sans-serif`;
  ctx.fillText(`${g.width} × ${g.height} px`, g.width / 2, g.height / 2 - sizeFont * 0.7);

  ctx.fillStyle = "#6b5e54";
  const noteFont = Math.max(14, Math.round(unit * 0.045));
  ctx.font = `${noteFont}px system-ui, sans-serif`;
  wrapText(
    ctx,
    g.safeNote,
    g.width / 2,
    g.height / 2 + sizeFont * 0.5,
    g.width - insetX * 2,
    noteFont * 1.35,
  );

  ctx.fillStyle = "#8a7a70";
  const footFont = Math.max(12, Math.round(unit * 0.035));
  ctx.font = `${footFont}px system-ui, sans-serif`;
  ctx.fillText(
    "Guía Menú al Día — úsala de fondo en Canva. No subas este archivo.",
    g.width / 2,
    g.height - pad * 2 - footFont,
  );
  }

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = g.filename;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
