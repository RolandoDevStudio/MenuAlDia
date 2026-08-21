"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Download, Library, Settings2, Trash2 } from "lucide-react";
import { toPng, getFontEmbedCSS } from "html-to-image";
import type { Dish, Restaurant } from "@/lib/types";
import {
  FLYER_ASPECT_SIZE,
  WEEKDAYS_ES,
  defaultFlyerOptions,
  dishToSnap,
  formatWhatsappDisplay,
  type FlyerAspect,
  type FlyerBullet,
  type FlyerEditorOptions,
  type FlyerFrameStyle,
  type FlyerLayoutPreset,
  type FlyerObjectFit,
  type FlyerPriceBadge,
  type FlyerPriceMode,
  type FlyerTextScale,
  type FlyerLogoScale,
} from "@/lib/flyer-types";
import {
  FLYER_THEME_LIST,
  getFlyerTheme,
  type FlyerThemePackId,
} from "@/lib/flyer-themes";
import { FlyerPreview } from "@/components/flyer/flyer-preview";
import { FlyerExportButton } from "@/components/flyer/flyer-export-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { cn } from "@/lib/utils";
import { formatMxn } from "@/lib/money";

type LibraryFlyer = {
  id: string;
  title: string;
  subtitle: string;
  headline: string;
  weekday_label: string;
  aspect: string;
  price_mode: string;
  package_price: number | null;
  png_path: string | null;
  created_at: string;
};

type Props = {
  restaurant: Restaurant;
  dishes: Dish[];
  sides: Dish[];
  packagePrice: number;
  initialHeadline?: string;
  sidesTitle?: string;
  fromToday?: boolean;
  sourceLabel?: string;
};

const ASPECTS: { value: FlyerAspect; label: string }[] = [
  { value: "story_9_16", label: "Story 9:16" },
  { value: "feed_4_5", label: "Feed 4:5" },
  { value: "square_1_1", label: "Cuadrado" },
  { value: "landscape_16_9", label: "Horizontal" },
];

const LAYOUTS: { value: FlyerLayoutPreset; label: string }[] = [
  { value: "grid_2x2", label: "Collage" },
  { value: "hero_list", label: "Héroe + lista" },
  { value: "text_only", label: "Solo texto" },
];

type MobileTab = "edit" | "library";

