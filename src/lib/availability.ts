// Player availability helpers (shared by server pages and client components).
import type { DateStatus, PlayerAvailability } from "./types";

export const DAYS = [
  { n: 1, short: "Mon", letter: "M" },
  { n: 2, short: "Tue", letter: "T" },
  { n: 3, short: "Wed", letter: "W" },
  { n: 4, short: "Thu", letter: "T" },
  { n: 5, short: "Fri", letter: "F" },
  { n: 6, short: "Sat", letter: "S" },
  { n: 0, short: "Sun", letter: "S" },
] as const;

export type AvailabilityLevel = "high" | "medium" | "low" | "unset";

export function availabilityLevel(a: Pick<PlayerAvailability, "days"> | null | undefined): AvailabilityLevel {
  const n = a?.days?.length ?? 0;
  return n === 0 ? "unset" : n >= 5 ? "high" : n >= 3 ? "medium" : "low";
}

export const LEVEL_LABEL: Record<AvailabilityLevel, string> = {
  high: "Very available",
  medium: "Mostly available",
  low: "Limited",
  unset: "Not shared",
};

/** "20:00" → "8 PM", "23:30" → "11:30 PM", "24:00" → "12 AM" */
export function fmtClock(t: string | null | undefined): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const hh = h % 24;
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${ampm}` : `${h12} ${ampm}`;
}

export function timeWindow(a: Pick<PlayerAvailability, "time_from" | "time_to"> | null | undefined): string {
  if (!a?.time_from && !a?.time_to) return "Any time";
  if (a.time_from && a.time_to) return `${fmtClock(a.time_from)}–${fmtClock(a.time_to)}`;
  return a.time_from ? `from ${fmtClock(a.time_from)}` : `until ${fmtClock(a.time_to)}`;
}

/** Selectable times for the editor: 12:00 → 24:00 every 30 minutes. */
export const TIME_OPTIONS = Array.from({ length: 25 }, (_, i) => {
  const mins = 12 * 60 + i * 30;
  const v = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  return { value: v, label: fmtClock(v) };
});

// ---------------------------------------------------------------------------
// Match-day calendar (dates are "YYYY-MM-DD", read as calendar days, no timezone)
// ---------------------------------------------------------------------------

export const DATE_STATUS: Record<DateStatus, { label: string; short: string; symbol: string }> = {
  yes: { label: "Available", short: "Yes", symbol: "✓" },
  maybe: { label: "Maybe", short: "Maybe", symbol: "?" },
  no: { label: "Can't play", short: "No", symbol: "✕" },
};

/** Tap order in the calendar: unanswered → yes → maybe → no → unanswered. */
export function nextStatus(s: DateStatus | undefined): DateStatus | undefined {
  return s === undefined ? "yes" : s === "yes" ? "maybe" : s === "maybe" ? "no" : undefined;
}

const asDate = (day: string) => new Date(`${day}T12:00:00Z`);
const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", ...opts });
const weekdayFmt = fmt({ weekday: "short" });
const dayMonthFmt = fmt({ day: "numeric", month: "short" });
const longFmt = fmt({ weekday: "long", day: "numeric", month: "long" });
const monthFmt = fmt({ month: "long", year: "numeric" });

export const weekdayOf = (day: string) => asDate(day).getUTCDay();
/** "Sat" */
export const fmtWeekday = (day: string) => weekdayFmt.format(asDate(day));
/** "24 Oct" */
export const fmtDayMonth = (day: string) => dayMonthFmt.format(asDate(day));
/** "Saturday, 24 October" */
export const fmtLongDay = (day: string) => longFmt.format(asDate(day));
/** "October 2026" for "2026-10" */
export const fmtMonth = (month: string) => monthFmt.format(asDate(`${month}-01`));

export const monthOf = (day: string) => day.slice(0, 7);
export function addMonths(month: string, n: number): string {
  const d = asDate(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}

/** Calendar cells for a month, Monday first; null pads the first week. */
export function monthCells(month: string): (string | null)[] {
  const first = asDate(`${month}-01`);
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (const d = new Date(first); d.toISOString().slice(0, 7) === month; d.setUTCDate(d.getUTCDate() + 1)) cells.push(d.toISOString().slice(0, 10));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export interface DateSummary {
  total: number;
  yes: number;
  maybe: number;
  no: number;
  unanswered: number;
}

export function dateSummary(days: string[], answers: Record<string, DateStatus> | undefined): DateSummary {
  const s = { total: days.length, yes: 0, maybe: 0, no: 0, unanswered: 0 };
  for (const d of days) {
    const a = answers?.[d];
    if (a) s[a]++;
    else s.unanswered++;
  }
  return s;
}

/** Same scale as the weekly level, from the share of match days a player can make. */
export function dateLevel(s: DateSummary): AvailabilityLevel {
  if (!s.total || s.unanswered === s.total) return "unset";
  const share = (s.yes + s.maybe * 0.5) / s.total;
  return share >= 0.8 ? "high" : share >= 0.5 ? "medium" : "low";
}

/** For sorting: yes counts 1, maybe half. */
export const dateScore = (s: DateSummary) => s.yes + s.maybe * 0.5;
