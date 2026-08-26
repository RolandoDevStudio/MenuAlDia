import { z } from "zod";
import { isMxStateCode, normalizeLegacyState } from "@/lib/mx-locations";
import { normalizeMxPhone } from "@/lib/phone";

const optionalHttpUrl = z
  .string()
  .trim()
  .optional()
  .default("")
  .refine(
    (v) => !v || /^https?:\/\//i.test(v),
    "Usa un enlace completo (https://…)",
  );

export const checkoutSchema = z
  .object({
    fulfillment: z.enum(["pickup", "delivery", "dine_in"]).default("delivery"),
    customerName: z.string().min(2, "Escribe tu nombre"),
    phone: z
      .string()
      .min(1, "Escribe tu WhatsApp")
      .transform((v) => normalizeMxPhone(v) ?? "")
      .refine((v) => v.length === 10, "WhatsApp a 10 dígitos"),
    address: z.string().optional().default(""),
    mapsUrl: optionalHttpUrl,
    references: z.string().optional().default(""),
    tableLabel: z.string().optional().default(""),
    paymentMethod: z.enum(["cash", "transfer"]),
    cashAmount: z.coerce.number().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillment === "delivery") {
      if (!data.address || data.address.trim().length < 5) {
        ctx.addIssue({
          code: "custom",
          path: ["address"],
          message: "Escribe la dirección de entrega",
        });
      }
    }
    if (data.paymentMethod === "cash") {
      if (data.cashAmount == null || Number.isNaN(data.cashAmount)) {
        ctx.addIssue({
          code: "custom",
          path: ["cashAmount"],
          message: "Indica con cuánto pagas",
        });
      }
    }
  });

export const dishFormSchema = z.object({
  name: z.string().min(2, "Escribe el nombre del platillo"),
  description: z.string().optional().default(""),
  price: z.coerce.number().min(0, "El precio no puede ser negativo"),
  category_id: z
    .union([z.string().uuid("Categoría inválida"), z.literal(""), z.null()])
    .optional()
    .transform((v) => (!v ? null : v)),
  is_side: z.boolean().default(false),
  is_active: z.boolean().default(true),
  photo_url: z
    .union([
      z.string().url("URL de foto inválida"),
      z.literal(""),
      z.null(),
    ])
    .optional()
    .transform((v) => (!v ? null : v)),
});

export const restaurantSettingsSchema = z.object({
  name: z.string().min(2, "Escribe el nombre del restaurante"),
  slogan: z.string().min(1, "Escribe un eslogan"),
  phone_whatsapp: z
    .string()
    .min(10, "WhatsApp con código de país (ej. 52155…)"),
  address: z.string().optional().default(""),
  maps_url: optionalHttpUrl,
  city: z.string().optional().default(""),
  state: z
    .string()
    .optional()
    .default("")
    .transform((v) => normalizeLegacyState(v) || v.trim().toUpperCase())
    .refine((v) => !v || isMxStateCode(v), "Selecciona un estado válido"),
  schedule_text: z.string().min(1, "Define el horario").optional().default("Horario por confirmar"),
  shipping_cost: z.coerce.number().min(0, "El envío no puede ser negativo"),
  free_shipping: z.boolean(),
  offers_delivery: z.boolean().default(true),
  offers_pickup: z.boolean().default(true),
  offers_dine_in: z.boolean().default(false),
  show_transfer_details: z.boolean().default(false),
  bank_account_holder: z.string().optional().default(""),
  bank_name: z.string().optional().default(""),
  bank_clabe: z
    .string()
    .optional()
    .default("")
    .transform((v) => v.replace(/\D/g, "")),
  logo_url: z
    .string()
    .url("URL de logo inválida")
    .nullable()
    .optional()
    .or(z.literal("")),
  instagram_url: optionalHttpUrl,
  facebook_url: optionalHttpUrl,
  tiktok_url: optionalHttpUrl,
}).refine(
  (d) => d.offers_pickup || d.offers_delivery || d.offers_dine_in,
  {
    message: "Activa al menos un modo: recoger, envío o comedor",
    path: ["offers_pickup"],
  },
);

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type DishFormInput = z.infer<typeof dishFormSchema>;
export type RestaurantSettingsInput = z.infer<typeof restaurantSettingsSchema>;

export function fieldErrorsFromZod(
  error: z.ZodError,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
