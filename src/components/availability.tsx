import { DATE_STATUS, DAYS, availabilityLevel, dateLevel, dateSummary, fmtDayMonth, fmtWeekday, LEVEL_LABEL, timeWindow } from "@/lib/availability";
import type { DateStatus, PlayerAvailability } from "@/lib/types";
import { cn } from "@/lib/utils";

const LEVEL_TONE = {
  high: "bg-win-soft text-win",
  medium: "bg-gold-soft text-gold",
  low: "bg-loss-soft text-loss",
  unset: "bg-muted text-muted-foreground",
} as const;

/** M T W T F S S strip, lit on the days the player can play. */
export function WeekStrip({ availability, size = "sm", className }: { availability: PlayerAvailability | null | undefined; size?: "xs" | "sm" | "md"; className?: string }) {
  const days = new Set(availability?.days ?? []);
  const box = size === "xs" ? "size-3.5 text-[8px]" : size === "md" ? "size-7 text-xs" : "size-5 text-[10px]";
  return (
    <span className={cn("inline-flex gap-0.5", className)} aria-label={`Available: ${DAYS.filter((d) => days.has(d.n)).map((d) => d.short).join(", ") || "not shared"}`}>
      {DAYS.map((d) => (
        <span
          key={d.n}
          title={d.short}
          className={cn("grid place-items-center rounded-[3px] font-heading font-bold", box, days.has(d.n) ? "bg-win text-white" : "bg-muted text-muted-foreground/60")}
        >
          {d.letter}
        </span>
      ))}
    </span>
  );
}

export interface MatchDates {
  days: { day: string; label: string | null }[];
  answers: Record<string, DateStatus> | undefined;
}

const DATE_TONE: Record<DateStatus | "open", string> = {
  yes: "bg-win text-white",
  maybe: "bg-gold-soft text-gold ring-1 ring-inset ring-gold/50",
  no: "bg-loss-soft text-loss/70 line-through",
  open: "bg-muted text-muted-foreground/60",
};

/** One cell per match day, coloured by the player's answer. */
export function DateStrip({ dates, size = "sm", className }: { dates: MatchDates; size?: "xs" | "sm" | "md"; className?: string }) {
  const box = size === "xs" ? "h-4 min-w-4 px-0.5 text-[8px]" : size === "md" ? "h-10 min-w-9 px-1 text-xs" : "h-6 min-w-6 px-0.5 text-[10px]";
  const s = dateSummary(
    dates.days.map((d) => d.day),
    dates.answers,
  );
  return (
    <span className={cn("inline-flex flex-wrap gap-0.5", className)} aria-label={`Available on ${s.yes} of ${s.total} match days${s.maybe ? `, maybe ${s.maybe}` : ""}`}>
      {dates.days.map(({ day, label }) => {
        const a = dates.answers?.[day];
        return (
          <span
            key={day}
            title={`${fmtWeekday(day)} ${fmtDayMonth(day)}${label ? ` · ${label}` : ""}: ${a ? DATE_STATUS[a].label : "not answered"}`}
            className={cn("grid place-items-center rounded-[3px] font-heading leading-none font-bold tabular", box, DATE_TONE[a ?? "open"])}
          >
            {size === "md" ? (
              <span className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] font-semibold opacity-80">{fmtWeekday(day)}</span>
                {Number(day.slice(8))}
              </span>
            ) : (
              Number(day.slice(8))
            )}
          </span>
        );
      })}
    </span>
  );
}

export function AvailabilityBadge({ availability, dates }: { availability: PlayerAvailability | null | undefined; dates?: MatchDates }) {
  const level =
    dates && dates.days.length && Object.keys(dates.answers ?? {}).length
      ? dateLevel(
          dateSummary(
            dates.days.map((d) => d.day),
            dates.answers,
          ),
        )
      : availabilityLevel(availability);
  return <span className={cn("rounded-sm px-1.5 py-0.5 font-heading text-[11px] font-bold tracking-wide uppercase", LEVEL_TONE[level])}>{LEVEL_LABEL[level]}</span>;
}

/** Full block: badge, week strip, time window and note. */
export function AvailabilityBlock({ availability, dates, className }: { availability: PlayerAvailability | null | undefined; dates?: MatchDates; className?: string }) {
  const s = dates?.days.length
    ? dateSummary(
        dates.days.map((d) => d.day),
        dates.answers,
      )
    : null;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <AvailabilityBadge availability={availability} dates={dates} />
        {s && s.unanswered < s.total && (
          <span className="text-xs text-muted-foreground">
            {s.yes}/{s.total} match days{s.maybe ? ` · ${s.maybe} maybe` : ""}
            {s.no ? ` · ${s.no} out` : ""}
          </span>
        )}
        {availability && availability.days.length > 0 && <span className="text-xs text-muted-foreground">{availability.days.length} days/week · {timeWindow(availability)}</span>}
      </div>
      {dates && dates.days.length > 0 ? <DateStrip dates={dates} size="md" /> : <WeekStrip availability={availability} size="md" />}
      {availability?.note && <p className="text-xs text-muted-foreground italic">“{availability.note}”</p>}
    </div>
  );
}
