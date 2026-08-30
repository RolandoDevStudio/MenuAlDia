"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, CalendarClock } from "lucide-react";
import type {
  Category,
  ComboWithItems,
  Dish,
  DishAddon,
  Restaurant,
} from "@/lib/types";
import type { PhotoFrame } from "@/lib/theme";
import { photoFrameClass } from "@/lib/theme";
import { formatMxn } from "@/lib/money";
import {
  pricePerUnitLabel,
  resolveStepValue,
  resolveUnitType,
} from "@/lib/units";
import { comboDisplayPrice } from "@/lib/combo";
import { normalizeBusinessType } from "@/lib/business-labels";
import {
  dishAllowsBooking,
  dishAllowsPurchase,
  comboAllowsBooking,
  comboAllowsPurchase,
} from "@/lib/item-fulfillment";
import { useCartStore } from "@/stores/cart-store";
import { ProductBottomSheet } from "@/components/public/product-bottom-sheet";
import { ComboBottomSheet } from "@/components/public/combo-bottom-sheet";
import { CitaExpressDialog } from "@/components/public/cita-express-dialog";
import { StorageImage } from "@/components/ui/storage-image";
import { cn } from "@/lib/utils";
import type { PlanType } from "@/lib/plans";

const POPULAR_NAV_ID = "popular";

type NavSection = {
  id: string;
  title: string;
  items: Dish[];
};

type Props = {
  slug: string;
  restaurant: Restaurant;
  categories: Category[];
  dishes: Dish[];
  addonsByDishId: Record<string, DishAddon[]>;
  combos: ComboWithItems[];
  photoFrame?: PhotoFrame;
  sidesLabel?: string;
  combosLabel?: string;
  popularLabel?: string;
  initialDishId?: string | null;
  initialComboSlug?: string | null;
};

