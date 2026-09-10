"use client";

import { useEffect } from "react";
import type {
  BusinessType,
  CartItem,
  FulfillmentMode,
  OrderStatus,
} from "@/lib/types";
import { formatMxn } from "@/lib/money";
import { fulfillmentLabelFor } from "@/lib/fulfillment";
import { shippingCostLabel } from "@/lib/business-labels";
import { formatMexicoCityDateTime } from "@/lib/dates";
import { formatClabeDisplay } from "@/lib/transfer-details";
import type { PublicTransferDetails } from "@/lib/transfer-details";
import { TicketQr } from "@/components/public/ticket-qr";

export type OrderTicketData = {
  folio: number | null;
  createdAt: string;
  businessName: string;
  fulfillment: FulfillmentMode;
  tableLabel?: string | null;
  address?: string | null;
  references?: string | null;
  customerName: string;
  phone?: string | null;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  shippingPending?: boolean;
  discount: number;
  couponCode?: string | null;
  total: number;
  paymentMethod: "cash" | "transfer";
  cashAmount?: number | null;
  status: OrderStatus | string;
  transfer?: PublicTransferDetails | null;
  businessType?: BusinessType | string | null;
};

const PAID_STATUSES = new Set(["ready", "closed"]);

function statusLabel(status: OrderStatus | string): {
  text: string;
  paid: boolean;
} {
  if (status === "cancelled") return { text: "Cancelado", paid: false };
  if (PAID_STATUSES.has(status)) return { text: "Confirmado", paid: true };
  if (status === "preparing") return { text: "En preparación", paid: false };
  return { text: "Pendiente de confirmación", paid: false };
}

function lineTotal(item: CartItem): number {
  const extras = (item.addons ?? []).reduce((s, a) => s + a.priceDelta, 0);
  return (item.unitPrice + extras) * item.quantity;
}

function quantityLabel(item: CartItem): string {
  if (item.unitType && item.unitType !== "unit") {
    return `${item.quantity} ${item.unitType === "kg" ? "kg" : "L"}`;
  }
  return `${item.quantity}x`;
}

