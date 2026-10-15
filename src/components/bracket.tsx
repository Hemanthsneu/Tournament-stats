import Link from "next/link";
import { TeamLogo } from "@/components/team";
import type { SeriesView } from "@/lib/engine/league";
import { PLAYOFF_FORMATS, type PlayoffFormatSpec } from "@/lib/playoff-formats";
import { STAGE_LABELS, type PlayoffStage, type Team } from "@/lib/types";
import { fmtDate } from "@/lib/time";
import { cn } from "@/lib/utils";

function SeriesRow({ team, wins, won, placeholder }: { team: Team | null; wins: number; won: boolean; placeholder: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <TeamLogo team={team} size="sm" />
      {team ? (
        <Link href={`/teams/${team.id}`} className={cn("flex-1 truncate transition-colors hover:text-muted-foreground", won ? "font-medium" : "text-foreground/80")}>
          {team.name}
        </Link>
      ) : (
        <span className="flex-1 truncate text-muted-foreground">{placeholder}</span>
      )}
      <span className={cn("tabular", won ? "font-semibold" : "text-muted-foreground")}>{team ? wins : ""}</span>
    </div>
  );
}

export function SeriesCard({ series, stage, format = PLAYOFF_FORMATS.ipl4 }: { series: SeriesView | undefined; stage: PlayoffStage; format?: PlayoffFormatSpec }) {
  const [phA, phB] = format.placeholders[stage] ?? ["TBD", "TBD"];
  const firstDate = series?.games.find((g) => g.game.scheduled_at)?.game.scheduled_at;
  const winner = series?.winnerId;
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card", stage === "final" && "border-foreground/25")}>
      <div className="flex items-baseline justify-between px-4 pt-3.5 pb-1.5">
        <span className="text-sm font-medium">{STAGE_LABELS[stage]}</span>
        <span className="text-xs text-muted-foreground">{firstDate ? fmtDate(firstDate) : "Best of 3"}</span>
      </div>
      <SeriesRow team={series?.teamA ?? null} wins={series?.winsA ?? 0} won={!!winner && winner === series?.teamA?.id} placeholder={phA} />
      <SeriesRow team={series?.teamB ?? null} wins={series?.winsB ?? 0} won={!!winner && winner === series?.teamB?.id} placeholder={phB} />
      {series && series.games.length > 0 && (
        <ul className="grid gap-1 px-4 pb-3">
          {series.games.map((g) => (
            <li key={g.game.id}>
              <Link
                href={`/games/${g.game.id}`}
                className={cn(
                  "flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs tabular text-muted-foreground transition-colors hover:text-foreground",
                  g.playoffNote === "not_needed" && "opacity-60",
                )}
              >
                <span className="font-heading font-bold text-foreground">G{g.game.game_no}</span>
                <span className="min-w-0 flex-1 truncate">{g.map ? `${g.map.name} · ${g.map.total_rounds}R` : "Map TBD"}</span>
                {g.completed ? (
                  <span className="font-semibold text-foreground">
                    {g.game.team_a_rounds}–{g.game.team_b_rounds}
                  </span>
                ) : g.playoffNote === "not_needed" ? (
                  <span>Not needed</span>
                ) : g.playoffNote === "if_needed" ? (
                  <span className="text-gold">If needed</span>
                ) : g.game.scheduled_at ? (
                  <span>{fmtDate(g.game.scheduled_at)}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">{format.notes[stage]}</p>
    </div>
  );
}

/** Columns follow the season's playoff format (e.g. IPL: Q1 + Eliminator → Q2 → Final). */
export function Bracket({ series, format = PLAYOFF_FORMATS.ipl4 }: { series: Map<PlayoffStage, SeriesView>; format?: PlayoffFormatSpec }) {
  const cols = format.rounds.length;
  return (
    <div className={cn("grid gap-4 lg:items-center", cols >= 3 ? "lg:grid-cols-3" : cols === 2 ? "lg:grid-cols-2" : "max-w-md")}>
      {format.rounds.map((round, i) => (
        <div key={i} className="space-y-4">
          {round.map((stage) => (
            <SeriesCard key={stage} stage={stage} series={series.get(stage)} format={format} />
          ))}
        </div>
      ))}
    </div>
  );
}
