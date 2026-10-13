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
      <span className={cn("min-w-0 flex-1 truncate", won === false && "text-muted-foreground", !team && "text-muted-foreground")}>
        {team?.name ?? "TBD"}
      </span>
      {rounds != null && (
        <span className={cn("text-lg tabular", won ? "font-semibold" : "text-muted-foreground")}>{rounds}</span>
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
  return (
    <Link
      href={`/games/${game.id}`}
      className={cn(
        "group block rounded-xl border bg-card p-4 transition-[box-shadow,border-color] duration-200 hover:border-foreground/15 hover:shadow-[0_2px_10px_rgb(0_0_0/0.04)]",
        highlight && "border-foreground/25",
      )}
    >
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="text-foreground">{view.label}</span>
        {game.scheduled_at && (
          <span>
            {showDate && `${fmtDate(game.scheduled_at)}, `}
            {fmtTime(game.scheduled_at)}
          </span>
        )}
        <span className="ml-auto">
          {completed ? (
            "Final"
          ) : game.status === "live" ? (
            <span className="inline-flex items-center gap-1.5 text-loss">
              <span className="size-1.5 animate-pulse rounded-full bg-loss" /> Live
            </span>
          ) : highlight ? (
            <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-medium text-gold">Up next</span>
          ) : (
            "Scheduled"
          )}
        </span>
      </div>
      <div className="space-y-2">
        <Row team={teamA} rounds={completed ? game.team_a_rounds : null} won={completed ? winnerId === teamA?.id : null} />
        <Row team={teamB} rounds={completed ? game.team_b_rounds : null} won={completed ? winnerId === teamB?.id : null} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
        {map && (
          <span>
            {map.name} · {map.total_rounds}R{map.wow_map_id && <span className="ml-1 font-mono">#{map.wow_map_id}</span>}
          </span>
        )}
        {completed && game.squad_size && <span>{game.squad_size}v{game.squad_size}</span>}
        {completed && (
          <span>
            K {view.killsA}–{view.killsB}
          </span>
        )}
        {potm && (
          <span className="ml-auto inline-flex items-center gap-1 text-foreground">
            <Trophy className="size-3.5 text-gold" /> {potm.ign}
          </span>
        )}
      </div>
    </Link>
  );
}
