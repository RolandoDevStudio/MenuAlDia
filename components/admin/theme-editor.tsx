"use client";

import { useEffect, useRef, useState } from "react";
import {
  BACKGROUND_OVERLAY_LABELS,
  FRAME_LABELS,
  PRESET_LABELS,
  THEME_PRESETS,
  parseThemeConfig,
  photoFrameClass,
  themeToCssVars,
  type BackgroundOverlay,
  type PhotoFrame,
  type ThemeConfig,
} from "@/lib/theme";
import { label, normalizeBusinessType } from "@/lib/business-labels";
import type { BusinessType } from "@/lib/types";
import { DishPhotoUpload } from "@/components/admin/dish-photo-upload";
import { BackgroundCropPicker } from "@/components/admin/background-crop-picker";
import { AiImageGenerator } from "@/components/admin/ai-image-generator";
import { SettingsAccordionItem } from "@/components/admin/settings-accordion";
import { StorageImage } from "@/components/ui/storage-image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type AppearanceFold = "estilo" | "flyer" | "banner" | "fondo";

type Props = {
  value: ThemeConfig | Record<string, unknown> | null | undefined;
  onChange: (theme: ThemeConfig) => void;
  restaurantId?: string;
  logoUrl?: string | null;
  businessType?: BusinessType | string | null;
};

function assetHint(url?: string | null, empty = "Sin imagen"): string {
  return url?.trim() ? "Imagen lista" : empty;
}