export function PublicMenuClient({
  slug,
  restaurant,
  categories,
  dishes,
  addonsByDishId,
  combos,
  photoFrame = "rounded_modern",
  sidesLabel = "Adicionales",
  combosLabel = "Combos",
  popularLabel = "Lo más pedido",
  initialDishId,
  initialComboSlug,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const addItem = useCartStore((s) => s.addItem);

  const [productId, setProductId] = useState<string | null>(
    initialDishId ?? null,
  );
  const [comboSlug, setComboSlug] = useState<string | null>(
    initialComboSlug ?? null,
  );
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [flashDishId, setFlashDishId] = useState<string | null>(null);
  const [citaDishId, setCitaDishId] = useState<string | null>(null);
  const [citaComboSlug, setCitaComboSlug] = useState<string | null>(null);
  const [pillsStuck, setPillsStuck] = useState(false);
  const [pillsH, setPillsH] = useState(60);

  const pillsRef = useRef<HTMLDivElement>(null);
  const pillsTrackRef = useRef<HTMLDivElement>(null);
  const pillBtnRefs = useRef(new Map<string, HTMLButtonElement>());
  const spyLockedUntil = useRef(0);

  const isServicios =
    normalizeBusinessType(restaurant.business_type) === "servicios";
  const citaDish = useMemo(
    () => dishes.find((d) => d.id === citaDishId) ?? null,
    [dishes, citaDishId],
  );
  const citaCombo = useMemo(
    () => combos.find((c) => c.slug === citaComboSlug) ?? null,
    [combos, citaComboSlug],
  );

  const citaServices = useMemo(() => {
    if (citaDish) {
      return [{ name: citaDish.name, price: Number(citaDish.price) }];
    }
    if (citaCombo) {
      return [
        {
          name: citaCombo.title,
          price: comboDisplayPrice(citaCombo),
        },
      ];
    }
    return [];
  }, [citaDish, citaCombo]);

  useEffect(() => {
    if (initialComboSlug) setComboSlug(initialComboSlug);
    else if (initialDishId) setProductId(initialDishId);
  }, [initialDishId, initialComboSlug]);

  const product = useMemo(
    () => dishes.find((d) => d.id === productId) ?? null,
    [dishes, productId],
  );
  const combo = useMemo(
    () => combos.find((c) => c.slug === comboSlug) ?? null,
    [combos, comboSlug],
  );

  const catalogDishes = useMemo(
    () => dishes.filter((d) => !d.is_side),
    [dishes],
  );
  const popularItems = useMemo(
    () => catalogDishes.filter((d) => d.is_popular),
    [catalogDishes],
  );

  const navSections = useMemo((): NavSection[] => {
    const cats = categories
      .filter((c) => c.is_fixed_catalog)
      .map((category) => ({
        id: category.id,
        title: category.name,
        items: catalogDishes.filter((d) => d.category_id === category.id),
      }))
      .filter((s) => s.items.length > 0);
    if (popularItems.length === 0) return cats;
    return [
      { id: POPULAR_NAV_ID, title: popularLabel, items: popularItems },
      ...cats,
    ];
  }, [categories, catalogDishes, popularItems, popularLabel]);

  const showPills = navSections.length > 1;

  useEffect(() => {
    if (!showPills) return;
    const el = pillsRef.current;
    if (!el) return;
    const sync = () => setPillsH(el.offsetHeight);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showPills, navSections.length]);

  useEffect(() => {
    if (navSections.length === 0) return;
    setActiveCat((prev) => {
      if (prev && navSections.some((s) => s.id === prev)) return prev;
      return navSections[0].id;
    });
  }, [navSections]);

  useEffect(() => {
    if (!showPills) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const bar = pillsRef.current;
      const offset = (bar?.offsetHeight ?? 56) + 8;
      if (bar) {
        setPillsStuck(bar.getBoundingClientRect().top <= 0);
      }
      if (Date.now() < spyLockedUntil.current) return;

      let current = navSections[0]?.id ?? null;
      for (const s of navSections) {
        const el = document.getElementById(`cat-${s.id}`);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= offset) current = s.id;
      }
      if (current) {
        setActiveCat((prev) => (prev === current ? prev : current));
      }
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [navSections, showPills]);

  useEffect(() => {
    if (!activeCat) return;
    const pill = pillBtnRefs.current.get(activeCat);
    const track = pillsTrackRef.current;
    if (!pill || !track) return;
    const pillCenter =
      pill.offsetLeft - track.offsetLeft + pill.offsetWidth / 2;
    const max = track.scrollWidth - track.clientWidth;
    const next = Math.max(
      0,
      Math.min(max, pillCenter - track.clientWidth / 2),
    );
    if (Math.abs(next - track.scrollLeft) < 1) return;
    track.scrollTo({ left: next, behavior: "smooth" });
  }, [activeCat]);

  function clearQuery() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("p");
    params.delete("c");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  function openProduct(id: string) {
    setComboSlug(null);
    setProductId(id);
  }

  function openCombo(s: string) {
    setProductId(null);
    setComboSlug(s);
  }

  function jumpToCategory(id: string) {
    setActiveCat(id);
    spyLockedUntil.current = Date.now() + 700;
    const el = document.getElementById(`cat-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function quickAdd(dish: Dish, e: React.MouseEvent) {
    e.stopPropagation();
    const canBook = isServicios && dishAllowsBooking(dish);
    const canBuy = dishAllowsPurchase(dish);
    if (canBook && !canBuy) {
      setCitaDishId(dish.id);
      return;
    }
    if (!canBuy) return;
    const addons = (addonsByDishId[dish.id] ?? []).filter(
      (a) => a.is_active && !a.archived_at,
    );
    if (addons.length > 0) {
      openProduct(dish.id);
      return;
    }
    addItem({
      dishId: dish.id,
      name: dish.name,
      unitPrice: Number(dish.price),
      quantity: resolveStepValue(
        resolveUnitType(dish.unit_type),
        dish.step_value,
      ),
      allowPurchase: true,
      allowBooking: canBook,
      unitType: resolveUnitType(dish.unit_type),
      stepValue: resolveStepValue(
        resolveUnitType(dish.unit_type),
        dish.step_value,
      ),
    });
    setFlashDishId(dish.id);
    window.setTimeout(() => {
      setFlashDishId((id) => (id === dish.id ? null : id));
    }, 400);
  }

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  function renderDish(dish: Dish) {
    return (
      <li key={dish.id}>
        <div className="relative flex min-h-11 w-full gap-3 rounded-2xl border border-black/5 bg-surface p-3 text-left transition active:scale-[0.99]">
          <button
            type="button"
            onClick={() => openProduct(dish.id)}
            className="flex min-w-0 flex-1 gap-3 text-left"
          >
            <div className="relative shrink-0">
              {dish.photo_url ? (
                <StorageImage
                  src={dish.photo_url}
                  alt=""
                  width={80}
                  height={80}
                  sizes="80px"
                  className={cn("h-20 w-20", photoFrameClass(photoFrame))}
                />
              ) : (
                <div
                  className={cn(
                    "flex h-20 w-20 items-center justify-center bg-brand/15 font-[family-name:var(--font-display)] text-2xl text-brand-dark/50",
                    photoFrameClass(photoFrame).replace("object-cover", ""),
                  )}
                >
                  {dish.name.slice(0, 1)}
                </div>
              )}
              {dish.is_popular ? (
                <span className="absolute left-1 top-1 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                  {popularLabel}
                </span>
              ) : null}
            </div>
            <div className="min-w-0 flex-1 pr-10">
              <p className="font-semibold">{dish.name}</p>
              {dish.description ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                  {dish.description}
                </p>
              ) : null}
              <p className="mt-2 text-sm font-semibold text-brand">
                {formatMxn(Number(dish.price))}
                {pricePerUnitLabel(resolveUnitType(dish.unit_type))}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={(e) => quickAdd(dish, e)}
            className={cn(
              "absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white shadow-md transition hover:bg-brand-dark active:scale-95",
              flashDishId === dish.id && "menu-quick-flash",
            )}
            aria-label={
              isServicios &&
              dishAllowsBooking(dish) &&
              !dishAllowsPurchase(dish)
                ? `Solicitar cita para ${dish.name}`
                : `Añadir ${dish.name}`
            }
          >
            {isServicios &&
            dishAllowsBooking(dish) &&
            !dishAllowsPurchase(dish) ? (
              <CalendarClock className="h-5 w-5" />
            ) : (
              <Plus className="h-5 w-5" />
            )}
          </button>
        </div>
      </li>
    );
  }

  return (
    <>
      {combos.length > 0 ? (
        <section className="mx-auto max-w-lg px-4 pb-2 pt-4">
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-brand-dark">
            {combosLabel}
          </h2>
          <ul className="mt-3 space-y-3">
            {combos.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => openCombo(c.slug)}
                  className="flex min-h-11 w-full gap-3 rounded-2xl border border-brand/20 bg-surface p-3 text-left transition active:scale-[0.99]"
                >
                  {c.photo_url ? (
                    <StorageImage
                      src={c.photo_url}
                      alt=""
                      width={80}
                      height={80}
                      sizes="80px"
                      className={cn("h-20 w-20", photoFrameClass(photoFrame))}
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand/10 text-2xl">
                      🔥
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{c.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                      {c.items.map((i) => i.dish.name).join(" · ")}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-brand">
                      {formatMxn(comboDisplayPrice(c))}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        className="mx-auto max-w-lg px-4 pb-8 pt-2"
        style={{ ["--menu-pills-h" as string]: `${pillsH}px` }}
      >
        {showPills ? (
          <div
            ref={pillsRef}
            className="sticky top-0 z-30 -mx-4 mb-4 bg-linear-to-b from-background via-background/95 to-transparent px-4 pb-4 pt-2"
          >
            <div
              className={cn(
                "rounded-full border border-black/5 bg-background/80 p-1.5 backdrop-blur-md transition-shadow duration-300",
                pillsStuck
                  ? "shadow-[0_6px_20px_-8px_rgba(0,0,0,0.35)]"
                  : "shadow-[0_2px_8px_-6px_rgba(0,0,0,0.3)]",
              )}
            >
              <div
                ref={pillsTrackRef}
                className="flex flex-nowrap items-center gap-1.5 overflow-x-auto scrollbar-none"
              >
                {navSections.map((s) => {
                  const isPopular = s.id === POPULAR_NAV_ID;
                  const active = activeCat === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      ref={(el) => {
                        if (el) pillBtnRefs.current.set(s.id, el);
                        else pillBtnRefs.current.delete(s.id);
                      }}
                      onClick={() => jumpToCategory(s.id)}
                      title={isPopular ? popularLabel : undefined}
                      aria-label={isPopular ? popularLabel : undefined}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "inline-flex min-h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full text-sm font-semibold transition-colors duration-200",
                        isPopular ? "px-3 text-base" : "px-4",
                        active
                          ? "bg-brand text-white shadow-sm"
                          : "text-muted hover:bg-surface hover:text-brand-dark",
                      )}
                    >
                      {isPopular ? (
                        <span aria-hidden>⭐</span>
                      ) : (
                        s.title
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {navSections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-surface/70 px-4 py-6 text-center">
            <p className="font-semibold text-brand-dark">
              Aún no hay ítems en el catálogo
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {navSections.map((s) => (
              <div
                key={s.id}
                id={`cat-${s.id}`}
                style={{ scrollMarginTop: "var(--menu-pills-h, 3.5rem)" }}
              >
                <h2 className="font-[family-name:var(--font-display)] text-3xl text-brand-dark">
                  {s.title}
                </h2>
                <ul className="mt-3 space-y-3">{s.items.map(renderDish)}</ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <ProductBottomSheet
        dish={product}
        addons={product ? (addonsByDishId[product.id] ?? []) : []}
        open={Boolean(product)}
        onOpenChange={(o) => {
          if (!o) {
            setProductId(null);
            clearQuery();
          }
        }}
        photoFrame={photoFrame}
        sidesLabel={sidesLabel}
        shareUrl={
          product && origin
            ? `${origin}/${slug}?p=${product.id}`
            : undefined
        }
        allowBooking={
          Boolean(product) && isServicios && dishAllowsBooking(product!)
        }
        allowPurchase={product ? dishAllowsPurchase(product) : true}
        onRequestCita={() => {
          if (product) {
            setCitaDishId(product.id);
            setCitaComboSlug(null);
            setProductId(null);
            clearQuery();
          }
        }}
      />

      <CitaExpressDialog
        open={citaServices.length > 0}
        onOpenChange={(o) => {
          if (!o) {
            setCitaDishId(null);
            setCitaComboSlug(null);
          }
        }}
        services={citaServices}
        businessName={restaurant.name}
        phoneWhatsapp={restaurant.phone_whatsapp || ""}
        restaurantId={restaurant.id}
        planType={restaurant.plan_type as PlanType}
      />

      <ComboBottomSheet
        combo={combo}
        addonsByDishId={addonsByDishId}
        open={Boolean(combo)}
        onOpenChange={(o) => {
          if (!o) {
            setComboSlug(null);
            clearQuery();
          }
        }}
        sidesLabel={sidesLabel}
        shareUrl={
          combo && origin ? `${origin}/${slug}?c=${combo.slug}` : undefined
        }
        allowBooking={
          Boolean(combo) && isServicios && comboAllowsBooking(combo!)
        }
        allowPurchase={combo ? comboAllowsPurchase(combo) : true}
        onRequestCita={() => {
          if (combo) {
            setCitaComboSlug(combo.slug);
            setCitaDishId(null);
            setComboSlug(null);
            clearQuery();
          }
        }}
      />
    </>
  );
}
