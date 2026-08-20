"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import type { Dish } from "@/lib/types";
import { formatMxn } from "@/lib/money";
import {
  buildAppointmentMessage,
  buildWaMeUrl,
} from "@/lib/whatsapp";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dish: Dish | null;
  businessName: string;
  phoneWhatsapp: string;
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
  dish,
  businessName,
  phoneWhatsapp,
}: Props) {
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const [date, setDate] = useState(tomorrow);
  const [time, setTime] = useState("16:00");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setDate(tomorrow);
    setTime("16:00");
    setNote("");
  }, [open, dish?.id, tomorrow]);

  function requestCita() {
    if (!dish || !phoneWhatsapp.trim()) return;
    const msg = buildAppointmentMessage({
      businessName,
      serviceName: dish.name,
      price: Number(dish.price),
      dateLabel: formatDateLabel(date),
      timeLabel: formatTimeLabel(time),
      customerNote: note,
    });
    window.open(
      buildWaMeUrl(phoneWhatsapp, msg),
      "_blank",
      "noopener,noreferrer",
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "menu-sheet-in fixed inset-x-0 bottom-0 top-auto left-0 max-h-[88dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-b-none rounded-t-3xl",
          "pb-[max(1rem,env(safe-area-inset-bottom))]",
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <CalendarClock className="h-5 w-5 text-brand" />
            Solicitar cita
          </DialogTitle>
          <DialogDescription>
            {dish
              ? `Elige día y hora tentativos para ${dish.name}. Te redirigimos a WhatsApp.`
              : "Elige un servicio"}
          </DialogDescription>
        </DialogHeader>

        {dish ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-black/5 bg-background/60 px-3 py-2">
              <p className="font-semibold">{dish.name}</p>
              <p className="text-sm text-brand">
                {formatMxn(Number(dish.price))}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
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
                placeholder="Ej. Prefiero con Mariana"
                className="min-h-20"
              />
            </div>
            {!phoneWhatsapp.trim() ? (
              <p className="text-sm text-red-600">
                Este negocio aún no tiene WhatsApp configurado.
              </p>
            ) : null}
            <Button
              type="button"
              className="min-h-11 w-full"
              disabled={!date || !time || !phoneWhatsapp.trim()}
              onClick={requestCita}
            >
              Solicitar cita por WhatsApp
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
