"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type PublicFaq = {
  id: string;
  question: string;
  answer: string;
};

export function MenuFaqs({ faqs }: { faqs: PublicFaq[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (!faqs.length) return null;

  return (
    <section id="faqs" className="mx-auto max-w-lg scroll-mt-20 px-4 py-6">
      <div className="mb-3 flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-brand" />
        <h2 className="text-base font-semibold">Preguntas frecuentes</h2>
      </div>
      <ul className="space-y-2">
        {faqs.map((f) => {
          const open = openId === f.id;
          return (
            <li
              key={f.id}
              className="rounded-xl border border-black/5 bg-surface/80"
            >
              <button
                type="button"
                className="flex w-full min-h-11 items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold"
                onClick={() => setOpenId(open ? null : f.id)}
                aria-expanded={open}
              >
                {f.question}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted transition-transform",
                    open && "rotate-180",
                  )}
                />
              </button>
              {open ? (
                <p className="border-t border-black/5 px-3 py-2.5 text-sm text-muted leading-relaxed">
                  {f.answer}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
