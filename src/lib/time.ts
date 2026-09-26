// All schedule times are entered and displayed in the league's timezone (IST by default).
export const LEAGUE_TZ = process.env.NEXT_PUBLIC_LEAGUE_TZ || "Asia/Kolkata";
const LOCALE = "en-IN";

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALE, { timeZone: LEAGUE_TZ, ...opts });

const dateFmt = fmt({ weekday: "short", day: "numeric", month: "short" });
const longDateFmt = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeFmt = fmt({ hour: "numeric", minute: "2-digit", hour12: true });
const tzNameFmt = fmt({ timeZoneName: "short" });

export const tzLabel = () =>
  tzNameFmt.formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? LEAGUE_TZ;

export const fmtDate = (iso: string) => dateFmt.format(new Date(iso));
export const fmtLongDate = (iso: string) => longDateFmt.format(new Date(iso));
export const fmtTime = (iso: string) => timeFmt.format(new Date(iso)).toUpperCase();
export const fmtDateTime = (iso: string) => `${fmtDate(iso)} · ${fmtTime(iso)}`;

function zonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LEAGUE_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute"), s: get("second") };
}

function offsetMinutes(date: Date): number {
  const p = zonedParts(date);
  return (Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - date.getTime()) / 60000;
}

/** "YYYY-MM-DD" of an instant, in the league timezone. */
export function dateKey(iso: string): string {
  const p = zonedParts(new Date(iso));
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** Value for an <input type="datetime-local"> in the league timezone. */
export function toZonedInput(iso: string | null): string {
  if (!iso) return "";
  const p = zonedParts(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}`;
}

/** Parses "YYYY-MM-DDTHH:mm" (league timezone) into an ISO instant. */
export function fromZonedInput(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [y, m, d, h, min] = match.slice(1).map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  let ts = guess - offsetMinutes(new Date(guess)) * 60000;
  const corrected = guess - offsetMinutes(new Date(ts)) * 60000;
  if (corrected !== ts) ts = corrected;
  return new Date(ts).toISOString();
}
