"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Filter, Mic, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MenuIntent } from "@/lib/ai-schemas";
import { looksLikePhrase } from "@/lib/menu-intent";
import { formatMxn } from "@/lib/money";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  countActiveMenuFilters,
  emptyMenuFilters,
  menuFiltersNarrow,
  menuPricePresets,
  type MenuSearchFilters,
  type MenuSort,
} from "@/lib/menu-filters";

export type { MenuSearchFilters, MenuSort } from "@/lib/menu-filters";
export {
  comboMatchesFilters,
  dishMatchesFilters,
  emptyMenuFilters,
  menuFiltersNarrow,
  sortMenuItems,
} from "@/lib/menu-filters";

type ChipKey =
  | "query"
  | "presupuesto"
  | "comensales"
  | "popular"
  | "sort"
  | `tag:${string}`
  | `cat:${string}`;

type CategoryOpt = { id: string; name: string };

export type MenuSearchToolbarParts = {
  tools: React.ReactNode;
  searchField: React.ReactNode;
  searchOpen: boolean;
  chips: React.ReactNode;
};

type Props = {
  slug: string;
  onChange: (filters: MenuSearchFilters) => void;
  categories?: CategoryOpt[];
  hasPopular?: boolean;
  priceMin?: number;
  priceMax?: number;
  render?: (parts: MenuSearchToolbarParts) => React.ReactNode;
};

const SORT_OPTIONS: { id: MenuSort; label: string }[] = [
  { id: "menu", label: "Como el menú" },
  { id: "name", label: "Nombre A–Z" },
  { id: "price_asc", label: "Precio: menor" },
  { id: "price_desc", label: "Precio: mayor" },
];

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function intentToFilters(
  intent: MenuIntent,
  fallbackQuery: string,
  prev: MenuSearchFilters,
): MenuSearchFilters {
  return {
    ...prev,
    query: (intent.query ?? fallbackQuery).trim(),
    presupuestoMin:
      typeof intent.presupuesto_min === "number"
        ? intent.presupuesto_min
        : prev.presupuestoMin,
    presupuestoMax:
      typeof intent.presupuesto_max === "number"
        ? intent.presupuesto_max
        : prev.presupuestoMax,
    comensales:
      typeof intent.comensales === "number" ? intent.comensales : null,
    tags: (intent.etiquetas ?? []).map((t) => t.trim()).filter(Boolean),
  };
}

function ToolButton({
  active,
  badge,
  dot,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  badge?: number;
  dot?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center rounded-full transition",
        active
          ? "bg-brand text-white"
          : "text-muted hover:bg-surface hover:text-brand-dark",
        className,
      )}
      {...props}
    >
      {children}
      {dot && !active ? (
        <span className="absolute right-1 top-1 size-1.5 rounded-full bg-brand" />
      ) : null}
      {badge && badge > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </button>
  );
}

