"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CatalogScanReview,
  type ScanReviewCategory,
  type ScanReviewProduct,
} from "@/components/admin/catalog-scan-review";
import type { Category, Dish } from "@/lib/types";

type Props = {
  restaurantId: string;
  slug: string;
  categories: Category[];
  dishes: Pick<Dish, "id" | "name">[];
  onDone: () => void;
};

function parseCsv(text: string): ScanReviewCategory[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0]!.toLowerCase().split(/[,;]/).map((h) => h.trim());
  const idx = {
    nombre: header.findIndex((h) => /nombre|name|producto|platillo/.test(h)),
    precio: header.findIndex((h) => /precio|price|costo/.test(h)),
    descripcion: header.findIndex((h) => /desc|description/.test(h)),
    categoria: header.findIndex((h) => /categ|category|grupo/.test(h)),
  };
  if (idx.nombre < 0) throw new Error("El CSV necesita columna nombre");

  const byCat = new Map<string, ScanReviewProduct[]>();
  for (const line of lines.slice(1)) {
    const cols = line.split(/[,;]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    const nombre = cols[idx.nombre]?.trim();
    if (!nombre) continue;
    const cat =
      idx.categoria >= 0 ? cols[idx.categoria]?.trim() || "General" : "General";
    const precioRaw =
      idx.precio >= 0 ? cols[idx.precio]?.replace(/[^\d.]/g, "") : "0";
    const precio = Number(precioRaw) || 0;
    const descripcion =
      idx.descripcion >= 0 ? cols[idx.descripcion]?.trim() || "" : "";
    const list = byCat.get(cat) ?? [];
    list.push({
      nombre,
      precio,
      descripcion,
      raw_description: descripcion,
      ai_suggested_description: "",
    });
    byCat.set(cat, list);
  }
  return [...byCat.entries()].map(([nombre, productos]) => ({
    nombre,
    productos,
  }));
}

export function CatalogImportPanel({
  restaurantId,
  slug,
  categories,
  dishes,
  onDone,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<ScanReviewCategory[] | null>(null);
  const [scansRemaining, setScansRemaining] = useState<number | null>(null);

  const existingByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of dishes) {
      m.set(d.name.trim().toLowerCase(), d.id);
    }
    return m;
  }, [dishes]);

  function markExisting(cats: ScanReviewCategory[]): ScanReviewCategory[] {
    return cats.map((c) => ({
      ...c,
      productos: c.productos.map((p) => {
        const existingId =
          existingByName.get(p.nombre.trim().toLowerCase()) ?? null;
        const isDup = Boolean(existingId || p.is_possible_duplicate);
        return {
          ...p,
          existingId,
          is_possible_duplicate: isDup,
          skip: isDup,
        };
      }),
    }));
  }

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files];
    const csv = list.find(
      (f) =>
        f.type === "text/csv" ||
        f.name.toLowerCase().endsWith(".csv") ||
        f.name.toLowerCase().endsWith(".txt"),
    );
    if (csv) {
      try {
        const text = await csv.text();
        setDraft(markExisting(parseCsv(text)));
        toast.success("CSV listo para revisar (sin gastar IA)");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "CSV inválido");
      }
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      for (const f of list.slice(0, 3)) {
        if (
          f.type === "application/pdf" ||
          f.name.toLowerCase().endsWith(".pdf")
        ) {
          form.append("files", f);
        } else if (f.type.startsWith("image/") || !f.type) {
          try {
            const compressed = await compressImage(f, "scan");
            form.append("files", compressed);
          } catch {
            toast.error(
              `No se pudo leer ${f.name}. Guarda como JPG e intenta de nuevo.`,
            );
            return;
          }
        }
      }
      const res = await fetch("/api/admin/catalog/scan", {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as {
        categorias?: ScanReviewCategory[];
        scansRemaining?: number;
        message?: string;
      };
      if (!res.ok) {
        toast.error(json.message || "No se pudo escanear");
        return;
      }
      setDraft(markExisting(json.categorias ?? []));
      if (typeof json.scansRemaining === "number") {
        setScansRemaining(json.scansRemaining);
      }
      toast.success("Revisa el menú detectado antes de guardar");
    } catch {
      toast.error("Error de red al escanear");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!draft) return;
    setBusy(true);
    const supabase = createClient();
    try {
      const catIdByName = new Map(
        categories.map((c) => [c.name.trim().toLowerCase(), c.id]),
      );
      let sortBase = categories.length;

      for (const cat of draft) {
        const key = cat.nombre.trim().toLowerCase();
        let categoryId = catIdByName.get(key) ?? null;
        if (!categoryId) {
          const { data, error } = await supabase
            .from("categories")
            .insert({
              restaurant_id: restaurantId,
              name: cat.nombre.trim(),
              sort_order: sortBase++,
              is_fixed_catalog: true,
            })
            .select("id")
            .single();
          if (error || !data) throw new Error(error?.message || "Categoría");
          categoryId = data.id;
          catIdByName.set(key, data.id);
        }
        if (!categoryId) continue;

        const resolvedCategoryId = categoryId;
        const toInsert = cat.productos
          .filter((p) => !p.skip && p.nombre.trim())
          .map((p, i) => ({
            restaurant_id: restaurantId,
            category_id: resolvedCategoryId,
            name: p.nombre.trim(),
            description: p.descripcion?.trim() || "",
            price: Number(p.precio) || 0,
            is_side: false,
            is_active: true,
            is_popular: false,
            photo_url: null,
            sort_order: i,
            allow_purchase: true,
            allow_booking: false,
            unit_type: "unit",
            step_value: 1,
          }));

        if (toInsert.length) {
          const { error } = await supabase.from("dishes").insert(toInsert);
          if (error) throw new Error(error.message);
        }
      }

      await fetch("/api/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      toast.success("Catálogo importado");
      setDraft(null);
      setOpen(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Cargar menú o catálogo
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-black/10 bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Cargar menú o catálogo</p>
          <p className="text-[11px] text-muted">
            Foto/PDF usan IA (máx. 3 fotos o 1 PDF). CSV no gasta cupo.
            {scansRemaining != null
              ? ` Escaneos restantes este mes: ${scansRemaining}.`
              : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            setDraft(null);
          }}
        >
          Cerrar
        </Button>
      </div>

      {!draft ? (
        <div className="space-y-2">
          <Label htmlFor="catalog-import">Archivos</Label>
          <Input
            id="catalog-import"
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,.pdf,.csv,text/csv"
            multiple
            disabled={busy}
            onChange={(e) => void onPickFiles(e.target.files)}
          />
          {busy ? (
            <p className="text-xs text-muted">Procesando…</p>
          ) : null}
        </div>
      ) : (
        <CatalogScanReview
          draft={draft}
          busy={busy}
          onChange={setDraft}
          onConfirm={() => void confirmImport()}
          onBack={() => setDraft(null)}
        />
      )}
    </div>
  );
}
