"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  title: string;
  hint?: string | null;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** Keep children in the DOM when closed (needed for uncontrolled form fields). */
  keepMounted?: boolean;
  nested?: boolean;
};

export function SettingsAccordionItem({
  id,
  title,
  hint,
  open,
  onToggle,
  children,
  keepMounted = true,
  nested = false,
}: Props) {
  const panelId = `${id}-panel`;
  const body = (
    <div
      id={panelId}
      hidden={keepMounted ? !open : undefined}
      role="region"
      aria-labelledby={`${id}-trigger`}
      className={cn(
        "border-t border-black/5",
        nested ? "px-3 pb-3 pt-2" : "px-4 pb-4 pt-3",
      )}
    >
      {children}
    </div>
  );

  const TitleTag = nested ? "h3" : "h2";

  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-20 overflow-hidden rounded-xl border bg-surface",
        open
          ? nested
            ? "border-brand/20 bg-background"
            : "border-brand/25 shadow-sm"
          : "border-black/5",
      )}
    >
      <TitleTag className="text-inherit">
        <button
          type="button"
          id={`${id}-trigger`}
          aria-expanded={open}
          aria-controls={panelId}
          className={cn(
            "flex w-full items-center justify-between gap-3 text-left",
            nested ? "min-h-11 px-3 py-2.5" : "min-h-12 px-4 py-3",
          )}
          onClick={onToggle}
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{title}</span>
            {hint ? (
              <span className="mt-0.5 block truncate text-xs font-normal text-muted">
                {hint}
              </span>
            ) : null}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted transition-transform duration-200",
              open && "rotate-180 text-brand",
            )}
            aria-hidden
          />
        </button>
      </TitleTag>
      {keepMounted ? body : open ? body : null}
    </section>
  );
}
