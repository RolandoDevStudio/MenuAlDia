import { z } from "zod";
import { Type, type Schema } from "@google/genai";

/** Enriched product from Gemini catalog scan */
export const catalogScanProductSchema = z.object({
  raw_name: z.string().min(1),
  price: z.number().nonnegative().nullable().optional(),
  category_name: z.string().min(1),
  raw_description: z.string().nullable().optional(),
  ai_suggested_description: z.string().nullable().optional(),
  is_possible_duplicate: z.boolean().optional(),
});

export const catalogScanCategorySchema = z.object({
  nombre: z.string().min(1).optional(),
  productos: z.array(catalogScanProductSchema).default([]),
});

export const catalogScanResultSchema = z.object({
  categorias: z.array(catalogScanCategorySchema).default([]),
  /** Flat list fallback if model ignores categorias nesting */
  productos: z.array(catalogScanProductSchema).optional(),
});

export type CatalogScanProduct = z.infer<typeof catalogScanProductSchema>;
export type CatalogScanResult = z.infer<typeof catalogScanResultSchema>;

const productGeminiProps: Schema = {
  type: Type.OBJECT,
  properties: {
    raw_name: { type: Type.STRING },
    price: { type: Type.NUMBER, nullable: true },
    category_name: { type: Type.STRING },
    raw_description: { type: Type.STRING, nullable: true },
    ai_suggested_description: { type: Type.STRING, nullable: true },
    is_possible_duplicate: { type: Type.BOOLEAN },
  },
  required: ["raw_name", "category_name"],
};

export const catalogScanGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    categorias: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          nombre: { type: Type.STRING },
          productos: {
            type: Type.ARRAY,
            items: productGeminiProps,
          },
        },
        required: ["productos"],
      },
    },
  },
  required: ["categorias"],
};

export const menuIntentSchema = z.object({
  comensales: z.number().int().positive().nullable().optional(),
  presupuesto_min: z.number().nonnegative().nullable().optional(),
  presupuesto_max: z.number().nonnegative().nullable().optional(),
  etiquetas: z.array(z.string()).default([]),
  query: z.string().nullable().optional(),
});

export type MenuIntent = z.infer<typeof menuIntentSchema>;

export const menuIntentGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    comensales: { type: Type.INTEGER, nullable: true },
    presupuesto_min: { type: Type.NUMBER, nullable: true },
    presupuesto_max: { type: Type.NUMBER, nullable: true },
    etiquetas: { type: Type.ARRAY, items: { type: Type.STRING } },
    query: { type: Type.STRING, nullable: true },
  },
  required: ["etiquetas"],
};

export const IMAGE_KIND_ASPECTS = {
  flyer: {
    target: { w: 4, h: 5 },
    native: "3:4",
    label: "Flyer / WhatsApp 4:5",
  },
  flyer_story: {
    target: { w: 9, h: 16 },
    native: "9:16",
    label: "Stories 9:16",
  },
  flyer_square: {
    target: { w: 1, h: 1 },
    native: "1:1",
    label: "Cuadrado 1:1",
  },
  banner: {
    target: { w: 3, h: 1 },
    native: "16:9",
    label: "Banner 3:1",
  },
  background: {
    target: { w: 16, h: 10 },
    native: "16:9",
    label: "Fondo 16:10",
  },
} as const;

export type AiImagePreset = keyof typeof IMAGE_KIND_ASPECTS;
