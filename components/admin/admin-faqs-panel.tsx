"use client";

import { useCallback, useEffect, useState } from "react";
import { faqTemplatesFor, MAX_ACTIVE_FAQS } from "@/lib/faq-templates";
import type { BusinessType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Emoji } from "@/components/ui-emoji";
import { UI_EMOJI } from "@/lib/ui-emoji";

type Faq = {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
};

export function AdminFaqsPanel({
  businessType,
}: {
  businessType: BusinessType | string | null;
}) {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const templates = faqTemplatesFor(businessType);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/faqs");
    const json = (await res.json()) as { faqs?: Faq[] };
    if (res.ok) setFaqs(json.faqs ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(q: string, a: string) {
    setError(null);
    const res = await fetch("/api/admin/faqs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, answer: a, is_active: true }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Error");
      return;
    }
    setQuestion("");
    setAnswer("");
    await load();
  }

  async function toggle(f: Faq) {
    const res = await fetch("/api/admin/faqs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: f.id, is_active: !f.is_active }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) setError(json.error ?? "Error");
    await load();
  }

  async function move(f: Faq, dir: -1 | 1) {
    const idx = faqs.findIndex((x) => x.id === f.id);
    const swap = faqs[idx + dir];
    if (!swap) return;
    await fetch("/api/admin/faqs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: f.id, sort_order: swap.sort_order }),
    });
    await fetch("/api/admin/faqs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: swap.id, sort_order: f.sort_order }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar esta pregunta?")) return;
    await fetch(`/api/admin/faqs?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await load();
  }

  const activeCount = faqs.filter((f) => f.is_active).length;

  return (
    <div id="faqs" className="space-y-3 rounded-xl border border-black/5 bg-surface p-4">
      <div>
        <h2 className="text-sm font-semibold">Preguntas frecuentes</h2>
        <p className="text-xs text-muted">
          Se muestran al final de tu menú público. Máx. {MAX_ACTIVE_FAQS}{" "}
          activas ({activeCount}/{MAX_ACTIVE_FAQS}).
        </p>
      </div>

      {templates.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted">Plantillas del giro</p>
          <div className="flex flex-wrap gap-1">
            {templates.map((t) => (
              <Button
                key={t.question}
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-[11px]"
                onClick={() => {
                  setQuestion(t.question);
                  setAnswer(t.answer);
                }}
              >
                {t.question.slice(0, 36)}…
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Pregunta</Label>
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} />
        <Label>Respuesta</Label>
        <Textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={3}
        />
        <Button
          type="button"
          size="sm"
          onClick={() => void create(question, answer)}
        >
          <Emoji char={UI_EMOJI.create} />
          Agregar
        </Button>
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <ul className="space-y-2">
        {faqs.map((f) => (
          <li
            key={f.id}
            className="rounded-lg border border-black/5 bg-background px-3 py-2 text-xs"
          >
            <p className="font-semibold">{f.question}</p>
            <p className="mt-0.5 text-muted line-clamp-2">{f.answer}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7"
                onClick={() => void move(f, -1)}
              >
                ↑
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7"
                onClick={() => void move(f, 1)}
              >
                ↓
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => void toggle(f)}
              >
                {f.is_active ? "Activa" : "Off"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-red-700"
                onClick={() => void remove(f.id)}
              >
                Eliminar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
