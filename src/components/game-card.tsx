import Link from "next/link";
import { Trophy } from "@/components/icons";
import { TeamLogo } from "@/components/team";
import type { GameView, LeagueIndex } from "@/lib/engine/league";
import { fmtDate, fmtTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Team } from "@/lib/types";

function Row({ team, rounds, won }: { team: Team | null; rounds: number | null; won: boolean | null }) {
  return (
    <div className="flex items-center gap-3">
      <TeamLogo team={team} size="sm" />
      <span className={cn("min-w-0 flex-1 truncate font-heading text-[17px] font-semibold tracking-wide uppercase", (won === false || !team) && "text-muted-foreground")}>
        {team?.name ?? "TBD"}
      </span>
      {rounds != null && (
        <span className="flex items-center gap-1.5">
          <span className={cn("font-heading text-2xl leading-none font-bold tabular", !won && "text-muted-foreground")}>{rounds}</span>
          <span className={cn("size-0 border-y-[5px] border-r-[6px] border-y-transparent", won ? "border-r-hot" : "border-r-transparent")} aria-hidden />
        </span>
      )}
    </div>
  );
}

export function GameCard({
  view,
  idx,
  highlight = false,
  showDate = false,
}: {
  view: GameView;
  idx: LeagueIndex;
  highlight?: boolean;
  showDate?: boolean;
}) {
  const { game, teamA, teamB, completed, winnerId, map } = view;
  const potm = game.potm_player_id ? idx.playerById.get(game.potm_player_id) : null;
  const live = game.status === "live";
  return (
    <Link
      href={`/games/${game.id}`}
      className={cn(
        "group block overflow-hidden rounded-lg border bg-card transition-shadow duration-200 hover:shadow-[0_6px_20px_rgb(12_26_58/0.08)]",
        highlight && "ring-2 ring-hot/70",
        view.playoffNote === "not_needed" && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <span className={cn("font-heading text-sm font-bold tracking-wide uppercase", live ? "text-hot" : completed ? "text-foreground" : "text-muted-foreground")}>
          {completed
            ? "Final"
            : live
              ? "● Live"
              : view.playoffNote === "not_needed"
                ? "Not needed"
                : highlight
                  ? "Up next"
                  : game.scheduled_at
                    ? fmtTime(game.scheduled_at)
                    : "Scheduled"}
        </span>
        {view.playoffNote === "if_needed" && (
          <span className="rounded-sm bg-gold-soft px-1.5 py-px font-heading text-[10px] font-bold tracking-wide text-gold uppercase" title="Played only if the series is 1–1">
            If needed
          </span>
        )}
        <span className="ml-auto truncate text-xs text-muted-foreground">
          {view.label}
          {showDate && game.scheduled_at && ` · ${fmtDate(game.scheduled_at)}`}
          {highlight && game.scheduled_at && ` · ${fmtTime(game.scheduled_at)}`}
        </span>
      </div>
      <div className="space-y-1.5 px-4 pb-3">
        <Row team={teamA} rounds={completed ? game.team_a_rounds : null} won={completed ? winnerId === teamA?.id : null} />
        <Row team={teamB} rounds={completed ? game.team_b_rounds : null} won={completed ? winnerId === teamB?.id : null} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
        {map && (
          <span>
            {map.name} · {map.total_rounds}R{map.wow_map_id && <span className="ml-1 font-mono">#{map.wow_map_id}</span>}
          </span>
        )}
        {completed && game.squad_size && <span>{game.squad_size}v{game.squad_size}</span>}
        {completed && (
          <span>
            Kills {view.killsA}–{view.killsB}
          </span>
        )}
        {potm && (
          <span className="ml-auto inline-flex items-center gap-1 font-medium text-foreground">
            <Trophy className="size-3.5 text-gold" /> {potm.ign}
          </span>
        )}
      </div>
    </Link>
  );
}
