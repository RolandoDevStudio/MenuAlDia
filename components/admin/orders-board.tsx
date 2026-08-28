"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { Bell, BellOff, Printer } from "lucide-react";
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

const CHIME_KEY = "mad-orders-chime";
const CHIME_EVENT = "mad-orders-chime-change";
const POLL_MS = 20_000;

const chimeStore = {
  subscribe(onChange: () => void) {
    window.addEventListener(CHIME_EVENT, onChange);
    return () => window.removeEventListener(CHIME_EVENT, onChange);
  },
  get() {
    return localStorage.getItem(CHIME_KEY) === "1";
  },
  set(value: boolean) {
    localStorage.setItem(CHIME_KEY, value ? "1" : "0");
    window.dispatchEvent(new Event(CHIME_EVENT));
  },
};

function customerName(p: OrderLogPayload) {
  return p.customer_name || p.customerName || "Cliente";
}

/** Two short beeps via WebAudio, so no audio asset has to ship. */
function playChime(ctx: AudioContext) {
  const now = ctx.currentTime;
  [0, 0.18].forEach((offset, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = i === 0 ? 880 : 1170;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.18);
  });
}

export function OrdersBoard({
  initialOrders,
  channelCrm = false,
}: {
  initialOrders: Order[];
  channelCrm?: boolean;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState<Filter>("today");
  const [busyId, setBusyId] = useState<string | null>(null);
  const chimeOn = useSyncExternalStore(
    chimeStore.subscribe,
    chimeStore.get,
    () => false,
  );
  const [freshIds, setFreshIds] = useState<string[]>([]);
  const audioRef = useRef<AudioContext | null>(null);
  const lastSeenRef = useRef<string>(
    initialOrders[0]?.created_at ?? new Date().toISOString(),
  );

  const today = mexicoCityTodayYmd();

  // Browsers only allow audio after a gesture, so the toggle itself unlocks it.
  function toggleChime() {
    const next = !chimeOn;
    chimeStore.set(next);
    if (!next) return;
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      audioRef.current ??= new Ctor();
      void audioRef.current.resume();
      playChime(audioRef.current);
    } catch {
      /* audio unavailable */
    }
  }

  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const res = await fetch(
        `/api/admin/orders?after=${encodeURIComponent(lastSeenRef.current)}`,
      );
      if (!res.ok) return;
      const json = (await res.json()) as { orders?: Order[] };
      const incoming = json.orders ?? [];
      if (incoming.length === 0) return;

      lastSeenRef.current = incoming[0]!.created_at;
      setOrders((prev) => {
        const known = new Set(prev.map((o) => o.id));
        const added = incoming.filter((o) => !known.has(o.id));
        if (added.length === 0) return prev;
        return [...added, ...prev];
      });
      setFreshIds((prev) => [...incoming.map((o) => o.id), ...prev]);
      if (chimeOn && audioRef.current) playChime(audioRef.current);
    } catch {
      /* offline: retry on next tick */
    }
  }, [chimeOn]);

  useEffect(() => {
    if (!channelCrm) return;
    const t = window.setInterval(() => void poll(), POLL_MS);
    return () => window.clearInterval(t);
  }, [channelCrm, poll]);

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
      <div className="flex flex-wrap items-center gap-1.5">
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
        {channelCrm ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto min-h-9"
            aria-pressed={chimeOn}
            onClick={toggleChime}
          >
            {chimeOn ? (
              <Bell className="mr-1.5 h-4 w-4" aria-hidden />
            ) : (
              <BellOff className="mr-1.5 h-4 w-4" aria-hidden />
            )}
            {chimeOn ? "Alerta activa" : "Activar alerta"}
          </Button>
        ) : null}
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
                className={cn(
                  "rounded-xl border border-black/5 bg-surface px-3 py-3",
                  freshIds.includes(o.id) && "ring-2 ring-brand/40",
                )}
              >
                <div className="flex justify-between gap-2">
                  <p className="font-medium">
                    {o.folio != null ? (
                      <span className="mr-1.5 text-muted">#{o.folio}</span>
                    ) : null}
                    {customerName(payload)}
                  </p>
                  <p className="text-sm font-semibold text-brand">
                    {formatMxn(Number(o.total))}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {formatMexicoCityDateTime(o.created_at)}
                  {mode ? ` · ${FULFILLMENT_LABELS[mode]}` : ""}
                  {payload.table_label ? ` · Mesa ${payload.table_label}` : ""}
                </p>
                {payload.address ? (
                  <p className="mt-1 text-xs text-muted">
                    {payload.address}
                    {payload.references ? ` · ${payload.references}` : ""}
                  </p>
                ) : null}
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
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={`/admin/orders/${o.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Printer className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Comanda
                    </a>
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
