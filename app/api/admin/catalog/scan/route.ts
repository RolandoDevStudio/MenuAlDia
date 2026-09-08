import { NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/admin-session";
import { createClient } from "@/lib/supabase/server";
import {
  GeminiUnavailableError,
  generateJson,
  type GeminiJsonPart,
} from "@/lib/gemini";
import {
  assertAiAllowed,
  getScanMonthlyLimit,
  countScansThisMonth,
  recordUsage,
} from "@/lib/ai-quota";
import {
  catalogScanGeminiSchema,
  catalogScanResultSchema,
  type CatalogScanProduct,
} from "@/lib/ai-schemas";
import {
  BUSINESS_TYPE_LABELS,
  normalizeBusinessType,
} from "@/lib/business-labels";

export const maxDuration = 60;

const MAX_FILES = 3;
const MAX_PDF_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 450 * 1024;
const MAX_PRODUCTS = 80;
const MAX_EXISTING_DISHES = 60;
const MAX_AI_DESC = 160;

function trimAiDesc(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  if (!t) return "";
  return t.length > MAX_AI_DESC ? `${t.slice(0, MAX_AI_DESC - 1)}…` : t;
}

function canonicalCategory(
  name: string,
  existing: Map<string, string>,
): string {
  const key = name.trim().toLowerCase();
  return existing.get(key) ?? name.trim();
}

function flattenProducts(
  parsed: {
    categorias: {
      nombre?: string;
      productos: CatalogScanProduct[];
    }[];
    productos?: CatalogScanProduct[];
  },
): CatalogScanProduct[] {
  const out: CatalogScanProduct[] = [];
  for (const c of parsed.categorias) {
    const fallbackCat = c.nombre?.trim() || "General";
    for (const p of c.productos) {
      out.push({
        ...p,
        category_name: (p.category_name || fallbackCat).trim() || fallbackCat,
      });
    }
  }
  for (const p of parsed.productos ?? []) {
    out.push(p);
  }
  return out;
}

function regroup(
  products: CatalogScanProduct[],
  existingCats: Map<string, string>,
  existingDishes: Set<string>,
): {
  nombre: string;
  productos: {
    nombre: string;
    precio: number;
    raw_description: string;
    ai_suggested_description: string;
    descripcion: string;
    is_possible_duplicate: boolean;
  }[];
}[] {
  const byCat = new Map<
    string,
    {
      nombre: string;
      precio: number;
      raw_description: string;
      ai_suggested_description: string;
      descripcion: string;
      is_possible_duplicate: boolean;
    }[]
  >();

  let remaining = MAX_PRODUCTS;
  for (const p of products) {
    if (remaining <= 0) break;
    const rawName = (p.raw_name ?? "").trim();
    if (!rawName) continue;
    const cat = canonicalCategory(
      p.category_name || "General",
      existingCats,
    );
    const rawDesc = (p.raw_description ?? "").trim();
    const aiDesc = trimAiDesc(p.ai_suggested_description);
    const isDup = existingDishes.has(rawName.toLowerCase());
    const list = byCat.get(cat) ?? [];
    list.push({
      nombre: rawName,
      precio:
        typeof p.price === "number" && Number.isFinite(p.price)
          ? Math.round(p.price * 100) / 100
          : 0,
      raw_description: rawDesc,
      ai_suggested_description: aiDesc,
      // Default: prefer text from the menu when present
      descripcion: rawDesc || aiDesc,
      is_possible_duplicate: isDup,
    });
    byCat.set(cat, list);
    remaining -= 1;
  }

  return [...byCat.entries()]
    .map(([nombre, productos]) => ({ nombre, productos }))
    .filter((c) => c.productos.length > 0);
}

function expertSystemForGiro(giro: string): string {
  if (giro === "Servicios") {
    return "Eres un experto en catálogos de servicios en México. Extrae solo lo que aparece en el documento. Redacta sugerencias breves y profesionales para cada servicio.";
  }
  if (giro === "Tienda") {
    return "Eres un experto en catálogos de tienda/productos en México. Extrae solo lo que aparece en el documento. Redacta sugerencias breves y comerciales para cada producto.";
  }
  return "Eres un experto gastronómico de restaurantes en México. Extrae solo platillos/bebidas que aparecen en el documento. Redacta una descripción atrayente y breve por ítem.";
}

export async function POST(request: Request) {
  const session = await requireTenantSession();
  const restaurantId = session.restaurant.id;

  if (session.restaurant.ai_paused) {
    return NextResponse.json(
      {
        error: "AI_PAUSED",
        message: "La IA está pausada para este negocio.",
      },
      { status: 403 },
    );
  }

  const gate = await assertAiAllowed({ restaurantId });
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.error, message: gate.message },
      { status: gate.status },
    );
  }

  const scanLimit = await getScanMonthlyLimit();
  const scansUsed = await countScansThisMonth(restaurantId);
  if (scansUsed >= scanLimit) {
    return NextResponse.json(
      {
        error: "SCAN_QUOTA",
        message: `Alcanzaste el límite de ${scanLimit} cargas de menú con IA este mes.`,
      },
      { status: 403 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Formulario inválido." },
      { status: 400 },
    );
  }

  const files = form
    .getAll("files")
    .filter((f): f is File => typeof f !== "string" && f.size > 0);

  if (files.length === 0) {
    return NextResponse.json(
      { error: "no_files", message: "Sube al menos una imagen o un PDF." },
      { status: 400 },
    );
  }

  const pdfs = files.filter(
    (f) =>
      f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
  );
  const images = files.filter((f) => f.type.startsWith("image/"));

  if (pdfs.length > 1 || (pdfs.length === 1 && images.length > 0)) {
    return NextResponse.json(
      {
        error: "bad_mix",
        message: "Envía hasta 3 imágenes o 1 PDF, no ambos.",
      },
      { status: 400 },
    );
  }
  if (images.length > MAX_FILES) {
    return NextResponse.json(
      { error: "too_many", message: `Máximo ${MAX_FILES} imágenes.` },
      { status: 400 },
    );
  }

  const businessType = normalizeBusinessType(session.restaurant.business_type);
  const giro = BUSINESS_TYPE_LABELS[businessType];
  const name = session.restaurant.name?.trim() || "Negocio";
  const slogan = (session.restaurant.slogan ?? "").trim().slice(0, 80);

  const supabase = await createClient();
  const [{ data: catRows }, { data: dishRows }] = await Promise.all([
    supabase
      .from("categories")
      .select("name")
      .eq("restaurant_id", restaurantId)
      .order("sort_order"),
    supabase
      .from("dishes")
      .select("name")
      .eq("restaurant_id", restaurantId)
      .is("archived_at", null)
      .order("sort_order")
      .limit(MAX_EXISTING_DISHES),
  ]);

  const existingCatNames = (catRows ?? [])
    .map((c) => (c.name ?? "").trim())
    .filter(Boolean);
  const existingDishNames = (dishRows ?? [])
    .map((d) => (d.name ?? "").trim())
    .filter(Boolean);

  const existingCatMap = new Map(
    existingCatNames.map((n) => [n.toLowerCase(), n]),
  );
  const existingDishSet = new Set(
    existingDishNames.map((n) => n.toLowerCase()),
  );

  const contextBlock = [
    `Negocio: ${name}`,
    `Giro: ${giro}`,
    slogan ? `Slogan: ${slogan}` : null,
    `Categorías existentes: ${existingCatNames.length ? existingCatNames.join(", ") : "(ninguna)"}`,
    `Platillos/ítems existentes (parcial): ${existingDishNames.length ? existingDishNames.join(", ") : "(ninguno)"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const parts: GeminiJsonPart[] = [
    {
      text: `${contextBlock}

Instrucciones:
- Extrae solo ítems visibles en el archivo. No inventes.
- Máximo ${MAX_PRODUCTS} productos.
- Precios numéricos MXN sin símbolos; null si no hay.
- category_name: prioriza una categoría existente; si no aplica, usa una estándar (Platillos, Guarniciones, Bebidas, Productos, Servicios, etc.) según el giro ${giro}.
- raw_description: texto original del menú si existe; si no, null.
- ai_suggested_description: UNA sola frase atractiva breve (máx. 120 caracteres) adaptada al giro ${giro}. No des varias opciones.
- is_possible_duplicate: true si raw_name ya está en la lista de existentes.
- Agrupa en categorias[].productos.`,
    },
  ];

  try {
    if (pdfs.length === 1) {
      const pdf = pdfs[0]!;
      if (pdf.size > MAX_PDF_BYTES) {
        return NextResponse.json(
          {
            error: "pdf_too_large",
            message: "El PDF debe pesar menos de 2 MB (máx. 4 páginas).",
          },
          { status: 400 },
        );
      }
      const buf = Buffer.from(await pdf.arrayBuffer());
      parts.push({
        inlineData: {
          mimeType: "application/pdf",
          data: buf.toString("base64"),
        },
      });
    } else {
      for (const img of images) {
        if (img.size > MAX_IMAGE_BYTES) {
          return NextResponse.json(
            {
              error: "image_too_large",
              message:
                "Cada imagen debe ir comprimida (máx. ~400 KB). Recarga e intenta de nuevo.",
            },
            { status: 400 },
          );
        }
        const buf = Buffer.from(await img.arrayBuffer());
        const mime =
          img.type === "image/png" || img.type === "image/webp"
            ? img.type
            : "image/jpeg";
        parts.push({
          inlineData: { mimeType: mime, data: buf.toString("base64") },
        });
      }
    }

    const raw = await generateJson<unknown>({
      system: expertSystemForGiro(giro),
      parts,
      schema: catalogScanGeminiSchema,
    });

    const parsed = catalogScanResultSchema.safeParse(raw);
    if (!parsed.success) {
      await recordUsage({ restaurantId, kind: "scan", ok: false });
      return NextResponse.json(
        {
          error: "parse_failed",
          message: "No se pudo interpretar el menú. Prueba otra foto o PDF.",
        },
        { status: 422 },
      );
    }

    const flat = flattenProducts(parsed.data);
    const categorias = regroup(flat, existingCatMap, existingDishSet);

    await recordUsage({ restaurantId, kind: "scan", ok: true });

    return NextResponse.json({
      categorias,
      scansRemaining: Math.max(0, scanLimit - scansUsed - 1),
      giro,
    });
  } catch (e) {
    await recordUsage({ restaurantId, kind: "scan", ok: false });
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[catalog/scan]", detail, e);
    if (e instanceof GeminiUnavailableError) {
      return NextResponse.json(
        { error: "AI_UNAVAILABLE", message: e.message },
        { status: e.status },
      );
    }
    return NextResponse.json(
      { error: "server_error", message: "Error al escanear el menú." },
      { status: 500 },
    );
  }
}
