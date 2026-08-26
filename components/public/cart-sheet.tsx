"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Trash2 } from "lucide-react";
import type { FulfillmentMode, Restaurant } from "@/lib/types";
import { formatMxn } from "@/lib/money";
import { checkoutSchema } from "@/lib/validations";
import { buildOrderMessage, buildWaMeUrl } from "@/lib/whatsapp";
import { isDemoOrEmbedded } from "@/lib/canonical-demos";
import { normalizeBusinessType } from "@/lib/business-labels";
import {
  defaultFulfillment,
  fulfillmentChargesShipping,
  FULFILLMENT_LABELS,
  restaurantFulfillmentModes,
} from "@/lib/fulfillment";
import {
  bookableCartItems,
  cartHasBookable,
  cartHasPurchasable,
  purchasableCartItems,
} from "@/lib/item-fulfillment";
import { useCartStore } from "@/stores/cart-store";
import { CitaExpressDialog } from "@/components/public/cita-express-dialog";
import {
  formatClabeDisplay,
  publicTransferDetails,
} from "@/lib/transfer-details";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { PlanType } from "@/lib/plans";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurant: Restaurant;
  shipping: number;
};

function TransferCopyRow({
  label,
  display,
  copyValue,
  mono,
}: {
  label: string;
  display: string;
  copyValue: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted">{label}</p>
        <p className={mono ? "break-all font-mono text-sm" : "text-sm"}>
          {display}
        </p>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="min-h-11 shrink-0"
        onClick={() => void copy()}
      >
        <Copy className="mr-1 h-3.5 w-3.5" aria-hidden />
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

function addonKeyOf(item: {
  addons?: { id: string }[];
  sideIds?: string[];
}) {
  if (item.addons?.length) {
    return [...item.addons.map((a) => a.id)].sort().join(",");
  }
  return [...(item.sideIds ?? [])].sort().join(",");
}

function lineTotal(item: {
  unitPrice: number;
  quantity: number;
  addons?: { priceDelta: number }[];
}) {
  const extras = (item.addons ?? []).reduce((s, a) => s + a.priceDelta, 0);
  return (item.unitPrice + extras) * item.quantity;
}

export function CartSheet({ open, onOpenChange, restaurant, shipping }: Props) {
  const items = useCartStore((s) => s.items);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);

  const [step, setStep] = useState<"review" | "checkout">("review");
  const modes = useMemo(
    () => restaurantFulfillmentModes(restaurant),
    [
      restaurant.offers_pickup,
      restaurant.offers_delivery,
      restaurant.offers_dine_in,
    ],
  );
  const [fulfillment, setFulfillment] = useState<FulfillmentMode>(() =>
    defaultFulfillment(restaurant),
  );
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tableLabel, setTableLabel] = useState("");
  const [address, setAddress] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [references, setReferences] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">(
    "cash",
  );
  const [cashAmount, setCashAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [citaOpen, setCitaOpen] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponHint, setCouponHint] = useState<string | null>(null);

  const isServicios =
    normalizeBusinessType(restaurant.business_type) === "servicios";
  const hasBookable = isServicios && cartHasBookable(items);
  const hasPurchasable = cartHasPurchasable(items);
  const bookableOnly = hasBookable && !hasPurchasable;
  const transferDetails = publicTransferDetails(restaurant);

  const citaServices = useMemo(
    () =>
      bookableCartItems(items).map((i) => ({
        name: i.comboTitle ? `${i.comboTitle}: ${i.name}` : i.name,
        price:
          i.unitPrice +
          (i.addons ?? []).reduce((s, a) => s + a.priceDelta, 0),
        quantity: i.quantity,
      })),
    [items],
  );

  const orderItems = useMemo(() => {
    if (isServicios && hasBookable && hasPurchasable) {
      return purchasableCartItems(items);
    }
    return items;
  }, [items, isServicios, hasBookable, hasPurchasable]);

  const allSubtotal = useMemo(
    () =>
      items.reduce((sum, i) => {
        const addons = (i.addons ?? []).reduce((s, a) => s + a.priceDelta, 0);
        return sum + (i.unitPrice + addons) * i.quantity;
      }, 0),
    [items],
  );

  const purchaseSubtotal = useMemo(
    () =>
      orderItems.reduce((sum, i) => {
        const addons = (i.addons ?? []).reduce((s, a) => s + a.priceDelta, 0);
        return sum + (i.unitPrice + addons) * i.quantity;
      }, 0),
    [orderItems],
  );

  useEffect(() => {
    if (!open) return;
    setStep("review");
    setError(null);
    setCouponInput("");
    setCouponCode(null);
    setCouponDiscount(0);
    setCouponHint(null);
    const key = `menualdia-checkout-${restaurant.slug}`;
    let saved: { name?: string; phone?: string; fulfillment?: string } = {};
    try {
      saved = JSON.parse(localStorage.getItem(key) ?? "{}") as typeof saved;
    } catch {
      saved = {};
    }
    if (saved.name) setCustomerName(saved.name);
    if (saved.phone) setCustomerPhone(saved.phone);
    const next =
      saved.fulfillment && modes.includes(saved.fulfillment as FulfillmentMode)
        ? (saved.fulfillment as FulfillmentMode)
        : defaultFulfillment(restaurant);
    setFulfillment(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per open
  }, [open, restaurant.slug]);

  useEffect(() => {
    if (open && items.length === 0) onOpenChange(false);
  }, [items.length, open, onOpenChange]);

  const subtotal = step === "checkout" ? purchaseSubtotal : allSubtotal;
  const effectiveShipping = fulfillmentChargesShipping(fulfillment)
    ? shipping
    : 0;
  const discount = couponCode ? couponDiscount : 0;
  const total = Math.max(0, subtotal - discount) + effectiveShipping;

  async function applyCoupon() {
    setCouponHint(null);
    const code = couponInput.trim();
    if (!code) return;
    const res = await fetch("/api/public/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurant_id: restaurant.id,
        code,
        subtotal: purchaseSubtotal,
        phone: customerPhone,
      }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      code?: string;
      discount?: number;
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      setCouponCode(null);
      setCouponDiscount(0);
      setCouponHint(json.message ?? json.error ?? "Cupón no válido");
      return;
    }
    setCouponCode(json.code ?? code.toUpperCase());
    setCouponDiscount(Number(json.discount ?? 0));
    setCouponHint(null);
  }

  function openWhatsApp(url: string) {
    if (isDemoOrEmbedded(restaurant.slug)) {
      setError("En la demo los envíos son simulados");
      return;
    }
    const isMobile =
      typeof navigator !== "undefined" &&
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = url;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  async function submit() {
    setError(null);
    const parsed = checkoutSchema.safeParse({
      fulfillment,
      customerName,
      phone: customerPhone,
      address: fulfillment === "delivery" ? address : "",
      mapsUrl: fulfillment === "delivery" ? mapsUrl : "",
      references: fulfillment === "delivery" ? references : "",
      tableLabel: fulfillment === "dine_in" ? tableLabel : "",
      paymentMethod,
      cashAmount: paymentMethod === "cash" ? Number(cashAmount) : null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa el formulario");
      return;
    }

    if (
      paymentMethod === "cash" &&
      parsed.data.cashAmount != null &&
      parsed.data.cashAmount < total
    ) {
      setError(
        `El efectivo (${formatMxn(parsed.data.cashAmount)}) es menor al total (${formatMxn(total)})`,
      );
      return;
    }

    setSending(true);
    const discountedSub = Math.max(0, purchaseSubtotal - discount);
    const checkout = {
      ...parsed.data,
      tableLabel: parsed.data.tableLabel || "",
    };
    const message = buildOrderMessage({
      restaurant,
      items: orderItems,
      checkout,
      shipping: effectiveShipping,
      total: discountedSub + effectiveShipping,
      discount,
      couponCode,
      subtotalBeforeDiscount: purchaseSubtotal,
    });

    try {
      localStorage.setItem(
        `menualdia-checkout-${restaurant.slug}`,
        JSON.stringify({
          name: parsed.data.customerName,
          phone: parsed.data.phone,
          fulfillment: parsed.data.fulfillment,
        }),
      );
    } catch {
      /* ignore */
    }

    void fetch("/api/orders/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurant_id: restaurant.id,
        payload: {
          fulfillment: parsed.data.fulfillment,
          customer_name: parsed.data.customerName,
          phone: parsed.data.phone,
          payment_method: parsed.data.paymentMethod,
          cash_amount: parsed.data.cashAmount,
          table_label: parsed.data.tableLabel || null,
          items: orderItems,
          subtotal: purchaseSubtotal,
          shipping: effectiveShipping,
          total: discountedSub + effectiveShipping,
          coupon_code: couponCode,
          discount,
        },
      }),
    });

    const url = buildWaMeUrl(restaurant.phone_whatsapp, message);
    void fetch("/api/public/wa-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurant_id: restaurant.id }),
      keepalive: true,
    }).catch(() => {});
    openWhatsApp(url);
    // Clear after navigation attempt so a blocked popup doesn't wipe the order
    window.setTimeout(() => {
      clear();
      setSending(false);
      onOpenChange(false);
    }, 400);
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="menu-dialog-in max-h-[90dvh] gap-3 overflow-y-auto">
        {step === "review" ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {isServicios ? "Tu selección" : "Tu pedido"}
              </DialogTitle>
              <DialogDescription>
                {isServicios
                  ? "Agenda citas y/o continúa la compra de productos."
                  : "Ajusta cantidades antes de continuar."}
              </DialogDescription>
            </DialogHeader>

            <ul className="space-y-3">
              {items.map((item) => {
                const sideKey = addonKeyOf(item);
                const names =
                  item.addons?.map((a) => a.name) ?? item.sideNames ?? [];
                return (
                  <li
                    key={`${item.comboId ?? ""}::${item.dishId}::${sideKey}`}
                    className="rounded-xl border border-black/5 bg-background/60 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {item.comboTitle ? (
                          <p className="text-[10px] font-bold uppercase tracking-wide text-brand">
                            {item.comboTitle}
                          </p>
                        ) : null}
                        <p className="font-medium leading-snug">{item.name}</p>
                        {names.length ? (
                          <p className="mt-0.5 text-xs text-muted">
                            + {names.join(", ")}
                          </p>
                        ) : null}
                        <p className="mt-1 text-sm text-brand">
                          {formatMxn(lineTotal(item))}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="min-h-11 min-w-11 shrink-0 text-red-600"
                        aria-label="Quitar"
                        onClick={() => removeItem(item.dishId, sideKey)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="h-11 w-11"
                        aria-label="Menos"
                        onClick={() => {
                          const step = item.stepValue ?? 1;
                          updateQty(
                            item.dishId,
                            item.quantity - step,
                            sideKey,
                          );
                        }}
                      >
                        −
                      </Button>
                      <span className="min-w-12 text-center text-sm font-semibold">
                        {item.unitType && item.unitType !== "unit"
                          ? `${item.quantity} ${item.unitType === "kg" ? "kg" : "L"}`
                          : item.quantity}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="h-11 w-11"
                        aria-label="Más"
                        onClick={() => {
                          const step = item.stepValue ?? 1;
                          updateQty(
                            item.dishId,
                            item.quantity + step,
                            sideKey,
                          );
                        }}
                      >
                        +
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {modes.length > 1 ? (
              <div
                className={`grid gap-2 ${modes.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}
              >
                {modes.map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    variant={fulfillment === mode ? "default" : "secondary"}
                    className="min-h-11"
                    onClick={() => setFulfillment(mode)}
                  >
                    {FULFILLMENT_LABELS[mode]}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-brand/5 px-3 py-2 text-sm text-muted">
                {fulfillment === "pickup"
                  ? "Este negocio solo ofrece recogida en el local."
                  : fulfillment === "dine_in"
                    ? "Este negocio solo ofrece pedidos en comedor."
                    : "Este negocio solo ofrece envío a domicilio."}
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cart_coupon">¿Tienes un código de descuento?</Label>
              <div className="flex gap-2">
                <Input
                  id="cart_coupon"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="CUMPLE10"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void applyCoupon()}
                >
                  Aplicar
                </Button>
              </div>
              {couponHint ? (
                <p className="text-xs text-amber-800">{couponHint}</p>
              ) : null}
            </div>

            <div className="space-y-1 border-t border-black/5 pt-3 text-sm">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span>{formatMxn(subtotal)}</span>
              </div>
              {discount > 0 ? (
                <div className="flex justify-between text-muted">
                  <span>Cupón {couponCode}</span>
                  <span>−{formatMxn(discount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-muted">
                <span>Envío</span>
                <span>
                  {!fulfillmentChargesShipping(fulfillment)
                    ? "—"
                    : effectiveShipping === 0
                      ? "Gratis"
                      : formatMxn(effectiveShipping)}
                </span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>{formatMxn(total)}</span>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={() => setStep("checkout")}
              disabled={items.length === 0 || !hasPurchasable}
            >
              {isServicios && hasBookable && hasPurchasable
                ? "Continuar compra"
                : "Continuar"}
            </Button>
            {hasBookable ? (
              <Button
                type="button"
                variant={bookableOnly ? "default" : "secondary"}
                className="w-full min-h-11"
                size="lg"
                onClick={() => setCitaOpen(true)}
              >
                Agendar cita por WhatsApp
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Cómo quieres tu pedido</DialogTitle>
              <DialogDescription>
                Te redirigiremos a WhatsApp. La dirección de envío solo va en el
                mensaje; no la guardamos.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1 rounded-xl bg-background/60 px-3 py-2 text-sm">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span>{formatMxn(subtotal)}</span>
              </div>
              {discount > 0 ? (
                <div className="flex justify-between text-muted">
                  <span>Cupón {couponCode}</span>
                  <span>−{formatMxn(discount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-muted">
                <span>Envío</span>
                <span>
                  {!fulfillmentChargesShipping(fulfillment)
                    ? "—"
                    : effectiveShipping === 0
                      ? "Gratis"
                      : formatMxn(effectiveShipping)}
                </span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatMxn(total)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="customerName">Nombre</Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customerPhone">WhatsApp</Label>
                <Input
                  id="customerPhone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="10 dígitos"
                />
              </div>
              {fulfillment === "delivery" ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="address">Dirección de entrega</Label>
                    <Textarea
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mapsUrl">URL de Google Maps</Label>
                    <Input
                      id="mapsUrl"
                      type="url"
                      inputMode="url"
                      placeholder="https://maps.google.com/…"
                      value={mapsUrl}
                      onChange={(e) => setMapsUrl(e.target.value)}
                    />
                    <p className="text-[11px] text-muted">
                      Opcional. En Maps: compartir → copiar enlace.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="references">Referencias</Label>
                    <Input
                      id="references"
                      value={references}
                      onChange={(e) => setReferences(e.target.value)}
                    />
                  </div>
                </>
              ) : null}
              {fulfillment === "dine_in" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="tableLabel">Mesa (opcional)</Label>
                  <Input
                    id="tableLabel"
                    value={tableLabel}
                    onChange={(e) => setTableLabel(e.target.value)}
                    placeholder="Ej. 5"
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Método de pago</Label>
                <div
                  className="flex gap-2"
                  role="radiogroup"
                  aria-label="Método de pago"
                >
                  <Button
                    type="button"
                    className="min-h-11 flex-1"
                    variant={paymentMethod === "cash" ? "default" : "secondary"}
                    aria-pressed={paymentMethod === "cash"}
                    onClick={() => setPaymentMethod("cash")}
                  >
                    Efectivo
                  </Button>
                  <Button
                    type="button"
                    className="min-h-11 flex-1"
                    variant={
                      paymentMethod === "transfer" ? "default" : "secondary"
                    }
                    aria-pressed={paymentMethod === "transfer"}
                    onClick={() => setPaymentMethod("transfer")}
                  >
                    Transferencia
                  </Button>
                </div>
              </div>
              {paymentMethod === "transfer" && transferDetails ? (
                <div className="space-y-1 rounded-xl border border-black/5 bg-background/60 px-3 py-3">
                  <p className="text-sm font-semibold">Datos para transferir</p>
                  {transferDetails.holder ? (
                    <TransferCopyRow
                      label="Titular"
                      display={transferDetails.holder}
                      copyValue={transferDetails.holder}
                    />
                  ) : null}
                  {transferDetails.bank ? (
                    <TransferCopyRow
                      label="Banco"
                      display={transferDetails.bank}
                      copyValue={transferDetails.bank}
                    />
                  ) : null}
                  <TransferCopyRow
                    label="CLABE"
                    display={formatClabeDisplay(transferDetails.clabe)}
                    copyValue={transferDetails.clabe}
                    mono
                  />
                  <p className="pt-1 text-xs text-muted">
                    Envía tu comprobante por WhatsApp al confirmar el pedido.
                  </p>
                </div>
              ) : null}
              {paymentMethod === "cash" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="cashAmount">¿Con cuánto pagas?</Label>
                  <Input
                    id="cashAmount"
                    inputMode="decimal"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                  />
                  {cashAmount && Number(cashAmount) >= total ? (
                    <p className="text-xs text-accent">
                      Cambio: {formatMxn(Number(cashAmount) - total)}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <p className="text-[11px] leading-snug text-muted">
                Al enviar tu pedido, aceptas que {restaurant.name} use tu nombre
                y WhatsApp para dar seguimiento a este pedido y, si aplica,
                promociones ocasionales.{" "}
                <Link
                  href={`/privacidad?from=${encodeURIComponent(restaurant.slug)}`}
                  className="font-medium text-brand underline-offset-2 hover:underline"
                >
                  Aviso de privacidad
                </Link>
                .
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 flex-1"
                  onClick={() => setStep("review")}
                  disabled={sending}
                >
                  Atrás
                </Button>
                <Button
                  className="min-h-11 flex-[1.4]"
                  onClick={submit}
                  disabled={sending}
                >
                  {sending ? "Abriendo…" : "Enviar por WhatsApp"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
    <CitaExpressDialog
      open={citaOpen}
      onOpenChange={setCitaOpen}
      services={citaServices}
      businessName={restaurant.name}
      phoneWhatsapp={restaurant.phone_whatsapp || ""}
      restaurantId={restaurant.id}
      restaurantSlug={restaurant.slug}
      planType={restaurant.plan_type as PlanType}
      onBooked={() => {
        clear();
        onOpenChange(false);
      }}
    />
    </>
  );
}
