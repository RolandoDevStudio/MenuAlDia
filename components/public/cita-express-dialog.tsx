"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { formatMxn } from "@/lib/money";
import {
  buildAppointmentMessage,
  buildWaMeUrl,
} from "@/lib/whatsapp";
import { isDemoOrEmbedded } from "@/lib/canonical-demos";
import { can, type PlanType } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type CitaServiceLine = {
  name: string;
  price: number;
  quantity?: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: CitaServiceLine[];
  businessName: string;
  phoneWhatsapp: string;
  restaurantId: string;
  restaurantSlug?: string | null;
  planType?: PlanType | string | null;
  onBooked?: () => void;
};

function formatDateLabel(isoDate: string) {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTimeLabel(hhmm: string) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString("es-MX", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CitaExpressDialog({
  open,
  onOpenChange,
  services,
  businessName,
  phoneWhatsapp,
  restaurantId,
  restaurantSlug,
  planType,
  onBooked,
}: Props) {
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const [date, setDate] = useState(tomorrow);
  const [time, setTime] = useState("16:00");
  const [note, setNote] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const serviceNames = useMemo(
    () =>
      services.flatMap((s) => {
        const q = s.quantity ?? 1;
        const label = q > 1 ? `${q}× ${s.name}` : s.name;
        return [label];
      }),
    [services],
  );

  const totalPrice = useMemo(
    () =>
      services.reduce(
        (sum, s) => sum + Number(s.price) * (s.quantity ?? 1),
        0,
      ),
    [services],
  );

  useEffect(() => {
    if (!open) return;
    setDate(tomorrow);
    setTime("16:00");
    setNote("");
    setCustomerName("");
    setCustomerPhone("");
    setError(null);
  }, [open, tomorrow]);

  async function requestCita() {
    if (!phoneWhatsapp.trim()) return;
    const name = customerName.trim();
    const phone = customerPhone.trim();
    if (name.length < 2) {
      setError("Escribe tu nombre");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Escribe un teléfono válido (10+ dígitos)");
      return;
    }
    if (!date || !time) {
      setError("Elige día y hora");
      return;
    }
    if (serviceNames.length === 0) {
      setError("No hay servicios para agendar");
      return;
    }

    setBusy(true);
    setError(null);

    if (can(planType, "crm")) {
      try {
        await fetch("/api/public/appointment-lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurant_id: restaurantId,
            name,
            phone,
          }),
        });
      } catch {
        /* WA still goes out */
      }
    }

    const msg = buildAppointmentMessage({
      businessName,
      serviceName: serviceNames[0]!,
      serviceNames,
      price: totalPrice,
      dateLabel: formatDateLabel(date),
      timeLabel: formatTimeLabel(time),
      customerName: name,
      customerPhone: phone,
      customerNote: note,
    });
    void fetch("/api/public/wa-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurant_id: restaurantId }),
      keepalive: true,
    }).catch(() => {});
    if (isDemoOrEmbedded(restaurantSlug)) {
      setError("En la demo los envíos son simulados");
      setBusy(false);
      return;
    }
    window.open(
      buildWaMeUrl(phoneWhatsapp, msg),
      "_blank",
      "noopener,noreferrer",
    );
    setBusy(false);
    onBooked?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "menu-sheet-in fixed inset-x-0 bottom-0 top-auto left-0 max-h-[88dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-b-none rounded-t-3xl",
          "overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]",
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <CalendarClock className="h-5 w-5 text-brand" />
            Solicitar cita
          </DialogTitle>
          <DialogDescription>
            Déjanos tu nombre y teléfono. Te redirigimos a WhatsApp para
            confirmar.
          </DialogDescription>
        </DialogHeader>

        {services.length > 0 ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-black/5 bg-background/60 px-3 py-2">
              <ul className="space-y-1 text-sm">
                {serviceNames.map((n) => (
                  <li key={n} className="font-semibold">
                    {n}
                  </li>
                ))}
              </ul>
              {totalPrice > 0 ? (
                <p className="mt-1 text-sm text-brand">
                  {formatMxn(totalPrice)}
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cita-name">Tu nombre *</Label>
                <Input
                  id="cita-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ej. Ana López"
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cita-phone">Tu WhatsApp *</Label>
                <Input
                  id="cita-phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="5512345678"
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cita-date">Día tentativo</Label>
                <Input
                  id="cita-date"
                  type="date"
                  value={date}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cita-time">Hora</Label>
                <Input
                  id="cita-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cita-note">Nota (opcional)</Label>
              <Textarea
                id="cita-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej. Prefiero con Mariana / a domicilio"
                className="min-h-20"
              />
            </div>
            {!phoneWhatsapp.trim() ? (
              <p className="text-sm text-red-600">
                Este negocio aún no tiene WhatsApp configurado.
              </p>
            ) : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button
              type="button"
              className="min-h-11 w-full"
              disabled={busy || !phoneWhatsapp.trim()}
              onClick={() => void requestCita()}
            >
              {busy ? "Abriendo…" : "Solicitar cita por WhatsApp"}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