export function ThemeEditor({
  value,
  onChange,
  restaurantId,
  logoUrl,
  businessType,
}: Props) {
  const [theme, setTheme] = useState<ThemeConfig>(() => parseThemeConfig(value));
  const [fold, setFold] = useState<AppearanceFold>("estilo");
  const prevFold = useRef<AppearanceFold | undefined>(undefined);
  const exampleLabel = `${label(businessType, "dish")} ejemplo`;
  const giro = normalizeBusinessType(businessType);

  useEffect(() => {
    const prev = prevFold.current;
    prevFold.current = fold;
    if (prev === undefined || prev === fold) return;
    const node = document.getElementById(`look-${fold}`);
    if (!node) return;
    const frame = window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fold]);

  function apply(next: ThemeConfig) {
    setTheme(next);
    onChange(next);
  }

  function selectPreset(key: string) {
    const preset = THEME_PRESETS[key];
    if (preset) {
      apply({
        ...preset,
        bannerUrl: theme.bannerUrl,
        ogImageUrl: theme.ogImageUrl,
        backgroundImageUrl: theme.backgroundImageUrl,
        useBackgroundImage: theme.useBackgroundImage,
        backgroundOverlay: theme.backgroundOverlay,
        backgroundFocusX: theme.backgroundFocusX,
        backgroundFocusY: theme.backgroundFocusY,
        backgroundDesktopFocusX: theme.backgroundDesktopFocusX,
        backgroundDesktopFocusY: theme.backgroundDesktopFocusY,
      });
    }
  }

  function toggleFold(id: AppearanceFold) {
    setFold(id);
  }

  const vars = themeToCssVars(theme);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Estilo, flyer de WhatsApp, banner y fondo son piezas distintas. Abre
        una, ajústala y guarda.
      </p>

      <div className="space-y-2">
        <SettingsAccordionItem
          id="look-estilo"
          nested
          keepMounted={false}
          title="Estilo del menú"
          hint={PRESET_LABELS[theme.preset] ?? theme.preset}
          open={fold === "estilo"}
          onToggle={() => toggleFold("estilo")}
        >
          <div className="space-y-4">
            <div>
              <Label>Paleta</Label>
              <p className="mb-2 text-[11px] text-muted">
                Se aplica al menú público al guardar.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(THEME_PRESETS).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectPreset(key)}
                    className={cn(
                      "min-h-11 rounded-xl border px-3 py-3 text-left text-sm font-medium",
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

            <div className="rounded-2xl border border-black/10 p-4" style={vars}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                Vista previa
              </p>
              <p
                className="mt-1 font-display text-3xl"
                style={{ color: "var(--color-primary)" }}
              >
                Tu negocio
              </p>
              <div
                className="mt-3 flex items-center gap-3 rounded-xl p-3"
                style={{ background: "var(--color-card)" }}
              >
                {logoUrl ? (
                  <StorageImage
                    src={logoUrl}
                    alt="Logo"
                    width={56}
                    height={56}
                    sizes="56px"
                    className={cn(
                      "h-14 w-14 object-cover",
                      photoFrameClass(theme.photoFrame),
                    )}
                  />
                ) : (
                  <div
                    className={cn(
                      "flex h-14 w-14 items-center justify-center bg-black/5 text-lg",
                      photoFrameClass(theme.photoFrame),
                    )}
                    style={{ color: "var(--color-primary)" }}
                  >
                    {giro === "servicios"
                      ? "S"
                      : giro === "productos"
                        ? "T"
                        : "M"}
                  </div>
                )}
                <div>
                  <p
                    className="font-semibold"
                    style={{ color: "var(--color-text)" }}
                  >
                    {exampleLabel}
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
        </SettingsAccordionItem>

        {restaurantId ? (
          <>
            <SettingsAccordionItem
              id="look-flyer"
              nested
              keepMounted={false}
              title="Flyer WhatsApp"
              hint={assetHint(theme.ogImageUrl, "Vista previa del enlace")}
              open={fold === "flyer"}
              onToggle={() => toggleFold("flyer")}
            >
              <div className="space-y-3">
                <p className="text-xs text-muted">
                  Al pegar el enlace del menú en WhatsApp sale esta imagen
                  (1080×1350). Sube un diseño de Canva o genera uno con IA.
                </p>
                <DishPhotoUpload
                  restaurantId={restaurantId}
                  value={theme.ogImageUrl ?? null}
                  onChange={(url) => apply({ ...theme, ogImageUrl: url })}
                  label="Subir imagen"
                  kind="og"
                  guide="og"
                  chooseLabel="Subir flyer"
                  changeLabel="Cambiar flyer"
                />
                <AiImageGenerator
                  restaurantId={restaurantId}
                  imageKind="flyer"
                  defaultPreset="flyer"
                  applyLabel="Usar el generado en WhatsApp"
                  onApplied={(url) => apply({ ...theme, ogImageUrl: url })}
                />
              </div>
            </SettingsAccordionItem>

            <SettingsAccordionItem
              id="look-banner"
              nested
              keepMounted={false}
              title="Banner del menú"
              hint={assetHint(theme.bannerUrl, "Franja superior del menú")}
              open={fold === "banner"}
              onToggle={() => toggleFold("banner")}
            >
              <div className="space-y-3">
                <p className="text-xs text-muted">
                  Solo se ve arriba del menú público, no en WhatsApp.
                </p>
                <DishPhotoUpload
                  restaurantId={restaurantId}
                  value={theme.bannerUrl ?? null}
                  onChange={(url) => apply({ ...theme, bannerUrl: url })}
                  label="Subir banner"
                  kind="banner"
                  guide="banner"
                />
                <AiImageGenerator
                  restaurantId={restaurantId}
                  imageKind="banner"
                  defaultPreset="banner"
                  applyLabel="Aplicar como banner"
                  onApplied={(url) => apply({ ...theme, bannerUrl: url })}
                />
              </div>
            </SettingsAccordionItem>

            <SettingsAccordionItem
              id="look-fondo"
              nested
              keepMounted={false}
              title="Imagen de fondo"
              hint={
                theme.useBackgroundImage && theme.backgroundImageUrl
                  ? "Activa en el menú"
                  : assetHint(theme.backgroundImageUrl, "Opcional")
              }
              open={fold === "fondo"}
              onToggle={() => toggleFold("fondo")}
            >
              <div className="space-y-3">
                <DishPhotoUpload
                  restaurantId={restaurantId}
                  value={theme.backgroundImageUrl ?? null}
                  onChange={(url) =>
                    apply({ ...theme, backgroundImageUrl: url })
                  }
                  label="Subir fondo"
                  kind="banner"
                  guide="background"
                />
                <AiImageGenerator
                  restaurantId={restaurantId}
                  imageKind="background"
                  defaultPreset="background"
                  applyLabel="Aplicar como fondo"
                  onApplied={(url) =>
                    apply({
                      ...theme,
                      backgroundImageUrl: url,
                      useBackgroundImage: true,
                    })
                  }
                />
                <div className="space-y-1">
                  <div className="flex min-h-11 items-center justify-between">
                    <Label htmlFor="useBg">Usar imagen de fondo</Label>
                    <Switch
                      id="useBg"
                      checked={Boolean(theme.useBackgroundImage)}
                      onCheckedChange={(v) =>
                        apply({ ...theme, useBackgroundImage: v })
                      }
                    />
                  </div>
                  <p className="text-[11px] text-muted">
                    La foto cubre toda la ventana. Eliges qué parte se ve en
                    computadora y celular. Guarda para verla en el menú público.
                  </p>
                </div>
                {theme.useBackgroundImage && theme.backgroundImageUrl ? (
                  <div className="space-y-4">
                    <BackgroundCropPicker
                      variant="desktop"
                      imageUrl={theme.backgroundImageUrl}
                      focusX={theme.backgroundDesktopFocusX ?? 50}
                      focusY={theme.backgroundDesktopFocusY ?? 50}
                      onChange={({ x, y }) =>
                        apply({
                          ...theme,
                          backgroundDesktopFocusX: x,
                          backgroundDesktopFocusY: y,
                        })
                      }
                    />
                    <BackgroundCropPicker
                      variant="mobile"
                      imageUrl={theme.backgroundImageUrl}
                      focusX={theme.backgroundFocusX ?? 50}
                      focusY={theme.backgroundFocusY ?? 50}
                      onChange={({ x, y }) =>
                        apply({
                          ...theme,
                          backgroundFocusX: x,
                          backgroundFocusY: y,
                        })
                      }
                    />
                  </div>
                ) : null}
                {theme.useBackgroundImage ? (
                  <div className="space-y-1.5">
                    <Label>Velo sobre la foto</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        Object.keys(
                          BACKGROUND_OVERLAY_LABELS,
                        ) as BackgroundOverlay[]
                      ).map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() =>
                            apply({ ...theme, backgroundOverlay: key })
                          }
                          className={cn(
                            "min-h-11 rounded-xl border px-2 text-sm font-medium",
                            (theme.backgroundOverlay ?? "medium") === key
                              ? "border-brand bg-brand/5 text-brand-dark"
                              : "border-black/10 bg-background",
                          )}
                        >
                          {BACKGROUND_OVERLAY_LABELS[key]}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted">
                      Suave deja ver más la foto. Fuerte calma fondos
                      recargados.
                    </p>
                  </div>
                ) : null}
              </div>
            </SettingsAccordionItem>
          </>
        ) : null}
      </div>
    </div>
  );
}