export function FlyerStudio({
  restaurant,
  dishes,
  sides,
  packagePrice: initialPrice,
  initialHeadline,
  sidesTitle = "Guarniciones",
  fromToday,
  sourceLabel,
}: Props) {
  const [options, setOptions] = useState<FlyerEditorOptions>(() =>
    defaultFlyerOptions({
      headline: initialHeadline ?? "ESPECIALES DE HOY",
      subtitle: restaurant.slogan ?? "",
      showFreeShipping:
        restaurant.free_shipping || Number(restaurant.shipping_cost) === 0,
      showWhatsapp: Boolean(formatWhatsappDisplay(restaurant.phone_whatsapp)),
    }),
  );
  const [packagePrice, setPackagePrice] = useState(initialPrice);
  const [activeMainIds, setActiveMainIds] = useState<string[]>(() =>
    dishes.filter((d) => !d.is_side).map((d) => d.id),
  );
  const [activeSideIds, setActiveSideIds] = useState<string[]>(() =>
    sides.map((d) => d.id),
  );
  const [mobileTab, setMobileTab] = useState<MobileTab>("edit");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [library, setLibrary] = useState<LibraryFlyer[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [libMsg, setLibMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const autoSavedRef = useRef(false);

  const phone = formatWhatsappDisplay(restaurant.phone_whatsapp);
  const hasWa = Boolean(phone);

  const selectedDishes = useMemo(
    () => dishes.filter((d) => activeMainIds.includes(d.id)),
    [dishes, activeMainIds],
  );
  const selectedSides = useMemo(
    () => sides.filter((d) => activeSideIds.includes(d.id)),
    [sides, activeSideIds],
  );

  function patch(partial: Partial<FlyerEditorOptions>) {
    autoSavedRef.current = false;
    setOptions((o) => ({ ...o, ...partial }));
  }

  async function capturePng(): Promise<string> {
    const node = document.getElementById("flyer-canvas");
    if (!node) throw new Error("No se encontró el flyer");
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    const size = FLYER_ASPECT_SIZE[options.aspect];
    const fontEmbedCSS = await getFontEmbedCSS(node);
    const theme = getFlyerTheme(options.themePack);
    return toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: theme.exportBg,
      width: size.w,
      height: size.h,
      fontEmbedCSS,
      skipFonts: false,
    });
  }

  const loadLibrary = useCallback(async () => {
    setLibLoading(true);
    try {
      const res = await fetch("/api/admin/flyers");
      const json = (await res.json()) as {
        flyers?: LibraryFlyer[];
        error?: string;
      };
      if (!res.ok) {
        setLibMsg(json.error ?? "No se pudo cargar la biblioteca");
        return;
      }
      setLibrary(json.flyers ?? []);
      setLibMsg(null);
    } catch {
      setLibMsg("No se pudo cargar la biblioteca");
    } finally {
      setLibLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  async function saveToLibrary(dataUrl?: string) {
    setSaving(true);
    setLibMsg(null);
    try {
      const pngData = dataUrl ?? (await capturePng());
      let pngPath: string | null = null;
      try {
        const blob = await (await fetch(pngData)).blob();
        const file = new File([blob], "flyer.png", { type: "image/png" });
        const compressed = await compressImage(file, "flyer");
        const supabase = createClient();
        const path = `${restaurant.id}/flyers/${crypto.randomUUID()}.webp`;
        const { error: upErr } = await supabase.storage
          .from("dish-photos")
          .upload(path, compressed, {
            upsert: true,
            contentType: "image/webp",
            cacheControl: "31536000",
          });
        if (upErr) {
          setLibMsg(
            `No se subió la imagen: ${upErr.message}. Intenta de nuevo.`,
          );
        } else {
          const { data } = supabase.storage
            .from("dish-photos")
            .getPublicUrl(path);
          pngPath = data.publicUrl;
        }
      } catch (e) {
        setLibMsg(
          e instanceof Error
            ? `No se subió la imagen: ${e.message}`
            : "No se subió la imagen",
        );
      }

      const res = await fetch("/api/admin/flyers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: options.headline || restaurant.name,
          subtitle: options.subtitle,
          headline: options.headline,
          weekday_label: options.weekdayLabel,
          aspect: options.aspect,
          price_mode: options.priceMode,
          package_price:
            options.priceMode === "package" ? packagePrice : null,
          options_json: options,
          items_json: [
            ...selectedDishes.map(dishToSnap),
            ...selectedSides.map(dishToSnap),
          ],
          png_path: pngPath,
          source: "studio",
          is_active: true,
        }),
      });
      const json = (await res.json()) as { error?: string; quota?: boolean };
      if (!res.ok) {
        setLibMsg(
          json.quota
            ? "Límite de 20 flyers. Elimina uno de la biblioteca."
            : (json.error ?? "No se pudo guardar"),
        );
        return;
      }
      autoSavedRef.current = true;
      setLibMsg(
        pngPath
          ? "Guardado en biblioteca"
          : "Guardado (sin miniatura; la imagen no subió)",
      );
      void loadLibrary();
    } catch (e) {
      setLibMsg(
        e instanceof Error
          ? `No se guardó en biblioteca: ${e.message}`
          : "No se guardó en biblioteca",
      );
    } finally {
      setSaving(false);
    }
  }

  function onAfterLocalExport(_action: string, dataUrl: string) {
    // Local-first: export already delivered. One background save per edit set.
    if (autoSavedRef.current) return;
    void saveToLibrary(dataUrl);
  }

  async function deleteFlyer(id: string) {
    if (!confirm("¿Eliminar este flyer de la biblioteca?")) return;
    const res = await fetch(`/api/admin/flyers?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setLibMsg(json.error ?? "No se pudo eliminar");
      return;
    }
    setLibrary((list) => list.filter((f) => f.id !== id));
  }

  async function downloadLibraryFlyer(f: LibraryFlyer) {
    if (!f.png_path) {
      setLibMsg("Este flyer no tiene imagen guardada");
      return;
    }
    try {
      const res = await fetch(f.png_path, { mode: "cors" });
      if (!res.ok) throw new Error("No se pudo obtener la imagen");
      const blob = await res.blob();
      const ext = blob.type.includes("webp")
        ? "webp"
        : blob.type.includes("jpeg")
          ? "jpg"
          : "png";
      const date = f.created_at.slice(0, 10);
      const base = (f.headline || f.title || "flyer")
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúñü]+/gi, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${base || "flyer"}-${date}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      setLibMsg("Flyer descargado");
      void fetch("/api/admin/flyer-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          action: "download",
        }),
      });
    } catch {
      setLibMsg("No se pudo descargar. Abre la miniatura o vuelve a guardar.");
    }
  }

  function toggleId(
    id: string,
    list: string[],
    setList: (v: string[]) => void,
  ) {
    setList(
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    );
  }

  const controls = (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="flyer-weekday">Día</Label>
          <select
            id="flyer-weekday"
            className="flex h-11 w-full rounded-lg border border-black/10 bg-surface px-3 text-sm"
            value={options.weekdayLabel}
            onChange={(e) => patch({ weekdayLabel: e.target.value })}
          >
            {WEEKDAYS_ES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="flyer-headline">Título</Label>
          <Input
            id="flyer-headline"
            value={options.headline}
            onChange={(e) => patch({ headline: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="flyer-subtitle">Subtítulo</Label>
        <Input
          id="flyer-subtitle"
          value={options.subtitle}
          placeholder={restaurant.slogan || "Sabor casero"}
          onChange={(e) => patch({ subtitle: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Estilo visual</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FLYER_THEME_LIST.map((pack) => (
            <button
              key={pack.id}
              type="button"
              onClick={() =>
                patch({
                  themePack: pack.id as FlyerThemePackId,
                  // Soft defaults that match the skin without locking controls
                  ...(pack.id === "urbano_pizarra"
                    ? { bullet: "star" as const, priceBadge: "ribbon" as const }
                    : {
                        bullet: "check" as const,
                        priceBadge: "circle" as const,
                      }),
                })
              }
              className={cn(
                "min-h-14 rounded-xl border px-3 py-2.5 text-left transition-colors",
                options.themePack === pack.id
                  ? "border-brand bg-brand/10"
                  : "border-black/10 bg-surface",
              )}
            >
              <span
                className="mb-1.5 block h-2.5 w-full rounded-full"
                style={{ background: pack.accent }}
              />
              <span className="block text-sm font-semibold">{pack.label}</span>
              <span className="block text-xs text-muted">{pack.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Formato</Label>
        <div className="flex flex-wrap gap-2">
          {ASPECTS.map((a) => (
            <Chip
              key={a.value}
              active={options.aspect === a.value}
              onClick={() => patch({ aspect: a.value })}
            >
              {a.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Layout</Label>
        <div className="flex flex-wrap gap-2">
          {LAYOUTS.map((l) => (
            <Chip
              key={l.value}
              active={options.layout === l.value}
              onClick={() => patch({ layout: l.value })}
            >
              {l.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Precio</Label>
        <div className="flex flex-wrap gap-2">
          <Chip
            active={options.priceMode === "package"}
            onClick={() => patch({ priceMode: "package" as FlyerPriceMode })}
          >
            Paquete
          </Chip>
          <Chip
            active={options.priceMode === "per_item"}
            onClick={() => patch({ priceMode: "per_item" as FlyerPriceMode })}
          >
            Por ítem
          </Chip>
        </div>
        {options.priceMode === "package" ? (
          <div className="mt-2 flex items-center gap-2">
            <Input
              type="number"
              min={0}
              step={1}
              className="max-w-[140px]"
              value={packagePrice}
              onChange={(e) => setPackagePrice(Number(e.target.value) || 0)}
            />
            <span className="text-sm text-muted">{formatMxn(packagePrice)}</span>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <OptionGroup label="Texto">
          {(["sm", "md", "lg"] as FlyerTextScale[]).map((v) => (
            <Chip
              key={v}
              active={options.textScale === v}
              onClick={() => patch({ textScale: v })}
            >
              {v === "sm" ? "Chico" : v === "md" ? "Medio" : "Grande"}
            </Chip>
          ))}
        </OptionGroup>
        <OptionGroup label="Logo">
          {(["off", "sm", "md", "lg"] as FlyerLogoScale[]).map((v) => (
            <Chip
              key={v}
              active={options.logoScale === v}
              onClick={() => patch({ logoScale: v })}
            >
              {v === "off"
                ? "Oculto"
                : v === "sm"
                  ? "Chico"
                  : v === "md"
                    ? "Medio"
                    : "Grande"}
            </Chip>
          ))}
        </OptionGroup>
        <OptionGroup label="Viñetas">
          {(["check", "star"] as FlyerBullet[]).map((v) => (
            <Chip
              key={v}
              active={options.bullet === v}
              onClick={() => patch({ bullet: v })}
            >
              {v === "check" ? "✓" : "★"}
            </Chip>
          ))}
        </OptionGroup>
        <OptionGroup label="Marco foto">
          {(["rect", "polaroid"] as FlyerFrameStyle[]).map((v) => (
            <Chip
              key={v}
              active={options.frameStyle === v}
              onClick={() => patch({ frameStyle: v })}
            >
              {v === "rect" ? "Recto" : "Polaroid"}
            </Chip>
          ))}
        </OptionGroup>
        <OptionGroup label="Recorte">
          {(["cover", "contain"] as FlyerObjectFit[]).map((v) => (
            <Chip
              key={v}
              active={options.objectFit === v}
              onClick={() => patch({ objectFit: v })}
            >
              {v === "cover" ? "Cover" : "Contain"}
            </Chip>
          ))}
        </OptionGroup>
        {options.priceMode === "package" ? (
          <OptionGroup label="Badge precio">
            {(["circle", "ribbon"] as FlyerPriceBadge[]).map((v) => (
              <Chip
                key={v}
                active={options.priceBadge === v}
                onClick={() => patch({ priceBadge: v })}
              >
                {v === "circle" ? "Círculo" : "Listón"}
              </Chip>
            ))}
          </OptionGroup>
        ) : null}
      </div>

      <div className="space-y-3 rounded-xl border border-black/5 bg-surface p-3">
        <ToggleRow
          label="Mostrar guarniciones"
          checked={options.showSides}
          onChange={(v) => patch({ showSides: v })}
        />
        <ToggleRow
          label="Envío gratis"
          checked={options.showFreeShipping}
          onChange={(v) => patch({ showFreeShipping: v })}
        />
        <ToggleRow
          label="WhatsApp"
          checked={options.showWhatsapp && hasWa}
          disabled={!hasWa}
          onChange={(v) => patch({ showWhatsapp: v })}
        />
        {!hasWa ? (
          <p className="text-xs text-muted">
            Configura el número en{" "}
            <Link href="/admin/settings" className="font-semibold text-brand">
              Ajustes
            </Link>{" "}
            para el sello de WhatsApp.
          </p>
        ) : (
          <p className="text-xs text-muted">WA: {phone}</p>
        )}
      </div>

      {dishes.length > 0 ? (
        <div className="space-y-2">
          <Label>Platillos en el flyer</Label>
          <div className="flex flex-wrap gap-2">
            {dishes
              .filter((d) => !d.is_side)
              .map((d) => (
                <Chip
                  key={d.id}
                  active={activeMainIds.includes(d.id)}
                  onClick={() =>
                    toggleId(d.id, activeMainIds, setActiveMainIds)
                  }
                >
                  {d.name}
                </Chip>
              ))}
          </div>
        </div>
      ) : null}

      {sides.length > 0 ? (
        <div className="space-y-2">
          <Label>Guarniciones</Label>
          <div className="flex flex-wrap gap-2">
            {sides.map((d) => (
              <Chip
                key={d.id}
                active={activeSideIds.includes(d.id)}
                onClick={() => toggleId(d.id, activeSideIds, setActiveSideIds)}
              >
                {d.name}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        variant="secondary"
        className="min-h-11 w-full"
        disabled={saving}
        onClick={() => void saveToLibrary()}
      >
        {saving ? "Guardando…" : "Guardar en biblioteca"}
      </Button>
      {libMsg ? (
        <p className="text-xs text-muted" role="status">
          {libMsg}
        </p>
      ) : null}
    </div>
  );

  const libraryPanel = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Biblioteca ({library.length}/20)
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void loadLibrary()}
          disabled={libLoading}
        >
          Actualizar
        </Button>
      </div>
      {libLoading && library.length === 0 ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : library.length === 0 ? (
        <p className="text-sm text-muted">
          Aún no hay flyers guardados. Descarga o pulsa “Guardar en biblioteca”.
        </p>
      ) : (
        <ul className="space-y-2">
          {library.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded-xl border border-black/5 bg-surface p-2"
            >
              {f.png_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.png_path}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-black/5 text-xs text-muted">
                  —
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {f.headline || f.title || "Flyer"}
                </p>
                <p className="text-xs text-muted">
                  {f.weekday_label} ·{" "}
                  {new Date(f.created_at).toLocaleDateString("es-MX")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!f.png_path}
                  onClick={() => void downloadLibraryFlyer(f)}
                  aria-label="Descargar"
                  title={
                    f.png_path
                      ? "Descargar"
                      : "Sin imagen guardada"
                  }
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => void deleteFlyer(f.id)}
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">
          {fromToday ? "Flyer — Especiales de hoy" : "Generar Flyer"}
        </h1>
        <p className="text-sm text-muted">
          {sourceLabel ??
            "Ajusta el volante y descarga, comparte o copia para WhatsApp."}
          {restaurant.logo_url ? " Logo incluido." : ""}
        </p>
      </div>

      <FlyerExportButton
        slug={restaurant.slug}
        restaurantId={restaurant.id}
        aspect={options.aspect}
        backgroundColor={getFlyerTheme(options.themePack).exportBg}
        onAfterLocalExport={onAfterLocalExport}
      />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 lg:items-start">
        <FlyerPreview
          restaurant={restaurant}
          dishes={selectedDishes}
          sides={selectedSides}
          packagePrice={packagePrice}
          options={options}
          sidesTitle={sidesTitle}
        />

        {/* Desktop side panel */}
        <div className="mt-4 hidden lg:block space-y-6">
          <div>
            <p className="mb-3 text-sm font-semibold">Controles</p>
            {controls}
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold">Biblioteca</p>
            {libraryPanel}
          </div>
        </div>
      </div>

      {/* Mobile tabs + bottom sheet */}
      <div className="lg:hidden">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mobileTab === "edit" ? "default" : "secondary"}
            className="min-h-11 flex-1"
            onClick={() => {
              setMobileTab("edit");
              setSheetOpen(true);
            }}
          >
            <Settings2 className="h-4 w-4" />
            Ajustes
          </Button>
          <Button
            type="button"
            variant={mobileTab === "library" ? "default" : "secondary"}
            className="min-h-11 flex-1"
            onClick={() => {
              setMobileTab("library");
              setSheetOpen(true);
            }}
          >
            <Library className="h-4 w-4" />
            Biblioteca
          </Button>
        </div>

        {sheetOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Cerrar"
              onClick={() => setSheetOpen(false)}
            />
            <div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-background p-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold">
                  {mobileTab === "edit" ? "Ajustes" : "Biblioteca"}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSheetOpen(false)}
                >
                  Listo
                </Button>
              </div>
              {mobileTab === "edit" ? controls : libraryPanel}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-9 rounded-lg border px-3 text-sm font-medium transition-colors",
        active
          ? "border-brand bg-brand/10 text-brand"
          : "border-black/10 bg-surface text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function OptionGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}
