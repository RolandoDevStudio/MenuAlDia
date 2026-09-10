"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MenuIntent } from "@/lib/ai-schemas";
import { looksLikePhrase } from "@/lib/menu-intent";

type ChipKey =
  | "query"
  | "presupuesto_min"
  | "presupuesto_max"
  | "comensales"
  | `tag:${string}`;

export type MenuSearchFilters = {
  query: string;
  presupuestoMin: number | null;
  presupuestoMax: number | null;
  comensales: number | null;
  tags: string[];
};

type Props = {
  slug: string;
  onChange: (filters: MenuSearchFilters) => void;
};

const empty: MenuSearchFilters = {
  query: "",
  presupuestoMin: null,
  presupuestoMax: null,
  comensales: null,
  tags: [],
};

function intentToFilters(intent: MenuIntent, fallbackQuery: string): MenuSearchFilters {
  return {
    query: (intent.query ?? fallbackQuery).trim(),
    presupuestoMin:
      typeof intent.presupuesto_min === "number"
        ? intent.presupuesto_min
        : null,
    presupuestoMax:
      typeof intent.presupuesto_max === "number"
        ? intent.presupuesto_max
        : null,
    comensales:
      typeof intent.comensales === "number" ? intent.comensales : null,
    tags: (intent.etiquetas ?? []).map((t) => t.trim()).filter(Boolean),
  };
}

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

export function PublicMenuSearch({ slug, onChange }: Props) {
  const [text, setText] = useState("");
  const [filters, setFilters] = useState<MenuSearchFilters>(empty);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [speechOk, setSpeechOk] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recRef = useRef<SpeechRec | null>(null);

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
    if (q.length < 2) {
      apply({ ...empty });
      return;
    }
    if (!looksLikePhrase(q)) {
      apply({ ...empty, query: q });
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
      if (json.intent) apply(intentToFilters(json.intent, q));
      else apply({ ...empty, query: q });
    } catch {
      apply({ ...empty, query: q });
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

  function startVoice() {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRec;
      webkitSpeechRecognition?: new () => SpeechRec;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
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
    rec.start();
  }

  function removeChip(key: ChipKey) {
    const next = { ...filters, tags: [...filters.tags] };
    if (key === "query") {
      next.query = "";
      setText("");
    } else if (key === "presupuesto_min") next.presupuestoMin = null;
    else if (key === "presupuesto_max") next.presupuestoMax = null;
    else if (key === "comensales") next.comensales = null;
    else if (key.startsWith("tag:")) {
      const tag = key.slice(4);
      next.tags = next.tags.filter((t) => t !== tag);
    }
    apply(next);
  }

  const chips = useMemo(() => {
    const out: { key: ChipKey; label: string }[] = [];
    if (filters.query) out.push({ key: "query", label: filters.query });
    if (filters.presupuestoMin != null) {
      out.push({
        key: "presupuesto_min",
        label: `Mín $${filters.presupuestoMin}`,
      });
    }
    if (filters.presupuestoMax != null) {
      out.push({
        key: "presupuesto_max",
        label: `Máx $${filters.presupuestoMax}`,
      });
    }
    if (filters.comensales != null) {
      out.push({
        key: "comensales",
        label: `${filters.comensales} personas`,
      });
    }
    for (const t of filters.tags) {
      out.push({ key: `tag:${t}`, label: t });
    }
    return out;
  }, [filters]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-card/90 px-3 py-2 shadow-sm backdrop-blur">
        <Search className="size-4 shrink-0 text-muted" aria-hidden />
        <input
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Buscar por voz o sugerencia"
          className="min-h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted"
          aria-label="Buscar en el menú"
        />
        {speechOk ? (
          <button
            type="button"
            onClick={() => startVoice()}
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              listening ? "bg-brand text-white" : "bg-black/5 text-brand-dark",
            )}
            aria-label="Buscar por voz"
          >
            <Mic className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-[11px] text-muted">
          Mín
          <input
            type="number"
            min={0}
            className="h-8 w-16 rounded-lg border border-black/10 bg-card px-1 text-xs"
            value={filters.presupuestoMin ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? null : Number(e.target.value);
              apply({
                ...filters,
                presupuestoMin:
                  v != null && Number.isFinite(v) ? v : null,
              });
            }}
          />
        </label>
        <label className="flex items-center gap-1 text-[11px] text-muted">
          Máx
          <input
            type="number"
            min={0}
            className="h-8 w-16 rounded-lg border border-black/10 bg-card px-1 text-xs"
            value={filters.presupuestoMax ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? null : Number(e.target.value);
              apply({
                ...filters,
                presupuestoMax:
                  v != null && Number.isFinite(v) ? v : null,
              });
            }}
          />
        </label>
        {busy ? (
          <span className="text-[10px] text-muted">Entendiendo…</span>
        ) : null}
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => removeChip(c.key)}
              className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/5 px-2.5 py-1 text-[11px] font-medium text-brand-dark"
            >
              {c.label}
              <X className="size-3 opacity-70" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function dishMatchesFilters(
  dish: { name: string; description?: string | null; price: number },
  filters: MenuSearchFilters,
): boolean {
  if (
    filters.presupuestoMin != null &&
    dish.price < filters.presupuestoMin
  ) {
    return false;
  }
  if (
    filters.presupuestoMax != null &&
    dish.price > filters.presupuestoMax
  ) {
    return false;
  }
  const hay = `${dish.name} ${dish.description ?? ""}`.toLowerCase();
  if (filters.query) {
    const tokens = filters.query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.every((t) => hay.includes(t))) return false;
  }
  for (const tag of filters.tags) {
    if (!hay.includes(tag.toLowerCase())) return false;
  }
  return true;
}
