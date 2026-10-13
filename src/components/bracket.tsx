import Link from "next/link";
import { TeamLogo } from "@/components/team";
import type { SeriesView } from "@/lib/engine/league";
import { STAGE_LABELS, type PlayoffStage, type Team } from "@/lib/types";
import { fmtDate } from "@/lib/time";
import { cn } from "@/lib/utils";

const NOTES: Record<PlayoffStage, string> = {
  qualifier_1: "1st v 2nd. Winner to the Final, loser to Qualifier 2",
  eliminator: "3rd v 4th. Winner to Qualifier 2, loser out",
  qualifier_2: "Loser Q1 v winner Eliminator. Winner to the Final",
  final: "Winner Q1 v winner Q2",
};

const PLACEHOLDERS: Record<PlayoffStage, [string, string]> = {
  qualifier_1: ["1st place", "2nd place"],
  eliminator: ["3rd place", "4th place"],
  qualifier_2: ["Loser of Q1", "Winner of Eliminator"],
  final: ["Winner of Q1", "Winner of Q2"],
};

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

export function SeriesCard({ series, stage }: { series: SeriesView | undefined; stage: PlayoffStage }) {
  const [phA, phB] = PLACEHOLDERS[stage];
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
      {series && series.games.some((g) => g.completed) && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {series.games.map((g) => (
            <Link
              key={g.game.id}
              href={`/games/${g.game.id}`}
              className="rounded-md bg-muted px-2 py-0.5 text-xs tabular text-muted-foreground transition-colors hover:text-foreground"
            >
              G{g.game.game_no}
              {g.completed ? ` ${g.game.team_a_rounds}–${g.game.team_b_rounds}` : ""}
            </Link>
          ))}
        </div>
      )}
      <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">{NOTES[stage]}</p>
    </div>
  );
}

export function Bracket({ series }: { series: Map<PlayoffStage, SeriesView> }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:items-center">
      <div className="space-y-4">
        <SeriesCard stage="qualifier_1" series={series.get("qualifier_1")} />
        <SeriesCard stage="eliminator" series={series.get("eliminator")} />
      </div>
      <SeriesCard stage="qualifier_2" series={series.get("qualifier_2")} />
      <SeriesCard stage="final" series={series.get("final")} />
    </div>
  );
}
