import Link from "next/link";
import type { GameView } from "@/lib/engine/league";
import { onColor, teamColor } from "@/lib/team-colors";
import { fmtDate, fmtTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Team } from "@/lib/types";

function Side({ team, won }: { team: Team | null; won: boolean | null }) {
  const color = teamColor(team);
  return (
    <div className="relative flex flex-col items-center justify-center gap-2 px-3 py-6 text-center" style={{ background: color, color: onColor(color) }}>
      <span className={cn("font-heading text-5xl leading-none font-extrabold italic sm:text-6xl", won === false && "opacity-60")}>{team?.tag ?? "TBD"}</span>
      <span className="line-clamp-2 font-heading text-sm font-semibold tracking-wide uppercase opacity-90">{team?.name ?? "To be decided"}</span>
    </div>
  );
}

/** Broadcast-style matchup: team colour blocks either side of the score. */
export function FeaturedMatch({ view, eyebrow }: { view: GameView; eyebrow: string }) {
  const { game, completed, winnerId, teamA, teamB, map } = view;
  return (
    <Link href={`/games/${game.id}`} className="group block overflow-hidden rounded-xl bg-brand-2 ring-1 ring-white/10 transition hover:ring-white/30">
      <div className="flex items-center justify-between px-4 py-2.5 text-xs text-white/70">
        <span className="font-heading text-sm font-bold tracking-wide text-white uppercase">{eyebrow}</span>
        <span>{view.label}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr]">
        <Side team={teamA} won={completed ? winnerId === teamA?.id : null} />
        <div className="flex min-w-28 flex-col items-center justify-center bg-brand px-4 text-white">
          {completed ? (
            <>
              <div className="font-heading text-5xl leading-none font-bold tabular sm:text-6xl">
                {game.team_a_rounds}
                <span className="mx-1.5 text-white/40">-</span>
                {game.team_b_rounds}
              </div>
              <div className="mt-2 font-heading text-xs font-semibold tracking-widest text-white/60 uppercase">Final</div>
            </>
          ) : (
            <>
              <div className="font-heading text-4xl font-extrabold text-white/80 italic">VS</div>
              {game.scheduled_at && (
                <div className="mt-2 text-center text-xs leading-tight text-white/70">
                  {fmtDate(game.scheduled_at)}
                  <br />
                  {fmtTime(game.scheduled_at)}
                </div>
              )}
            </>
          )}
        </div>
        <Side team={teamB} won={completed ? winnerId === teamB?.id : null} />
      </div>
      {map && (
        <div className="px-4 py-2.5 text-xs text-white/60">
          {map.name} · {map.total_rounds} rounds{map.wow_map_id && <span className="ml-1 font-mono">#{map.wow_map_id}</span>}
        </div>
      )}
    </Link>
  );
}

/** Big match header for the match page: team colour blocks either side of the score. */
export function MatchHero({ view }: { view: GameView }) {
  const { game, completed, winnerId, teamA, teamB } = view;
  const side = (team: Team | null, align: "left" | "right") => {
    const color = teamColor(team);
    const won = completed ? winnerId === team?.id : null;
    return (
      <div
        className={cn("flex min-h-44 flex-col justify-center gap-2 px-5 py-8 sm:min-h-56 sm:px-10", align === "right" ? "items-end text-right" : "items-start")}
        style={{ background: color, color: onColor(color) }}
      >
        <span className={cn("font-heading text-6xl leading-none font-extrabold italic sm:text-8xl", won === false && "opacity-55")}>{team?.tag ?? "TBD"}</span>
        <span className="font-heading text-base font-semibold tracking-wide uppercase opacity-90 sm:text-lg">{team?.name ?? "To be decided"}</span>
        {won && <span className="rounded-sm bg-white/90 px-2 py-0.5 font-heading text-xs font-bold tracking-widest text-brand uppercase">Winner</span>}
      </div>
    );
  };
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] overflow-hidden rounded-xl bg-brand text-white">
      {side(teamA, "left")}
      <div className="flex flex-col items-center justify-center px-4 sm:px-10">
        {completed ? (
          <>
            <div className="font-heading text-6xl leading-none font-bold tabular sm:text-8xl">
              {game.team_a_rounds}
              <span className="mx-2 text-white/35">-</span>
              {game.team_b_rounds}
            </div>
            <div className="mt-2 font-heading text-sm font-semibold tracking-widest text-white/60 uppercase">Final · rounds</div>
          </>
        ) : (
          <>
            <div className="font-heading text-5xl font-extrabold text-white/80 italic sm:text-6xl">VS</div>
            {game.scheduled_at && (
              <div className="mt-2 text-center text-sm text-white/70">
                {fmtDate(game.scheduled_at)} · {fmtTime(game.scheduled_at)}
              </div>
            )}
          </>
        )}
      </div>
      {side(teamB, "right")}
    </div>
  );
}
