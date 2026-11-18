import { AVAIL_TIER, dateLevel, dateShare, dateSummary } from "@/lib/availability";
import type { DateStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONE = { high: "bg-win/15 text-win", medium: "bg-gold/15 text-gold", low: "bg-loss/15 text-loss", unset: "bg-white/10 text-white/60" } as const;

/**
 * How much of the season a player can actually play, and what that does to their numbers:
 * a 20-kill player who makes 40% of match days is worth ~8 kills per match day to a captain.
 */
export function AvailabilityVerdict({
  days,
  answers,
  avgKills,
  rating,
  captainNote,
}: {
  days: string[];
  answers: Record<string, DateStatus> | undefined;
  avgKills: number | null;
  rating: number | null;
  /** For the viewing captain: what this player does for their squad's short days. */
  captainNote: { text: string; good: boolean } | null;
}) {
  if (!days.length && rating == null) return null;
  const s = dateSummary(days, answers);
  const level = days.length ? dateLevel(s) : "unset";
  const share = dateShare(days, answers);
  const star = rating != null && rating >= 80;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {rating != null && (
        <span className={cn("rounded-md px-2 py-0.5 font-heading text-sm font-extrabold tracking-wide", rating >= 85 ? "honour-gold text-brand" : "bg-white/10 text-white")} title="Overall rating from official games (40–99)">
          OVR {rating}
        </span>
      )}
      {days.length > 0 && (
        <span className={cn("rounded-md px-2 py-0.5 font-semibold", TONE[level])} title="Match days they said yes (maybe counts half)">
          {AVAIL_TIER[level]}
          {level !== "unset" && ` · ${s.yes}${s.maybe ? `+${s.maybe}?` : ""}/${s.total} days`}
        </span>
      )}
      {share != null && avgKills != null && avgKills > 0 && (
        <span className="rounded-md bg-white/5 px-2 py-0.5 text-white/75" title="Kills per game × share of match days they can play">
          ≈ {(avgKills * share).toFixed(1)} kills per match day
        </span>
      )}
      {star && level === "low" && <span className="rounded-md bg-gold px-2 py-0.5 font-semibold text-brand">Star, limited days: bid with your calendar in mind</span>}
      {captainNote && <span className={cn("rounded-md px-2 py-0.5 font-medium", captainNote.good ? "bg-win/15 text-win" : "bg-white/10 text-white/70")}>{captainNote.text}</span>}
    </div>
  );
}
