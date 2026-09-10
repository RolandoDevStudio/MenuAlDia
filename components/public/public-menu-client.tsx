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
import { PublicMenuSearch } from "@/components/public/public-menu-search";
import {
  comboMatchesFilters,
  dishMatchesFilters,
  emptyMenuFilters,
  menuFiltersNarrow,
  sortMenuItems,
  type MenuSearchFilters,
} from "@/lib/menu-filters";

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
  const [pillsH, setPillsH] = useState(60);
  const [pinOnMobile, setPinOnMobile] = useState(false);
  const [mobilePinned, setMobilePinned] = useState(false);
  const [searchFilters, setSearchFilters] =
    useState<MenuSearchFilters>(emptyMenuFilters);

  const pillsRef = useRef<HTMLDivElement>(null);
  const pillsSentinelRef = useRef<HTMLDivElement>(null);
  const pillsTrackRef = useRef<HTMLDivElement>(null);
  const pillBtnRefs = useRef(new Map<string, HTMLButtonElement>());
  const spyLockedUntil = useRef(0);
  const pillsHRef = useRef(60);
  const scrollingRef = useRef(false);

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
    () =>
      sortMenuItems(
        dishes.filter(
          (d) => !d.is_side && dishMatchesFilters(d, searchFilters),
        ),
        searchFilters.sortBy,
        (d) => d.name,
        (d) => Number(d.price),
      ),
    [dishes, searchFilters],
  );
  const filteredCombos = useMemo(
    () =>
      sortMenuItems(
        combos.filter((c) =>
          comboMatchesFilters(
            {
              title: c.title,
              description: c.description,
              price: comboDisplayPrice(c),
              itemNames: c.items.map((i) => i.dish.name).join(" "),
            },
            searchFilters,
          ),
        ),
        searchFilters.sortBy,
        (c) => c.title,
        (c) => comboDisplayPrice(c),
      ),
    [combos, searchFilters],
  );
  const filterCategories = useMemo(
    () =>
      categories
        .filter((c) => c.is_fixed_catalog)
        .filter((c) =>
          dishes.some((d) => !d.is_side && d.category_id === c.id),
        )
        .map((c) => ({ id: c.id, name: c.name })),
    [categories, dishes],
  );
  const catalogPrices = useMemo(() => {
    const prices = [
      ...dishes.filter((d) => !d.is_side).map((d) => Number(d.price)),
      ...combos.map((c) => comboDisplayPrice(c)),
    ].filter((n) => Number.isFinite(n) && n >= 0);
    if (prices.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [dishes, combos]);
  const hasPopular = useMemo(
    () => dishes.some((d) => !d.is_side && d.is_popular),
    [dishes],
  );
  const filtersNarrow = menuFiltersNarrow(searchFilters);
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

  function centerPill(id: string | null, behavior: ScrollBehavior) {
    if (!id) return;
    const pill = pillBtnRefs.current.get(id);
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
    track.scrollTo({ left: next, behavior });
  }

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setPinOnMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!pinOnMobile) {
      setMobilePinned(false);
      return;
    }
    const sentinel = pillsSentinelRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const el = pillsRef.current;
        if (el) {
          const h = el.offsetHeight;
          if (Math.abs(h - pillsHRef.current) >= 1) {
            pillsHRef.current = h;
            setPillsH(h);
          }
        }
        // Pin only after scrolling past the bar. `!isIntersecting` is also
        // true when the sentinel is still below the fold (e.g. daily hero).
        setMobilePinned(
          !entry.isIntersecting && entry.boundingClientRect.top < 0,
        );
      },
      { threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [pinOnMobile]);

  useEffect(() => {
    const el = pillsRef.current;
    if (!el) return;
    const sync = () => {
      if (scrollingRef.current) return;
      const h = el.offsetHeight;
      if (Math.abs(h - pillsHRef.current) < 2) return;
      pillsHRef.current = h;
      setPillsH(h);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showPills, navSections.length, filtersNarrow]);

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
    let endTimer = 0;
    const update = () => {
      raf = 0;
      if (Date.now() < spyLockedUntil.current) return;

      const offset = (pillsRef.current?.offsetHeight ?? 56) + 8;
      let current = navSections[0]?.id ?? null;
      for (const s of navSections) {
        const el = document.getElementById(`cat-${s.id}`);
        if (!el) continue;
        if (Math.round(el.getBoundingClientRect().top) <= offset) {
          current = s.id;
        }
      }
      if (current) {
        setActiveCat((prev) => (prev === current ? prev : current));
      }
    };

    const onScroll = () => {
      scrollingRef.current = true;
      if (!raf) raf = requestAnimationFrame(update);
      window.clearTimeout(endTimer);
      endTimer = window.setTimeout(() => {
        scrollingRef.current = false;
      }, 150);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(endTimer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [navSections, showPills]);

  function jumpToCategory(id: string) {
    setActiveCat(id);
    spyLockedUntil.current = Date.now() + 700;
    centerPill(id, "smooth");
    const el = document.getElementById(`cat-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
      <div
        ref={pillsSentinelRef}
        aria-hidden
        className="pointer-events-none h-px w-full -mb-px"
      />
      {pinOnMobile && mobilePinned ? (
        <div style={{ height: pillsH }} aria-hidden />
      ) : null}
      <div
        ref={pillsRef}
        className={cn(
          "z-30 w-full bg-background",
          pinOnMobile
            ? mobilePinned
              ? "fixed inset-x-0 top-0"
              : "relative"
            : "sticky top-0",
        )}
        style={{ overflowAnchor: "none" }}
      >
        <div className="mx-auto max-w-lg px-4 py-2">
          <PublicMenuSearch
          slug={slug}
          onChange={setSearchFilters}
          categories={filterCategories}
          hasPopular={hasPopular}
          priceMin={catalogPrices.min}
          priceMax={catalogPrices.max}
          render={({ tools, searchField, searchOpen, chips }) => (
            <>
              <div
                className={cn(
                  "rounded-full border border-black/5 bg-background p-1.5 shadow-[0_2px_8px_-6px_rgba(0,0,0,0.3)]",
                  !showPills && !searchOpen && "ml-auto w-fit",
                )}
              >
                {searchOpen ? (
                  searchField
                ) : (
                  <div className="flex items-center gap-0.5">
                    {showPills ? (
                      <div
                        ref={pillsTrackRef}
                        className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain scrollbar-none"
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
                                "inline-flex min-h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full text-sm font-semibold",
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
                    ) : null}
                    <div
                      className={cn(
                        "flex shrink-0 items-center",
                        showPills && "border-l border-black/5 pl-0.5",
                      )}
                    >
                      {tools}
                    </div>
                  </div>
                )}
              </div>
              {chips}
            </>
          )}
        />
        </div>
      </div>

      {filteredCombos.length > 0 ? (
        <section className="mx-auto max-w-lg px-4 pb-2 pt-2">
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-brand-dark">
            {combosLabel}
          </h2>
          <ul className="mt-3 space-y-3">
            {filteredCombos.map((c) => (
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
        {navSections.length > 0 ? (
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
        ) : filteredCombos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-surface/70 px-4 py-6 text-center">
            {filtersNarrow ? (
              <>
                <p className="font-semibold text-brand-dark">
                  Nada coincide con tu filtro
                </p>
                <p className="mt-1 text-sm text-muted">
                  Prueba otro nombre, precio o categoría.
                </p>
              </>
            ) : (
              <p className="font-semibold text-brand-dark">
                Aún no hay ítems en el catálogo
              </p>
            )}
          </div>
        ) : null}
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
