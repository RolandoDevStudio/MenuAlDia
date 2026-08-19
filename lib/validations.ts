import { z } from "zod";

export const checkoutSchema = z
  .object({
    customerName: z.string().min(2, "Escribe tu nombre"),
    address: z.string().min(5, "Escribe la dirección de entrega"),
    mapsUrl: z
      .string()
      .trim()
      .optional()
      .default("")
      .refine(
        (v) => !v || /^https?:\/\//i.test(v),
        "Pega el enlace completo de Google Maps (https://…)",
      ),
    references: z.string().optional().default(""),
    paymentMethod: z.enum(["cash", "transfer"]),
    cashAmount: z.coerce.number().optional().nullable(),
  })
  .superRefine((data, ctx) => {
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
  address: z.string().min(3, "Escribe la dirección"),
  maps_url: z
    .string()
    .url("Enlace de Maps inválido")
    .optional()
    .or(z.literal("")),
  schedule_text: z.string().min(1, "Escribe el horario"),
  shipping_cost: z.coerce.number().min(0, "El envío no puede ser negativo"),
  free_shipping: z.boolean(),
  logo_url: z
    .string()
    .url("URL de logo inválida")
    .nullable()
    .optional()
    .or(z.literal("")),
});

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
