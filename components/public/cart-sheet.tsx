"use client";

import { useEffect, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { Restaurant } from "@/lib/types";
import { formatMxn } from "@/lib/money";
import { checkoutSchema } from "@/lib/validations";
import { buildOrderMessage, buildWaMeUrl } from "@/lib/whatsapp";
import { useCartStore } from "@/stores/cart-store";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurant: Restaurant;
  shipping: number;
};

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
  const subtotalFn = useCartStore((s) => s.subtotal);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);

  const [step, setStep] = useState<"review" | "checkout">("review");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">(
    "delivery",
  );
  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [references, setReferences] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">(
    "cash",
  );
  const [cashAmount, setCashAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const offersDelivery = restaurant.offers_delivery !== false;

  useEffect(() => {
    if (open) {
      setStep("review");
      setError(null);
      setFulfillment(offersDelivery ? "delivery" : "pickup");
    }
  }, [open, offersDelivery]);

  useEffect(() => {
    if (open && items.length === 0) onOpenChange(false);
  }, [items.length, open, onOpenChange]);

  const subtotal = subtotalFn();
  const effectiveShipping = fulfillment === "pickup" ? 0 : shipping;
  const total = subtotal + effectiveShipping;

  function openWhatsApp(url: string) {
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
      address: fulfillment === "delivery" ? address : "",
      mapsUrl: fulfillment === "delivery" ? mapsUrl : "",
      references: fulfillment === "delivery" ? references : "",
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
    const message = buildOrderMessage({
      restaurant,
      items,
      checkout: parsed.data,
      shipping: effectiveShipping,
      total,
    });

    void fetch("/api/orders/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurant_id: restaurant.id,
        payload: {
          fulfillment: parsed.data.fulfillment,
          customer_name: parsed.data.customerName,
          payment_method: parsed.data.paymentMethod,
          cash_amount: parsed.data.cashAmount,
          items,
          subtotal,
          shipping: effectiveShipping,
          total,
        },
      }),
    });

    const url = buildWaMeUrl(restaurant.phone_whatsapp, message);
    openWhatsApp(url);
    // Clear after navigation attempt so a blocked popup doesn't wipe the order
    window.setTimeout(() => {
      clear();
      setSending(false);
      onOpenChange(false);
    }, 400);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] gap-3 overflow-y-auto">
        {step === "review" ? (
          <>
            <DialogHeader>
              <DialogTitle>Tu pedido</DialogTitle>
              <DialogDescription>
                Ajusta cantidades antes de continuar.
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
                        onClick={() =>
                          updateQty(item.dishId, item.quantity - 1, sideKey)
                        }
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="min-w-8 text-center text-sm font-semibold">
                        {item.quantity}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="h-11 w-11"
                        aria-label="Más"
                        onClick={() =>
                          updateQty(item.dishId, item.quantity + 1, sideKey)
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="space-y-1 border-t border-black/5 pt-3 text-sm">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span>{formatMxn(subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Envío</span>
                <span>
                  {fulfillment === "pickup"
                    ? "—"
                    : shipping === 0
                      ? "Gratis"
                      : formatMxn(shipping)}
                </span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>
                  {formatMxn(
                    subtotal + (fulfillment === "pickup" ? 0 : shipping),
                  )}
                </span>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={() => setStep("checkout")}
              disabled={items.length === 0}
            >
              Continuar
            </Button>
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
              <div className="flex justify-between text-muted">
                <span>Envío</span>
                <span>
                  {fulfillment === "pickup"
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

            {offersDelivery ? (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={fulfillment === "pickup" ? "default" : "secondary"}
                  className="min-h-11"
                  onClick={() => setFulfillment("pickup")}
                >
                  Recoger
                </Button>
                <Button
                  type="button"
                  variant={fulfillment === "delivery" ? "default" : "secondary"}
                  className="min-h-11"
                  onClick={() => setFulfillment("delivery")}
                >
                  Envío
                </Button>
              </div>
            ) : (
              <p className="rounded-lg bg-brand/5 px-3 py-2 text-sm text-muted">
                Este negocio solo ofrece recogida en el local.
              </p>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="customerName">Nombre</Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
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
  );
}