export function PublicMenuSearch({
  slug,
  onChange,
  categories = [],
  hasPopular = false,
  priceMin = 0,
  priceMax = 0,
  render,
}: Props) {
  const [text, setText] = useState("");
  const [filters, setFilters] = useState<MenuSearchFilters>(emptyMenuFilters);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [speechOk, setSpeechOk] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRec;
      webkitSpeechRecognition?: new () => SpeechRec;
    };
    setSpeechOk(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const apply = useCallback(
    (next: MenuSearchFilters) => {
      setFilters(next);
      onChange(next);
    },
    [onChange],
  );

  async function resolveIntent(raw: string) {
    const q = raw.trim();
    const prev = filtersRef.current;
    if (q.length === 0) {
      apply({ ...prev, query: "", tags: [], comensales: null });
      return;
    }
    if (!looksLikePhrase(q)) {
      apply({ ...prev, query: q });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/public/menu-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: q, slug }),
      });
      const json = (await res.json()) as { intent?: MenuIntent };
      if (json.intent) apply(intentToFilters(json.intent, q, prev));
      else apply({ ...prev, query: q });
    } catch {
      apply({ ...prev, query: q });
    } finally {
      setBusy(false);
    }
  }

  function onTextChange(value: string) {
    setText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void resolveIntent(value);
    }, 450);
  }

  function stopVoice() {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setListening(false);
  }

  function startVoice() {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRec;
      webkitSpeechRecognition?: new () => SpeechRec;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setSearchOpen(true);
      window.setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }
    stopVoice();
    const rec = new Ctor();
    rec.lang = "es-MX";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const said = ev.results[0]?.[0]?.transcript ?? "";
      setText(said);
      void resolveIntent(said);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  function openSearch(withVoice: boolean) {
    setSearchOpen(true);
    if (withVoice && speechOk) startVoice();
    else window.setTimeout(() => inputRef.current?.focus(), 50);
  }

  function collapseSearch() {
    stopVoice();
    setSearchOpen(false);
  }

  function removeChip(key: ChipKey) {
    const next = { ...filters, tags: [...filters.tags], categoryIds: [...filters.categoryIds] };
    if (key === "query") {
      next.query = "";
      setText("");
    } else if (key === "presupuesto") {
      next.presupuestoMin = null;
      next.presupuestoMax = null;
    } else if (key === "comensales") next.comensales = null;
    else if (key === "popular") next.popularOnly = false;
    else if (key === "sort") next.sortBy = "menu";
    else if (key.startsWith("tag:")) {
      const tag = key.slice(4);
      next.tags = next.tags.filter((t) => t !== tag);
    } else if (key.startsWith("cat:")) {
      const id = key.slice(4);
      next.categoryIds = next.categoryIds.filter((id0) => id !== id0);
    }
    apply(next);
  }

  function clearAll() {
    setText("");
    stopVoice();
    apply({ ...emptyMenuFilters });
  }

  const catName = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const chips = useMemo(() => {
    const out: { key: ChipKey; label: string }[] = [];
    if (filters.query) out.push({ key: "query", label: filters.query });
    if (filters.presupuestoMin != null || filters.presupuestoMax != null) {
      const lo =
        filters.presupuestoMin != null ? formatMxn(filters.presupuestoMin) : "";
      const hi =
        filters.presupuestoMax != null ? formatMxn(filters.presupuestoMax) : "";
      const label =
        filters.presupuestoMin != null && filters.presupuestoMax != null
          ? `${lo} – ${hi}`
          : filters.presupuestoMin != null
            ? `Desde ${lo}`
            : `Hasta ${hi}`;
      out.push({ key: "presupuesto", label });
    }
    if (filters.comensales != null) {
      out.push({
        key: "comensales",
        label: `${filters.comensales} personas`,
      });
    }
    if (filters.popularOnly) out.push({ key: "popular", label: "Populares" });
    if (filters.sortBy !== "menu") {
      const opt = SORT_OPTIONS.find((s) => s.id === filters.sortBy);
      if (opt) out.push({ key: "sort", label: opt.label });
    }
    for (const id of filters.categoryIds) {
      out.push({ key: `cat:${id}`, label: catName.get(id) ?? "Categoría" });
    }
    for (const t of filters.tags) {
      out.push({ key: `tag:${t}`, label: t });
    }
    return out;
  }, [filters, catName]);

  const filterCount = countActiveMenuFilters(filters);
  const presets = useMemo(
    () => menuPricePresets(priceMin, priceMax),
    [priceMin, priceMax],
  );

  useEffect(() => {
    if (!searchOpen || listening || text.trim()) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
      recRef.current = null;
      setListening(false);
      setSearchOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [searchOpen, listening, text]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      stopVoice();
    };
  }, []);

  function toggleCategory(id: string) {
    const has = filters.categoryIds.includes(id);
    apply({
      ...filters,
      categoryIds: has
        ? filters.categoryIds.filter((x) => x !== id)
        : [...filters.categoryIds, id],
    });
  }

  function presetActive(min: number | null, max: number | null) {
    return filters.presupuestoMin === min && filters.presupuestoMax === max;
  }

  const filterButton = (
    <ToolButton
      active={filterOpen}
      badge={filterCount}
      onClick={() => setFilterOpen(true)}
      aria-label="Filtrar menú"
      aria-expanded={filterOpen}
    >
      <Filter className="size-4" />
    </ToolButton>
  );

  const tools = (
    <div className="flex shrink-0 items-center">
      <ToolButton
        active={listening}
        dot={Boolean(filters.query)}
        onClick={() => openSearch(false)}
        aria-label={
          speechOk ? "Buscar por voz o sugerencia" : "Buscar en el menú"
        }
        aria-expanded={searchOpen}
      >
        {speechOk ? <Mic className="size-4" /> : <Search className="size-4" />}
      </ToolButton>
      {filterButton}
    </div>
  );

  const searchField = (
    <div className="flex min-w-0 flex-1 items-center">
      <Search className="ml-2 size-4 shrink-0 text-muted" aria-hidden />
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Tacos, $150, para 2…"
        className="min-h-10 w-full bg-transparent px-2 text-sm outline-none placeholder:text-muted"
        aria-label="Buscar en el menú"
      />
      {busy ? (
        <span className="shrink-0 pr-1 text-[10px] text-muted">…</span>
      ) : null}
      {speechOk ? (
        <ToolButton
          active={listening}
          onClick={() => (listening ? stopVoice() : startVoice())}
          aria-label={listening ? "Detener voz" : "Buscar por voz"}
          aria-pressed={listening}
        >
          <Mic className="size-4" />
        </ToolButton>
      ) : null}
      {filterButton}
      <ToolButton onClick={collapseSearch} aria-label="Cerrar búsqueda">
        <X className="size-4" />
      </ToolButton>
    </div>
  );

  const chipRow =
    chips.length > 0 ? (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => removeChip(c.key)}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-brand/30 bg-brand/5 px-2.5 py-1 text-[11px] font-medium text-brand-dark"
          >
            <span className="truncate">{c.label}</span>
            <X className="size-3 shrink-0 opacity-70" />
          </button>
        ))}
        {menuFiltersNarrow(filters) || filters.sortBy !== "menu" ? (
          <button
            type="button"
            onClick={clearAll}
            className="px-1.5 text-[11px] font-medium text-muted underline-offset-2 hover:text-brand-dark hover:underline"
          >
            Limpiar
          </button>
        ) : null}
      </div>
    ) : null;

  return (
    <div ref={wrapRef}>
      {render ? (
        render({
          tools,
          searchField,
          searchOpen,
          chips: chipRow,
        })
      ) : (
        <>
          <div className="flex items-center justify-end">
            {searchOpen ? searchField : tools}
          </div>
          {chipRow}
        </>
      )}

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent
          className={cn(
            "menu-sheet-in fixed inset-x-0 bottom-0 top-auto left-0 max-h-[88dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-b-none rounded-t-3xl p-5",
            "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
          )}
        >
          <DialogHeader>
            <DialogTitle>Filtrar menú</DialogTitle>
            <DialogDescription>
              Acota por nombre, precio o categoría. Los cambios se aplican al instante.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted">Nombre</span>
              <input
                value={text}
                onChange={(e) => onTextChange(e.target.value)}
                placeholder="Ej. tacos al pastor"
                className="h-11 w-full rounded-xl border border-black/10 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
            </label>

            {priceMax > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted">Precio</p>
                {presets.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {presets.map((p) => {
                      const on = presetActive(p.min, p.max);
                      return (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() =>
                            apply({
                              ...filters,
                              presupuestoMin: on ? null : p.min,
                              presupuestoMax: on ? null : p.max,
                            })
                          }
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold",
                            on
                              ? "border-brand bg-brand text-white"
                              : "border-black/10 bg-background text-brand-dark",
                          )}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <label className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted">
                    Mín
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      className="h-11 w-full rounded-xl border border-black/10 bg-background px-2 text-sm text-foreground"
                      value={filters.presupuestoMin ?? ""}
                      onChange={(e) => {
                        const v =
                          e.target.value === "" ? null : Number(e.target.value);
                        apply({
                          ...filters,
                          presupuestoMin:
                            v != null && Number.isFinite(v) ? v : null,
                        });
                      }}
                    />
                  </label>
                  <label className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted">
                    Máx
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      className="h-11 w-full rounded-xl border border-black/10 bg-background px-2 text-sm text-foreground"
                      value={filters.presupuestoMax ?? ""}
                      onChange={(e) => {
                        const v =
                          e.target.value === "" ? null : Number(e.target.value);
                        apply({
                          ...filters,
                          presupuestoMax:
                            v != null && Number.isFinite(v) ? v : null,
                        });
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {categories.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted">Categoría</p>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c) => {
                    const on = filters.categoryIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCategory(c.id)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold",
                          on
                            ? "border-brand bg-brand text-white"
                            : "border-black/10 bg-background text-brand-dark",
                        )}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {hasPopular ? (
              <label className="flex min-h-11 items-center justify-between gap-3">
                <span className="text-sm font-medium">Solo populares</span>
                <Switch
                  checked={filters.popularOnly}
                  onCheckedChange={(v) =>
                    apply({ ...filters, popularOnly: Boolean(v) })
                  }
                />
              </label>
            ) : null}

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted">Ordenar</p>
              <div className="flex flex-wrap gap-1.5">
                {SORT_OPTIONS.map((s) => {
                  const on = filters.sortBy === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => apply({ ...filters, sortBy: s.id })}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-semibold",
                        on
                          ? "border-brand bg-brand text-white"
                          : "border-black/10 bg-background text-brand-dark",
                      )}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={clearAll}
                className="h-11 flex-1 rounded-xl border border-black/10 text-sm font-semibold text-brand-dark"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                className="h-11 flex-1 rounded-xl bg-brand text-sm font-semibold text-white"
              >
                Listo
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
