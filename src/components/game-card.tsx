import Link from "next/link";
import { MapPin, Trophy } from "lucide-react";
import { TeamLogo } from "@/components/team";
import { Badge } from "@/components/ui/badge";
import type { GameView, LeagueIndex } from "@/lib/engine/league";
import { fmtDate, fmtTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Team } from "@/lib/types";

function Side({ team, rounds, won, align }: { team: Team | null; rounds: number | null; won: boolean | null; align: "left" | "right" }) {
  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-2", align === "right" && "flex-row-reverse text-right")}>
      <TeamLogo team={team} size="md" />
      <div className="min-w-0">
        <div className={cn("truncate font-medium", won === false && "text-muted-foreground", !team && "italic text-muted-foreground")}>
          <span className="hidden sm:inline">{team?.name ?? "TBD"}</span>
          <span className="sm:hidden">{team?.tag ?? "TBD"}</span>
        </div>
      </div>
      {rounds != null && (
        <span
          className={cn(
            "ml-auto font-heading text-2xl font-bold tabular",
            align === "right" && "mr-auto ml-0",
            won ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {rounds}
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
  return (
    <Link
      href={`/games/${game.id}`}
      className={cn(
        "block rounded-xl border bg-card p-3 transition hover:border-primary/50 hover:bg-accent/30 sm:p-4",
        highlight && "border-primary/60 ring-1 ring-primary/30",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{view.label}</span>
        {game.scheduled_at && (
          <span>
            {showDate && `${fmtDate(game.scheduled_at)} · `}
            {fmtTime(game.scheduled_at)}
          </span>
        )}
        {map && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" />
            {map.name} · {map.total_rounds}R
            {map.wow_map_id && <span className="font-mono text-[11px] text-muted-foreground/80">#{map.wow_map_id}</span>}
          </span>
        )}
        {game.squad_size && completed && <span>{game.squad_size}v{game.squad_size}</span>}
        <span className="ml-auto">
          {completed ? (
            <Badge variant="secondary">Final</Badge>
          ) : game.status === "live" ? (
            <Badge className="bg-loss text-white">Live</Badge>
          ) : highlight ? (
            <Badge>Up next</Badge>
          ) : (
            <Badge variant="outline">Scheduled</Badge>
          )}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Side team={teamA} rounds={completed ? game.team_a_rounds : null} won={completed ? winnerId === teamA?.id : null} align="left" />
        <span className="text-xs font-medium text-muted-foreground">{completed ? "–" : "vs"}</span>
        <Side team={teamB} rounds={completed ? game.team_b_rounds : null} won={completed ? winnerId === teamB?.id : null} align="right" />
      </div>
      {completed && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
          <span>
            Kills {view.killsA}–{view.killsB}
          </span>
          <span>
            Revives {view.revivesA}–{view.revivesB}
          </span>
          {potm && (
            <span className="ml-auto inline-flex items-center gap-1 text-primary">
              <Trophy className="size-3" /> POTM: {potm.ign}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
