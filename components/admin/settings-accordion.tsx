"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function scrollSettingsSectionIntoView(id: string) {
  const node = document.getElementById(id);
  if (!node) return;
  const header = document.querySelector<HTMLElement>("[data-admin-header]");
  const headerH = header?.getBoundingClientRect().height ?? 80;
  const y = window.scrollY + node.getBoundingClientRect().top - headerH - 8;
  window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
}

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
  unsaved?: boolean;
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
  unsaved = false,
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
        "scroll-mt-[calc(var(--admin-header-h,5rem)+0.5rem)] overflow-hidden rounded-xl border bg-surface",
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
            <span className="flex items-center gap-1.5">
              <span className="block text-sm font-semibold">{title}</span>
              {unsaved ? (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600"
                  title="Cambios sin guardar"
                  aria-label="Cambios sin guardar"
                />
              ) : null}
            </span>
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
