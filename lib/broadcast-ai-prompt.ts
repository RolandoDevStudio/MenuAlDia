export const MAX_BROADCAST_TEMPLATES = 10;

export const ANNOUNCEMENT_TYPES = [
  "menu_dia",
  "promocion",
  "nuevo",
  "recordatorio",
  "evento",
] as const;

export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number];

export const TONES = ["casual", "cercano", "urgente", "formal"] as const;
export type BroadcastTone = (typeof TONES)[number];

export const LENGTHS = ["corto", "medio"] as const;
export type BroadcastLength = (typeof LENGTHS)[number];

export const ANNOUNCEMENT_LABELS: Record<AnnouncementType, string> = {
  menu_dia: "Menú / especiales de hoy",
  promocion: "Promoción o descuento",
  nuevo: "Nuevo platillo / producto",
  recordatorio: "Recordatorio / ya abrimos",
  evento: "Evento / fin de semana",
};

export const TONE_LABELS: Record<BroadcastTone, string> = {
  casual: "Casual",
  cercano: "Cercano",
  urgente: "Urgente",
  formal: "Formal",
};

export function buildBroadcastAiUserPrompt(opts: {
  businessName: string;
  menuUrl: string;
  dailyLabel: string;
  announcementType: AnnouncementType;
  tone: BroadcastTone;
  length: BroadcastLength;
  itemNames: string[];
  packagePrice?: number | null;
  includeEmojis: boolean;
  includeMenuLink: boolean;
  includePrice: boolean;
  includeBoldMarkers: boolean;
  adminNote?: string;
  shareCta?: string;
  variantCount: number;
}): string {
  const lines = [
    `Negocio: ${opts.businessName}`,
    `Tipo de anuncio: ${ANNOUNCEMENT_LABELS[opts.announcementType]} (${opts.announcementType})`,
    `Tono: ${TONE_LABELS[opts.tone]}`,
    `Longitud: ${opts.length === "corto" ? "corto (4–7 líneas)" : "medio (8–12 líneas)"}`,
    `Emojis: ${opts.includeEmojis ? "sí, con moderación" : "no"}`,
    `Incluir enlace al menú: ${opts.includeMenuLink ? `sí → ${opts.menuUrl}` : "no"}`,
    `Etiqueta de especiales: ${opts.dailyLabel}`,
  ];
  if (opts.itemNames.length > 0) {
    lines.push(`Platillos/productos a mencionar: ${opts.itemNames.join(", ")}`);
  } else {
    lines.push("Platillos: (ninguno específico; invita al menú en general)");
  }
  if (
    opts.includePrice &&
    typeof opts.packagePrice === "number" &&
    opts.packagePrice > 0
  ) {
    lines.push(`Precio paquete (MXN): ${opts.packagePrice}`);
  }
  if (opts.shareCta?.trim()) {
    lines.push(`CTA preferido: ${opts.shareCta.trim()}`);
  }
  if (opts.adminNote?.trim()) {
    lines.push(`Nota del admin (incorpórala si encaja): ${opts.adminNote.trim()}`);
  }
  lines.push(
    `Negrita con asteriscos (*texto*): ${opts.includeBoldMarkers ? "sí (estilo WhatsApp)" : "no — texto plano sin asteriscos"}`,
  );
  lines.push(
    `Genera exactamente ${opts.variantCount} variantes distintas de mensaje para WhatsApp (español de México).`,
  );
  return lines.join("\n");
}

export function buildBroadcastSystemPrompt(includeBoldMarkers: boolean): string {
  return [
    "Eres copywriter de WhatsApp para negocios locales en México (fondas, restaurantes, servicios, productos).",
    "Escribes mensajes listos para pegar en listas de difusión o estados.",
    includeBoldMarkers
      ? "Usa *negrita* de WhatsApp (*así*) donde ayude. Sin markdown distinto."
      : "NO uses asteriscos ni *negrita*. Texto plano limpio (sirve también para Messenger u otras apps).",
    "No inventes precios, platillos ni URLs que no te den.",
    "No uses hashtags. Sé concreto y accionable: invita a pedir/ver el menú.",
    "Devuelve solo JSON con campo variants: array de strings.",
  ].join(" ");
}

