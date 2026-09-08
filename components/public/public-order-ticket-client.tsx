"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Link2, Printer, RefreshCw, RotateCcw, Share2 } from "lucide-react";
import { OrderTicket } from "@/components/public/order-ticket";
import { Button } from "@/components/ui/button";
import {
  fetchPublicOrderByToken,
  type PublicOrderSnapshot,
} from "@/lib/public-order";
import { useCartStore } from "@/stores/cart-store";

export function PublicOrderTicketClient({
  token,
  initial,
  ticketUrl,
}: {
  token: string;
  initial: PublicOrderSnapshot;
  ticketUrl: string;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(initial);
  const [shareState, setShareState] = useState<"idle" | "copied" | "shared">(
    "idle",
  );
  const [reordering, setReordering] = useState(false);

  const refresh = useCallback(async () => {
    const next = await fetchPublicOrderByToken(token);
    if (next) setOrder(next);
  }, [token]);

  useEffect(() => {
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    timer = window.setInterval(tick, 20_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function share() {
    const title =
      order.folio != null
        ? `Pedido #${order.folio} · ${order.restaurantName}`
        : `Pedido · ${order.restaurantName}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url: ticketUrl });
        setShareState("shared");
        window.setTimeout(() => setShareState("idle"), 2000);
        return;
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(ticketUrl);
      setShareState("copied");
      window.setTimeout(() => setShareState("idle"), 2000);
    } catch {
      /* ignore */
    }
  }

  function repeatOrder() {
    if (order.status !== "closed" || order.items.length === 0) return;
    setReordering(true);
    const cart = useCartStore.getState();
    cart.setSlug(order.restaurantSlug);
    cart.clear();
    cart.addItems(order.items);
    router.push(`/${order.restaurantSlug}`);
  }

  const canRepeat = order.status === "closed" && order.items.length > 0;

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <OrderTicket
        variant="page"
        qrUrl={ticketUrl}
        data={{
          folio: order.folio,
          createdAt: order.createdAt,
          businessName: order.restaurantName,
          fulfillment: order.fulfillment,
          tableLabel: order.tableLabel,
          customerName: "",
          items: order.items,
          subtotal: order.subtotal,
          shipping: order.shipping,
          discount: order.discount,
          couponCode: order.couponCode,
          total: order.total,
          paymentMethod: order.paymentMethod,
          status: order.status,
          transfer: order.transfer,
        }}
      />

      <div className="flex flex-col gap-2 print:hidden">
        <Button type="button" className="min-h-11 w-full" onClick={() => void share()}>
          {shareState === "copied" ? (
            <>
              <Check className="h-4 w-4" aria-hidden />
              Enlace copiado
            </>
          ) : shareState === "shared" ? (
            <>
              <Check className="h-4 w-4" aria-hidden />
              Compartido
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4" aria-hidden />
              Compartir ticket
            </>
          )}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" aria-hidden />
            Imprimir
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={() => void refresh()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Actualizar
          </Button>
        </div>
        {canRepeat ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            disabled={reordering}
            onClick={repeatOrder}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Repetir este pedido
          </Button>
        ) : null}
        <Button variant="ghost" className="min-h-11 w-full" asChild>
          <Link href={`/${order.restaurantSlug}`}>
            <Link2 className="h-4 w-4" aria-hidden />
            Ver menú de {order.restaurantName}
          </Link>
        </Button>
      </div>
    </div>
  );
}