export function OrderTicket({
  data,
  variant = "sheet",
  autoPrint = false,
  qrUrl,
}: {
  data: OrderTicketData;
  variant?: "sheet" | "print" | "page";
  autoPrint?: boolean;
  qrUrl?: string | null;
}) {
  useEffect(() => {
    if (!autoPrint) return;
    const t = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(t);
  }, [autoPrint]);

  const isPrint = variant === "print";
  const isPage = variant === "page";
  const status = statusLabel(data.status);
  const modeLabel = fulfillmentLabelFor(
    data.fulfillment,
    data.businessType,
  );
  const shipLabel = shippingCostLabel(data.businessType);

  return (
    <div
      data-print-ticket
      className={
        isPrint
          ? "print-ticket-80mm mx-auto bg-white font-mono text-[12px] leading-tight text-black"
          : isPage
            ? "rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
            : "rounded-xl border border-dashed border-black/20 bg-background/60 p-4"
      }
    >
      {isPage ? (
        <p className="mb-3 text-center text-xs text-muted">
          Este es tu comprobante. El estado y el total se actualizan solos.
        </p>
      ) : null}
      {isPage && data.shippingPending ? (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-950">
          {shipLabel} por cotizar — el negocio te confirmará el monto.
        </p>
      ) : null}
      <div className={isPrint ? "text-center" : "text-center"}>
        <p
          className={
            isPrint ? "text-[14px] font-bold uppercase" : "text-sm font-semibold"
          }
        >
          {data.businessName}
        </p>
        <p className={isPrint ? "text-[11px]" : "text-xs text-muted"}>
          {formatMexicoCityDateTime(data.createdAt)}
        </p>
        {data.folio != null ? (
          <p
            className={
              isPrint
                ? "mt-1 text-[20px] font-bold"
                : "mt-1 text-2xl font-bold text-brand"
            }
          >
            #{data.folio}
          </p>
        ) : null}
      </div>

      <div
        className={
          isPrint
            ? "my-2 border-y border-dashed border-black py-1 text-center text-[11px] uppercase"
            : "my-3 flex justify-center"
        }
      >
        {isPrint ? (
          <span>
            {modeLabel}
            {data.tableLabel ? ` · Mesa ${data.tableLabel}` : ""}
          </span>
        ) : (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              status.paid
                ? "bg-accent/15 text-accent"
                : "bg-amber-100 text-amber-900"
            }`}
          >
            {status.text}
          </span>
        )}
      </div>

      {!isPrint ? (
        <p className="text-center text-xs text-muted">
          {modeLabel}
          {data.tableLabel ? ` · Mesa ${data.tableLabel}` : ""}
        </p>
      ) : null}

      <ul
        className={
          isPrint ? "my-2 space-y-1" : "my-3 space-y-2 border-t border-black/5 pt-3"
        }
      >
        {data.items.map((item, i) => {
          const names = item.addons?.map((a) => a.name) ?? [];
          return (
            <li key={`${item.dishId}-${i}`}>
              <div className="flex justify-between gap-2">
                <span className={isPrint ? "" : "text-sm"}>
                  {quantityLabel(item)} {item.name}
                </span>
                <span className={isPrint ? "shrink-0" : "shrink-0 text-sm"}>
                  {formatMxn(lineTotal(item))}
                </span>
              </div>
              {names.length ? (
                <p className={isPrint ? "pl-3 text-[11px]" : "pl-3 text-xs text-muted"}>
                  + {names.join(", ")}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div
        className={
          isPrint
            ? "border-t border-dashed border-black pt-1"
            : "space-y-1 border-t border-black/5 pt-3 text-sm"
        }
      >
        <div className="flex justify-between">
          <span className={isPrint ? "" : "text-muted"}>Subtotal</span>
          <span>{formatMxn(data.subtotal)}</span>
        </div>
        {data.discount > 0 ? (
          <div className="flex justify-between">
            <span className={isPrint ? "" : "text-muted"}>
              Cupón {data.couponCode ?? ""}
            </span>
            <span>−{formatMxn(data.discount)}</span>
          </div>
        ) : null}
        {data.shippingPending ? (
          <div className="flex justify-between">
            <span className={isPrint ? "" : "text-muted"}>{shipLabel}</span>
            <span>Por cotizar</span>
          </div>
        ) : data.shipping > 0 ? (
          <div className="flex justify-between">
            <span className={isPrint ? "" : "text-muted"}>{shipLabel}</span>
            <span>{formatMxn(data.shipping)}</span>
          </div>
        ) : data.fulfillment === "delivery" ? (
          <div className="flex justify-between">
            <span className={isPrint ? "" : "text-muted"}>{shipLabel}</span>
            <span>Incluido</span>
          </div>
        ) : null}
        <div
          className={
            isPrint
              ? "flex justify-between text-[14px] font-bold"
              : "flex justify-between text-base font-semibold"
          }
        >
          <span>Total</span>
          <span>{formatMxn(data.total)}</span>
        </div>
      </div>

      <div
        className={
          isPrint
            ? "mt-2 border-t border-dashed border-black pt-1 text-[11px]"
            : "mt-3 space-y-1 rounded-lg bg-brand/5 px-3 py-2 text-xs"
        }
      >
        {data.paymentMethod === "transfer" ? (
          <>
            <p className="font-semibold">Pago por transferencia</p>
            {data.transfer ? (
              <>
                {data.transfer.holder ? <p>Titular: {data.transfer.holder}</p> : null}
                {data.transfer.bank ? <p>Banco: {data.transfer.bank}</p> : null}
                <p className={isPrint ? "" : "break-all font-mono"}>
                  CLABE: {formatClabeDisplay(data.transfer.clabe)}
                </p>
              </>
            ) : null}
            <p>
              Envía tu comprobante por WhatsApp
              {data.folio != null ? ` con el folio #${data.folio}` : ""}.
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold">Pago en efectivo</p>
            <p>
              {data.fulfillment === "delivery"
                ? "Pago al recibir tu pedido."
                : "Pago en caja al recoger."}
            </p>
            {data.cashAmount != null && data.cashAmount > 0 ? (
              <p>
                Paga con {formatMxn(data.cashAmount)} · Cambio{" "}
                {formatMxn(Math.max(0, data.cashAmount - data.total))}
              </p>
            ) : null}
          </>
        )}
      </div>

      {isPrint ? (
        <div className="mt-2 border-t border-dashed border-black pt-1 text-[11px]">
          <p>Cliente: {data.customerName}</p>
          {data.phone ? <p>Tel: {data.phone}</p> : null}
          {data.address ? <p>Dirección: {data.address}</p> : null}
          {data.references ? <p>Ref: {data.references}</p> : null}
          <p className="mt-2 text-center">{status.text}</p>
          {qrUrl ? (
            <div className="mt-2 flex flex-col items-center gap-1">
              <TicketQr url={qrUrl} size={120} />
              <p className="text-center text-[10px] break-all">{qrUrl}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-center text-[11px] text-muted">
          Este comprobante no es un documento fiscal.
        </p>
      )}

      {isPage && qrUrl ? (
        <div className="mt-4 flex flex-col items-center gap-1 print:hidden">
          <TicketQr url={qrUrl} size={168} />
          <p className="text-center text-[11px] text-muted">
            Escanea para abrir este comprobante
          </p>
        </div>
      ) : null}
    </div>
  );
}
