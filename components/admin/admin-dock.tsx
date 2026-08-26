"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Emoji } from "@/components/ui-emoji";
import { UI_EMOJI } from "@/lib/ui-emoji";
import { cn } from "@/lib/utils";

export type AdminDockSave = {
  formId: string;
  label: string;
  disabled?: boolean;
  pending?: boolean;
};

const AdminDockContext = createContext<{
  setSave: (save: AdminDockSave | null) => void;
} | null>(null);

export function useAdminDockSave(save: AdminDockSave | null) {
  const ctx = useContext(AdminDockContext);
  const formId = save?.formId ?? null;
  const label = save?.label ?? null;
  const disabled = save?.disabled ?? false;
  const pending = save?.pending ?? false;

  useEffect(() => {
    if (!ctx) return;
    if (!formId || !label) {
      ctx.setSave(null);
      return () => ctx.setSave(null);
    }
    ctx.setSave({ formId, label, disabled, pending });
    return () => ctx.setSave(null);
  }, [ctx, formId, label, disabled, pending]);
}

export function AdminDockProvider({
  helpHref,
  className,
  children,
}: {
  helpHref: string | null;
  className?: string;
  children: ReactNode;
}) {
  const [save, setSaveState] = useState<AdminDockSave | null>(null);
  const setSave = useCallback((next: AdminDockSave | null) => {
    setSaveState(next);
  }, []);
  const value = useMemo(() => ({ setSave }), [setSave]);
  const showDock = Boolean(save || helpHref);

  return (
    <AdminDockContext.Provider value={value}>
      <div
        className={cn(
          className,
          showDock
            ? "pb-[calc(8.25rem+env(safe-area-inset-bottom))]"
            : "pb-[calc(5.5rem+env(safe-area-inset-bottom))]",
          "print:pb-0",
        )}
      >
        {children}
      </div>
      <AdminChromeDock save={save} helpHref={helpHref} />
    </AdminDockContext.Provider>
  );
}

function AdminChromeDock({
  save,
  helpHref,
}: {
  save: AdminDockSave | null;
  helpHref: string | null;
}) {
  if (!save && !helpHref) return null;

  return (
    <div
      className="fixed inset-x-0 z-40 border-t border-black/10 bg-surface/95 backdrop-blur print:hidden"
      style={{
        bottom: "calc(3.25rem + max(0.5rem, env(safe-area-inset-bottom)))",
      }}
    >
      <div
        className={cn(
          "mx-auto flex max-w-lg items-center gap-2 px-3 py-1.5 md:max-w-2xl lg:max-w-5xl",
          !save && "justify-end",
        )}
      >
        {save ? (
          <Button
            type="submit"
            form={save.formId}
            size="sm"
            className="h-9 min-h-9 flex-1 px-3 text-sm"
            disabled={save.disabled}
          >
            {save.pending ? (
              "Guardando…"
            ) : (
              <>
                <Emoji char={UI_EMOJI.save} />
                <span className="sm:hidden">Guardar</span>
                <span className="hidden sm:inline">{save.label}</span>
              </>
            )}
          </Button>
        ) : null}
        {helpHref ? (
          <Button
            asChild
            size="sm"
            variant={save ? "outline" : "secondary"}
            className="h-9 min-h-9 shrink-0 px-2.5 text-xs font-medium"
          >
            <a
              href={helpHref}
              target="_blank"
              rel="noopener noreferrer"
              title="¿Te ayudo a dejarlo listo?"
              aria-label="¿Te ayudo a dejarlo listo?"
            >
              ¿Te ayudo?
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
