"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ScanReviewProduct = {
  nombre: string;
  precio: number;
  /** Final description that will be inserted */
  descripcion: string;
  raw_description?: string;
  ai_suggested_description?: string;
  is_possible_duplicate?: boolean;
  skip?: boolean;
  existingId?: string | null;
};

export type ScanReviewCategory = {
  nombre: string;
  productos: ScanReviewProduct[];
};

type Props = {
  draft: ScanReviewCategory[];
  busy: boolean;
  onChange: (next: ScanReviewCategory[]) => void;
  onConfirm: () => void;
  onBack: () => void;
};

export function CatalogScanReview({
  draft,
  busy,
  onChange,
  onConfirm,
  onBack,
}: Props) {
  function updateProduct(
    ci: number,
    pi: number,
    patch: Partial<ScanReviewProduct>,
  ) {
    const next = structuredClone(draft);
    next[ci]!.productos[pi] = { ...next[ci]!.productos[pi]!, ...patch };
    onChange(next);
  }

  return (
    <div className="max-h-[32rem] space-y-3 overflow-y-auto">
      {draft.map((cat, ci) => (
        <div key={`${cat.nombre}-${ci}`} className="space-y-2">
          <Input
            value={cat.nombre}
            onChange={(e) => {
              const next = [...draft];
              next[ci] = { ...cat, nombre: e.target.value };
              onChange(next);
            }}
            className="font-semibold"
            aria-label="Nombre de categoría"
          />
          {cat.productos.map((p, pi) => {
            const hasAi = Boolean(p.ai_suggested_description?.trim());
            const hasRaw = Boolean(p.raw_description?.trim());
            return (
              <div
                key={`${p.nombre}-${pi}`}
                className="space-y-2 rounded-xl border border-black/5 p-3"
              >
                <div className="grid gap-2 sm:grid-cols-[1fr_5.5rem_auto]">
                  <Input
                    value={p.nombre}
                    onChange={(e) =>
                      updateProduct(ci, pi, { nombre: e.target.value })
                    }
                    aria-label="Nombre del producto"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={p.precio}
                    onChange={(e) =>
                      updateProduct(ci, pi, {
                        precio: Number(e.target.value) || 0,
                      })
                    }
                    aria-label="Precio"
                  />
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={!p.skip}
                      onChange={(e) =>
                        updateProduct(ci, pi, { skip: !e.target.checked })
                      }
                    />
                    Incluir
                  </label>
                </div>

                {p.is_possible_duplicate || p.existingId ? (
                  <p className="text-[10px] font-medium text-amber-700">
                    Posible duplicado: ya existe en el catálogo
                  </p>
                ) : null}

                {hasRaw ? (
                  <div className="rounded-lg bg-black/5 px-2 py-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      Del menú
                    </p>
                    <p className="text-xs text-muted">{p.raw_description}</p>
                  </div>
                ) : null}

                {hasAi ? (
                  <div className="rounded-lg border border-brand/20 bg-brand/5 px-2 py-1.5">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold text-brand-dark">
                        Sugerencia IA
                      </span>
                      <button
                        type="button"
                        className="text-[10px] font-medium text-brand underline"
                        onClick={() =>
                          updateProduct(ci, pi, {
                            descripcion: p.ai_suggested_description!.trim(),
                          })
                        }
                      >
                        Usar sugerencia
                      </button>
                    </div>
                    <p className="text-xs text-brand-dark/90">
                      {p.ai_suggested_description}
                    </p>
                  </div>
                ) : null}

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      Descripción a guardar
                    </p>
                    <button
                      type="button"
                      className="text-[10px] text-muted underline"
                      onClick={() => updateProduct(ci, pi, { descripcion: "" })}
                    >
                      Dejar en blanco
                    </button>
                  </div>
                  <Input
                    value={p.descripcion}
                    placeholder="Descripción final"
                    onChange={(e) =>
                      updateProduct(ci, pi, { descripcion: e.target.value })
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <div className="flex flex-wrap gap-2 sticky bottom-0 bg-surface/95 py-2 backdrop-blur">
        <Button type="button" disabled={busy} onClick={onConfirm}>
          Guardar seleccionados
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onBack}>
          Volver a subir
        </Button>
      </div>
    </div>
  );
}
