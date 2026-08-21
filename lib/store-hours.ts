/** Store hours (America/Mexico_City) and effective open/closed state. */

export type TimeSlot = { open: string; close: string };

export type DayHours = {
  closed: boolean;
  slots: TimeSlot[];
};

/** 0 = Sunday … 6 = Saturday (Date.getDay / CDMX weekday). */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type ScheduleHours = Partial<Record<WeekdayIndex, DayHours>>;

export type OrdersOverride = "force_open" | "force_closed" | null;

export const WEEKDAY_LABELS: Record<WeekdayIndex, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function emptyWeekHours(): ScheduleHours {
  const out: ScheduleHours = {};
  for (let d = 0; d <= 6; d++) {
    out[d as WeekdayIndex] = { closed: true, slots: [] };
  }
  return out;
}

/** Sensible default when enabling auto for the first time. */
export function defaultWeekHours(): ScheduleHours {
  const out = emptyWeekHours();
  for (let d = 1; d <= 6; d++) {
    out[d as WeekdayIndex] = {
      closed: false,
      slots: [{ open: "09:00", close: "18:00" }],
    };
  }
  out[0] = { closed: true, slots: [] };
  return out;
}

export function parseScheduleHours(raw: unknown): ScheduleHours {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const row = raw as Record<string, unknown>;
  const out: ScheduleHours = {};
  for (let d = 0; d <= 6; d++) {
    const key = String(d);
    const day = row[key];
    if (!day || typeof day !== "object") continue;
    const obj = day as Record<string, unknown>;
    const closed = Boolean(obj.closed);
    const slotsRaw = Array.isArray(obj.slots) ? obj.slots : [];
    const slots: TimeSlot[] = [];
    for (const s of slotsRaw) {
      if (!s || typeof s !== "object") continue;
      const open = String((s as { open?: string }).open ?? "").trim();
      const close = String((s as { close?: string }).close ?? "").trim();
      if (HHMM.test(open) && HHMM.test(close)) {
        slots.push({ open, close });
      }
    }
    out[d as WeekdayIndex] = { closed, slots };
  }
  return out;
}

export function hasConfiguredHours(hours: ScheduleHours): boolean {
  return Object.keys(hours).length > 0;
}

function minutesFromHhmm(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
}

/** Current weekday + minutes since midnight in America/Mexico_City. */
export function mexicoCityClock(now: Date = new Date()): {
  weekday: WeekdayIndex;
  minutes: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const map: Record<string, WeekdayIndex> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return {
    weekday: map[wd] ?? 1,
    minutes: hour * 60 + minute,
  };
}

/**
 * True if current CDMX time falls in any slot for today.
 * Overnight slots (close < open) span past midnight.
 */
export function isOpenAccordingToHours(
  hours: ScheduleHours,
  now: Date = new Date(),
): boolean {
  if (!hasConfiguredHours(hours)) return true;
  const { weekday, minutes } = mexicoCityClock(now);
  const today = hours[weekday];
  if (!today || today.closed) return false;
  if (!today.slots.length) return false;

  for (const slot of today.slots) {
    const o = minutesFromHhmm(slot.open);
    const c = minutesFromHhmm(slot.close);
    if (c > o) {
      if (minutes >= o && minutes < c) return true;
    } else if (c < o) {
      // e.g. 22:00–02:00
      if (minutes >= o || minutes < c) return true;
    }
  }

  // Also: overnight from previous day
  const prev = ((weekday + 6) % 7) as WeekdayIndex;
  const yesterday = hours[prev];
  if (yesterday && !yesterday.closed) {
    for (const slot of yesterday.slots) {
      const o = minutesFromHhmm(slot.open);
      const c = minutesFromHhmm(slot.close);
      if (c < o && minutes < c) return true;
    }
  }
  return false;
}

export type StoreOpenInput = {
  accepting_orders?: boolean | null;
  schedule_auto?: boolean | null;
  schedule_hours?: unknown;
  orders_override?: string | null;
};

/** Effective “accepting orders” for public + admin UI. */
export function effectiveAcceptingOrders(input: StoreOpenInput): boolean {
  const override = input.orders_override;
  if (override === "force_open") return true;
  if (override === "force_closed") return false;
  if (input.schedule_auto) {
    const hours = parseScheduleHours(input.schedule_hours);
    if (hasConfiguredHours(hours)) {
      return isOpenAccordingToHours(hours);
    }
  }
  return input.accepting_orders !== false;
}

function formatSlot(s: TimeSlot): string {
  return `${s.open}–${s.close}`;
}

/** Human schedule_text from structured hours (CDMX). */
export function formatScheduleText(hours: ScheduleHours): string {
  if (!hasConfiguredHours(hours)) {
    return "Horario por confirmar";
  }
  const lines: string[] = [];
  // Group consecutive days with same config
  type Sig = string;
  const sigOf = (d: DayHours | undefined): Sig => {
    if (!d || d.closed || !d.slots.length) return "closed";
    return d.slots.map(formatSlot).join(",");
  };

  let i = 1; // start Mon for MX readability, then Sun
  const order: WeekdayIndex[] = [1, 2, 3, 4, 5, 6, 0];
  let start = 0;
  while (start < order.length) {
    const day = order[start]!;
    const sig = sigOf(hours[day]);
    let end = start;
    while (
      end + 1 < order.length &&
      sigOf(hours[order[end + 1]!]) === sig
    ) {
      end++;
    }
    const label =
      start === end
        ? WEEKDAY_LABELS[order[start]!]
        : `${WEEKDAY_LABELS[order[start]!].slice(0, 3)}–${WEEKDAY_LABELS[order[end]!].slice(0, 3)}`;
    if (sig === "closed") {
      lines.push(`${label}: cerrado`);
    } else {
      lines.push(`${label}: ${sig.replace(/,/g, ", ")}`);
    }
    start = end + 1;
    void i;
  }
  return lines.join(" · ");
}

export const DEFAULT_CLOSED_MESSAGE =
  "Cerrado por hoy — puedes ver el catálogo; los pedidos pueden no atenderse.";

export function publicClosedMessage(raw: string | null | undefined): string {
  const t = String(raw ?? "").trim();
  return t || DEFAULT_CLOSED_MESSAGE;
}
