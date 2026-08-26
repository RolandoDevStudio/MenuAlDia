/** Product calendar timezone: CDMX, GDL, NL, Yucatán (UTC-6 year-round). */
export const APP_TIMEZONE = "America/Mexico_City";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertYmd(dateYmd: string): string {
  const ymd = dateYmd.trim().slice(0, 10);
  if (!YMD_RE.test(ymd)) {
    throw new Error("fecha inválida");
  }
  return ymd;
}

/** Normalize Intl offset labels (e.g. "GMT-6", "GMT-06:00") → "+HH:MM"/"-HH:MM". */
export function mexicoCityOffsetIso(ymd: string): string {
  const probe = new Date(`${ymd}T12:00:00.000Z`);
  let raw = "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: APP_TIMEZONE,
      timeZoneName: "longOffset",
    }).formatToParts(probe);
    raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    raw = "";
  }
  if (!raw) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: APP_TIMEZONE,
        timeZoneName: "shortOffset",
      }).formatToParts(probe);
      raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    } catch {
      raw = "GMT-06:00";
    }
  }
  const m = raw.replace(/^GMT/i, "").match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!m) return "-06:00";
  const sign = m[1]!;
  const hh = m[2]!.padStart(2, "0");
  const mm = (m[3] ?? "00").padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

/** Calendar date YYYY-MM-DD in America/Mexico_City. */
export function mexicoCityTodayYmd(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Calendar YYYY-MM-DD of an instant in America/Mexico_City. */
export function ymdInMexicoCity(isoOrDate: string | Date): string {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return "";
  return mexicoCityTodayYmd(d);
}

/** Start of calendar day 00:00:00.000 in America/Mexico_City → UTC ISO. */
export function startOfMexicoCityDay(dateYmd: string): string {
  const ymd = assertYmd(dateYmd);
  const offset = mexicoCityOffsetIso(ymd);
  const d = new Date(`${ymd}T00:00:00.000${offset}`);
  if (Number.isNaN(d.getTime())) {
    throw new Error("fecha inválida");
  }
  return d.toISOString();
}

/** End of calendar day 23:59:59.999 in America/Mexico_City → UTC ISO. */
export function endOfMexicoCityDay(dateYmd: string): string {
  const ymd = assertYmd(dateYmd);
  const offset = mexicoCityOffsetIso(ymd);
  const d = new Date(`${ymd}T23:59:59.999${offset}`);
  if (Number.isNaN(d.getTime())) {
    throw new Error("fecha inválida");
  }
  return d.toISOString();
}

/** Noon in America/Mexico_City for a date-only field (paid_at, birthday). */
export function ymdAtMexicoCityNoonIso(dateYmd: string): string {
  const ymd = assertYmd(dateYmd);
  const offset = mexicoCityOffsetIso(ymd);
  const d = new Date(`${ymd}T12:00:00.000${offset}`);
  if (Number.isNaN(d.getTime())) {
    throw new Error("fecha inválida");
  }
  return d.toISOString();
}

/** Shift a YYYY-MM-DD by whole calendar days (no timezone). */
export function addCalendarDaysYmd(ymd: string, days: number): string {
  const v = assertYmd(ymd);
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days));
  return dt.toISOString().slice(0, 10);
}

export function formatMexicoCityDate(
  iso: string | Date,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { timeZone: APP_TIMEZONE, ...options });
}

export function formatMexicoCityDateTime(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-MX", { timeZone: APP_TIMEZONE });
}

/** Whole calendar days from today CDMX to the instant's CDMX date (0 = vence hoy). */
export function calendarDaysUntilMexicoCity(
  iso: string | Date | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!iso) return null;
  const endYmd = ymdInMexicoCity(iso);
  if (!endYmd) return null;
  const todayYmd = mexicoCityTodayYmd(now);
  const [ey, em, ed] = endYmd.split("-").map(Number);
  const [ty, tm, td] = todayYmd.split("-").map(Number);
  const endUtc = Date.UTC(ey!, em! - 1, ed!);
  const todayUtc = Date.UTC(ty!, tm! - 1, td!);
  return Math.round((endUtc - todayUtc) / 86_400_000);
}
