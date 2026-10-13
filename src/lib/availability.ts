// Player availability helpers (shared by server pages and client components).
import type { PlayerAvailability } from "./types";

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
