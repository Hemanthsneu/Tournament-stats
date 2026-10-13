import { DAYS, availabilityLevel, LEVEL_LABEL, timeWindow } from "@/lib/availability";
import type { PlayerAvailability } from "@/lib/types";
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

export function AvailabilityBadge({ availability }: { availability: PlayerAvailability | null | undefined }) {
  const level = availabilityLevel(availability);
  return <span className={cn("rounded-sm px-1.5 py-0.5 font-heading text-[11px] font-bold tracking-wide uppercase", LEVEL_TONE[level])}>{LEVEL_LABEL[level]}</span>;
}

/** Full block: badge, week strip, time window and note. */
export function AvailabilityBlock({ availability, className }: { availability: PlayerAvailability | null | undefined; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <AvailabilityBadge availability={availability} />
        {availability && availability.days.length > 0 && <span className="text-xs text-muted-foreground">{availability.days.length} days/week · {timeWindow(availability)}</span>}
      </div>
      <WeekStrip availability={availability} size="md" />
      {availability?.note && <p className="text-xs text-muted-foreground italic">“{availability.note}”</p>}
    </div>
  );
}
