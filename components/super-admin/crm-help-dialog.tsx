"use client";

import { CircleHelp } from "lucide-react";
import { crmHelp } from "@/lib/crm-help";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CrmHelpDialog({
  helpId,
  label,
  variant = "icon",
}: {
  helpId: string;
  label?: string;
  variant?: "icon" | "text";
}) {
  const entry = crmHelp(helpId);
  return (
    <Dialog>
      <DialogTrigger asChild>
        {variant === "text" ? (
          <button
            type="button"
            className="text-xs font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
          >
            {label ?? "Cómo leer el CRM"}
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-black/5 hover:text-foreground"
            aria-label={label ?? `Ayuda: ${entry.title}`}
          >
            <CircleHelp className="h-4 w-4" />
          </button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry.title}</DialogTitle>
          <DialogDescription>{entry.what}</DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          <span className="font-semibold">Cómo se calcula. </span>
          {entry.how}
        </p>
        <p className="text-sm">
          <span className="font-semibold">Si se ve mal. </span>
          {entry.ifBad}
        </p>
      </DialogContent>
    </Dialog>
  );
}