/** Remove WhatsApp *bold* markers for plain-text apps (Messenger, etc.). */
export function stripWhatsAppBoldMarkers(text: string): string {
  return text.replace(/\*([^*\n]+)\*/g, "$1");
}

export function withOptionalWhatsAppBold(
  text: string,
  includeBoldMarkers: boolean,
): string {
  return includeBoldMarkers ? text : stripWhatsAppBoldMarkers(text);
}

/** Offline fallback when AI is unavailable. */
export function buildFallbackBroadcastVariants(opts: {
  businessName: string;
  menuUrl: string;
  dailyLabel: string;
  announcementType: AnnouncementType;
  itemNames: string[];
  packagePrice?: number | null;
  includeEmojis: boolean;
  includeMenuLink: boolean;
  includePrice: boolean;
  includeBoldMarkers?: boolean;
  shareCta?: string;
}): string[] {
  const e = opts.includeEmojis;
  const bold = opts.includeBoldMarkers !== false;
  const b = (s: string) => (bold ? `*${s}*` : s);
  const names = opts.itemNames.slice(0, 6);
  const priceLine =
    opts.includePrice &&
    typeof opts.packagePrice === "number" &&
    opts.packagePrice > 0
      ? `\n💰 Paquete desde $${opts.packagePrice}`
      : "";
  const items =
    names.length > 0
      ? `\n${names.map((n) => `• ${n}`).join("\n")}${priceLine}`
      : "";
  const cta = opts.shareCta?.trim() || "Mira el menú y pide aquí";
  const link = opts.includeMenuLink ? `\n\n${cta} 👉\n${opts.menuUrl}` : "";
  const name = opts.businessName;

  switch (opts.announcementType) {
    case "promocion":
      return [
        `${e ? "🔥 " : ""}${b(`Promo — ${name}`)}${items}${link}`,
        `${e ? "💸 " : ""}Aprovecha esta promo en ${b(name)}${items}${link}`,
        `${e ? "✨ " : ""}${b(name)}\nPromo especial por tiempo limitado.${items}${link}`,
      ];
    case "nuevo":
      return [
        `${e ? "🆕 " : ""}${b(`Novedad en ${name}`)}${items}${link}`,
        `${e ? "👀 " : ""}Estrenamos en ${b(name)}${items}${link}`,
        `${e ? "✨ " : ""}${b(name)}\nAlgo nuevo para ti.${items}${link}`,
      ];
    case "recordatorio":
      return [
        `${e ? "👋 " : ""}${b(name)} ya está abierto.${items}${link}`,
        `${e ? "⏰ " : ""}Te esperamos hoy en ${b(name)}.${items}${link}`,
        `${e ? "📍 " : ""}${b(name)}\nListos para atenderte.${items}${link}`,
      ];
    case "evento":
      return [
        `${e ? "🎉 " : ""}${b(name)} — especial de fin de semana${items}${link}`,
        `${e ? "📅 " : ""}Este finde en ${b(name)}${items}${link}`,
        `${e ? "✨ " : ""}${b(name)}\nPlan perfecto para el finde.${items}${link}`,
      ];
    case "menu_dia":
    default:
      return [
        `${e ? "✨ " : ""}${b(name)}\n\n📋 ${b(opts.dailyLabel)}${items}${link}`,
        `${e ? "🍽️ " : ""}Hoy en ${b(`${name}:`)}\n${b(opts.dailyLabel)}${items}${link}`,
        `${e ? "📋 " : ""}${b(opts.dailyLabel)} — ${b(name)}${items}${link}`,
      ];
  }
}
