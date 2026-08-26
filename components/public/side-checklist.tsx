"use client";

import type { Dish } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type Props = {
  sides: Dish[];
  maxSides: number;
  value: string[];
  onChange: (ids: string[]) => void;
  sidesLabel?: string;
  sideLabel?: string;
};

export function SideChecklist({
  sides,
  maxSides,
  value,
  onChange,
  sidesLabel = "Guarniciones",
  sideLabel = "Guarnición",
}: Props) {
  const atMax = value.length >= maxSides;
  const countWord = (maxSides === 1 ? sideLabel : sidesLabel).toLowerCase();

  function toggle(id: string, on: boolean) {
    if (on) {
      if (value.length >= maxSides) return;
      onChange([...value, id]);
    } else {
      onChange(value.filter((x) => x !== id));
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold">
        {sidesLabel}{" "}
        <span className="font-normal text-muted">
          (elige hasta {maxSides} {countWord}
          {value.length > 0 ? ` · ${value.length}/${maxSides}` : ""})
        </span>
      </p>
      {atMax ? (
        <p className="mt-1 text-xs text-brand-dark" role="status">
          Máximo {maxSides} {countWord}.{" "}
          {maxSides === 1
            ? "Desmarca para cambiar."
            : "Desmarca una para cambiar."}
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted">
          Opcional — puedes elegir hasta {maxSides} {countWord}.
        </p>
      )}
      <ul className="mt-2 space-y-2">
        {sides.map((side) => {
          const checked = value.includes(side.id);
          const disabled = !checked && atMax;
          return (
            <li key={side.id}>
              <label
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-black/5 bg-surface px-3 py-2.5",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(v) => toggle(side.id, v === true)}
                />
                <span
                  className={cn("text-sm font-medium", disabled && "text-muted")}
                >
                  {side.name}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
