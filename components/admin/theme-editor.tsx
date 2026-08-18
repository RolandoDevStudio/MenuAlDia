"use client";

import { useState } from "react";
import {
  FRAME_LABELS,
  PRESET_LABELS,
  THEME_PRESETS,
  parseThemeConfig,
  photoFrameClass,
  themeToCssVars,
  type PhotoFrame,
  type ThemeConfig,
} from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  value: ThemeConfig | Record<string, unknown> | null | undefined;
  onChange: (theme: ThemeConfig) => void;
};

export function ThemeEditor({ value, onChange }: Props) {
  const [theme, setTheme] = useState<ThemeConfig>(() => parseThemeConfig(value));

  function apply(next: ThemeConfig) {
    setTheme(next);
    onChange(next);
  }

  function selectPreset(key: string) {
    const preset = THEME_PRESETS[key];
    if (preset) apply({ ...preset });
  }

  const vars = themeToCssVars(theme);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Personalización visual</h2>
        <p className="text-xs text-muted">
          Elige un preset. Se aplica al menú público al guardar ajustes.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {Object.keys(THEME_PRESETS).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => selectPreset(key)}
            className={cn(
              "rounded-xl border px-3 py-3 text-left text-sm font-medium",
              theme.preset === key
                ? "border-brand bg-brand/5 text-brand-dark"
                : "border-black/10 bg-surface",
            )}
          >
            <span
              className="mb-2 block h-3 w-full rounded-full"
              style={{ background: THEME_PRESETS[key].colors.primary }}
            />
            {PRESET_LABELS[key] ?? key}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label>Marco de fotos</Label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(FRAME_LABELS) as PhotoFrame[]).map((frame) => (
            <button
              key={frame}
              type="button"
              onClick={() => apply({ ...theme, photoFrame: frame })}
              className={cn(
                "min-h-11 rounded-xl border px-3 py-2 text-xs font-medium",
                theme.photoFrame === frame
                  ? "border-brand bg-brand/5"
                  : "border-black/10 bg-surface",
              )}
            >
              {FRAME_LABELS[frame]}
            </button>
          ))}
        </div>
      </div>

      <div
        className="rounded-2xl border border-black/10 p-4"
        style={vars}
      >
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
          Vista previa
        </p>
        <p
          className="mt-1 font-[family-name:var(--font-display)] text-3xl"
          style={{ color: "var(--color-primary)" }}
        >
          Tu negocio
        </p>
        <div
          className="mt-3 flex items-center gap-3 rounded-xl p-3"
          style={{ background: "var(--color-card)" }}
        >
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center bg-black/5 text-lg",
              photoFrameClass(theme.photoFrame),
            )}
            style={{ color: "var(--color-primary)" }}
          >
            M
          </div>
          <div>
            <p className="font-semibold" style={{ color: "var(--color-text)" }}>
              Platillo ejemplo
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-2"
              style={{ background: "var(--color-primary)" }}
            >
              Agregar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
