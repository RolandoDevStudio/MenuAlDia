"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { FulfillmentMode, Order, OrderLogPayload } from "@/lib/types";
import { formatMxn } from "@/lib/money";
import { formatMexicoCityDateTime, mexicoCityTodayYmd, ymdInMexicoCity } from "@/lib/dates";
import {
  FULFILLMENT_LABELS,
  ORDER_STATUS_LABELS,
  nextOrderStatus,
  parseFulfillment,
  parseOrderStatus,
} from "@/lib/fulfillment";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Filter = "today" | "all" | FulfillmentMode;

function customerName(p: OrderLogPayload) {
  return p.customer_name || p.customerName || "Cliente";
}

export function OrdersBoard({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState<Filter>("today");
  const [busyId, setBusyId] = useState<string | null>(null);

  const today = mexicoCityTodayYmd();

  const visible = useMemo(() => {
    return orders.filter((o) => {
      const payload = o.payload ?? ({} as OrderLogPayload);
      const mode = parseFulfillment(payload.fulfillment);
      if (filter === "today") return ymdInMexicoCity(o.created_at) === today;
      if (filter === "all") return true;
      return mode === filter;
    });
  }, [orders, filter, today]);

  async function cycleStatus(order: Order) {
    const current = parseOrderStatus(order.status) ?? "submitted";
    if (current === "cancelled" || current === "closed") return;
    const next = nextOrderStatus(current);
    setBusyId(order.id);
    const res = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: order.id, status: next }),
    });
    setBusyId(null);
    if (!res.ok) {
      toast.error("No se pudo actualizar el estado");
      return;
    }
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)),
    );
  }

  async function cancelOrder(order: Order) {
    setBusyId(order.id);
    const res = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: order.id, status: "cancelled" }),
    });
    setBusyId(null);
    if (!res.ok) {
      toast.error("No se pudo cancelar");
      return;
    }
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: "cancelled" } : o)),
    );
  }

  async function stampVisit(order: Order) {
    if (!order.customer_id) {
      toast.error("Este pedido no tiene ficha de cliente");
      return;
    }
    setBusyId(order.id);
    const res = await fetch("/api/admin/loyalty/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: order.customer_id }),
    });
    setBusyId(null);
    if (!res.ok) {
      toast.error("No se pudo registrar la visita");
      return;
    }
    toast.success("Visita registrada");
  }

  const chips: { id: Filter; label: string }[] = [
    { id: "today", label: "Hoy" },
    { id: "all", label: "Todos" },
    { id: "pickup", label: "Recoger" },
    { id: "delivery", label: "Envío" },
    { id: "dine_in", label: "Comedor" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <Button
            key={c.id}
            type="button"
            size="sm"
            variant={filter === c.id ? "default" : "secondary"}
            className="min-h-9"
            onClick={() => setFilter(c.id)}
          >
            {c.label}
          </Button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-muted">
          {filter === "today"
            ? "No hay pedidos hoy."
            : "Aún no hay pedidos Pro."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((o) => {
            const payload = o.payload ?? ({} as OrderLogPayload);
            const mode = parseFulfillment(payload.fulfillment);
            const status = parseOrderStatus(o.status) ?? "submitted";
            const phone = payload.phone;
            const canStamp =
              (mode === "pickup" || mode === "dine_in") &&
              Boolean(o.customer_id);
            return (
              <li
                key={o.id}
                className="rounded-xl border border-black/5 bg-surface px-3 py-3"
              >
                <div className="flex justify-between gap-2">
                  <p className="font-medium">{customerName(payload)}</p>
                  <p className="text-sm font-semibold text-brand">
                    {formatMxn(Number(o.total))}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {formatMexicoCityDateTime(o.created_at)}
                  {mode ? ` · ${FULFILLMENT_LABELS[mode]}` : ""}
                  {payload.table_label ? ` · Mesa ${payload.table_label}` : ""}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-muted">
                  {(payload.items ?? [])
                    .map((i) => `${i.quantity}x ${i.name}`)
                    .join(", ")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={
                      busyId === o.id ||
                      status === "closed" ||
                      status === "cancelled"
                    }
                    onClick={() => void cycleStatus(o)}
                  >
                    {ORDER_STATUS_LABELS[status]}
                  </Button>
                  {o.customer_id ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/customers?id=${o.customer_id}`}>
                        Ver cliente
                      </Link>
                    </Button>
                  ) : null}
                  {phone ? (
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={`https://wa.me/52${phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        WhatsApp
                      </a>
                    </Button>
                  ) : null}
                  {canStamp ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === o.id}
                      onClick={() => void stampVisit(o)}
                    >
                      +1 visita
                    </Button>
                  ) : null}
                  {status !== "cancelled" && status !== "closed" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className={cn("text-red-700")}
                      disabled={busyId === o.id}
                      onClick={() => void cancelOrder(o)}
                    >
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
