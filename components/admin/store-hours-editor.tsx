"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  WEEKDAY_LABELS,
  defaultWeekHours,
  emptyWeekHours,
  formatScheduleText,
  hasConfiguredHours,
  parseScheduleHours,
  type DayHours,
  type ScheduleHours,
  type TimeSlot,
  type WeekdayIndex,
} from "@/lib/store-hours";

const DAY_ORDER: WeekdayIndex[] = [1, 2, 3, 4, 5, 6, 0];

type Props = {
  value: ScheduleHours;
  onChange: (next: ScheduleHours) => void;
  scheduleAuto: boolean;
  onScheduleAutoChange: (v: boolean) => void;
  closedMessage: string;
  onClosedMessageChange: (v: string) => void;
};

export function StoreHoursEditor({
  value,
  onChange,
  scheduleAuto,
  onScheduleAutoChange,
  closedMessage,
  onClosedMessageChange,
}: Props) {
  const hours = hasConfiguredHours(value) ? value : emptyWeekHours();

  function setDay(day: WeekdayIndex, patch: Partial<DayHours>) {
    const current = hours[day] ?? { closed: true, slots: [] };
    onChange({
      ...hours,
      [day]: { ...current, ...patch },
    });
  }

  function setSlot(
    day: WeekdayIndex,
    index: number,
    patch: Partial<TimeSlot>,
  ) {
    const current = hours[day] ?? { closed: false, slots: [] };
    const slots = [...current.slots];
    const slot = slots[index] ?? { open: "09:00", close: "18:00" };
    slots[index] = { ...slot, ...patch };
    setDay(day, { closed: false, slots });
  }

  function addSlot(day: WeekdayIndex) {
    const current = hours[day] ?? { closed: false, slots: [] };
    setDay(day, {
      closed: false,
      slots: [...current.slots, { open: "14:00", close: "18:00" }],
    });
  }

  function removeSlot(day: WeekdayIndex, index: number) {
    const current = hours[day] ?? { closed: false, slots: [] };
    const slots = current.slots.filter((_, i) => i !== index);
    setDay(day, {
      closed: slots.length === 0,
      slots,
    });
  }

  const preview = formatScheduleText(hours);

  return (
    <div className="space-y-4 rounded-xl border border-black/5 bg-surface p-4">
      <div>
        <h2 className="text-sm font-semibold">Horario y apertura</h2>
        <p className="mt-1 text-xs text-muted">
          Define franjas por día (hora CDMX). Puedes abrir/cerrar el negocio
          automáticamente según este horario.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-black/5 bg-white/80 px-3 py-2">
        <div>
          <p className="text-sm font-medium">Abrir/cerrar según horario</p>
          <p className="text-[11px] text-muted">
            El switch del inicio puede forzar abierto o cerrado (override).
          </p>
        </div>
        <Switch
          checked={scheduleAuto}
          onCheckedChange={(v) => {
            onScheduleAutoChange(v);
            if (v && !hasConfiguredHours(value)) {
              onChange(defaultWeekHours());
            }
          }}
          aria-label="Horario automático"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="closed_message_settings">
          Mensaje de cierre (opcional)
        </Label>
        <Input
          id="closed_message_settings"
          value={closedMessage}
          maxLength={160}
          onChange={(e) => onClosedMessageChange(e.target.value)}
          placeholder="Ej. Cerrado por inventarios, regresamos mañana"
        />
        <p className="text-[11px] text-muted">
          Se muestra en el menú público cuando el negocio está cerrado. Vacío =
          texto por defecto.
        </p>
      </div>

      <ul className="space-y-3">
        {DAY_ORDER.map((day) => {
          const d = hours[day] ?? { closed: true, slots: [] };
          const closed = d.closed || d.slots.length === 0;
          return (
            <li
              key={day}
              className="rounded-lg border border-black/5 bg-white/80 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{WEEKDAY_LABELS[day]}</p>
                <label className="flex items-center gap-2 text-xs text-muted">
                  <span>Cerrado</span>
                  <Switch
                    checked={closed}
                    onCheckedChange={(v) => {
                      if (v) {
                        setDay(day, { closed: true, slots: [] });
                      } else {
                        setDay(day, {
                          closed: false,
                          slots:
                            d.slots.length > 0
                              ? d.slots
                              : [{ open: "09:00", close: "18:00" }],
                        });
                      }
                    }}
                  />
                </label>
              </div>
              {!closed ? (
                <div className="mt-2 space-y-2">
                  {d.slots.map((slot, i) => (
                    <div key={i} className="flex flex-wrap items-end gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Abre</Label>
                        <Input
                          type="time"
                          className="min-h-11 w-[8.5rem]"
                          value={slot.open}
                          onChange={(e) =>
                            setSlot(day, i, { open: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Cierra</Label>
                        <Input
                          type="time"
                          className="min-h-11 w-[8.5rem]"
                          value={slot.close}
                          onChange={(e) =>
                            setSlot(day, i, { close: e.target.value })
                          }
                        />
                      </div>
                      {d.slots.length > 1 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeSlot(day, i)}
                        >
                          Quitar
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addSlot(day)}
                  >
                    + Franja
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="rounded-lg bg-black/[0.03] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          Vista previa (texto del menú)
        </p>
        <p className="mt-1 text-sm text-foreground">{preview}</p>
      </div>

      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => onChange(defaultWeekHours())}
      >
        Restaurar Lun–Sáb 9–18
      </Button>
    </div>
  );
}

export function scheduleHoursFromRestaurant(raw: unknown): ScheduleHours {
  const parsed = parseScheduleHours(raw);
  return hasConfiguredHours(parsed) ? parsed : emptyWeekHours();
}
