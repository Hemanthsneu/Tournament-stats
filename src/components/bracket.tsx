import Link from "next/link";
import { TeamLogo } from "@/components/team";
import type { SeriesView } from "@/lib/engine/league";
import { STAGE_LABELS, type PlayoffStage, type Team } from "@/lib/types";
import { fmtDate } from "@/lib/time";
import { cn } from "@/lib/utils";

const NOTES: Record<PlayoffStage, string> = {
  qualifier_1: "1st vs 2nd · Winner → Final, loser → Qualifier 2",
  eliminator: "3rd vs 4th · Winner → Qualifier 2, loser out",
  qualifier_2: "Loser Q1 vs Winner Eliminator · Winner → Final",
  final: "Winner Q1 vs Winner Q2",
};

const PLACEHOLDERS: Record<PlayoffStage, [string, string]> = {
  qualifier_1: ["1st place", "2nd place"],
  eliminator: ["3rd place", "4th place"],
  qualifier_2: ["Loser of Q1", "Winner of Eliminator"],
  final: ["Winner of Q1", "Winner of Q2"],
};

function SeriesRow({ team, wins, won, placeholder }: { team: Team | null; wins: number; won: boolean; placeholder: string }) {
  return (
    <div className={cn("flex items-center gap-2 px-3 py-2", won && "bg-primary/10")}>
      <TeamLogo team={team} size="sm" />
      {team ? (
        <Link href={`/teams/${team.id}`} className={cn("flex-1 truncate font-medium hover:text-primary", won && "text-primary")}>
          {team.name}
        </Link>
      ) : (
        <span className="flex-1 truncate italic text-muted-foreground">{placeholder}</span>
      )}
      <span className={cn("font-heading text-lg font-bold tabular", won ? "text-primary" : "text-muted-foreground")}>{team ? wins : ""}</span>
    </div>
  );
}

export function SeriesCard({ series, stage }: { series: SeriesView | undefined; stage: PlayoffStage }) {
  const [phA, phB] = PLACEHOLDERS[stage];
  const firstDate = series?.games.find((g) => g.game.scheduled_at)?.game.scheduled_at;
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card", stage === "final" && "border-primary/50")}>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="font-heading text-sm font-bold">{STAGE_LABELS[stage]}</span>
        <span className="text-xs text-muted-foreground">{firstDate ? fmtDate(firstDate) : "Best of 3"}</span>
      </div>
      <SeriesRow team={series?.teamA ?? null} wins={series?.winsA ?? 0} won={!!series?.winnerId && series.winnerId === series.teamA?.id} placeholder={phA} />
      <SeriesRow team={series?.teamB ?? null} wins={series?.winsB ?? 0} won={!!series?.winnerId && series.winnerId === series.teamB?.id} placeholder={phB} />
      {series && series.games.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t px-3 py-2">
          {series.games.map((g) => (
            <Link
              key={g.game.id}
              href={`/games/${g.game.id}`}
              className="rounded-md bg-muted px-2 py-1 text-xs tabular text-muted-foreground hover:text-foreground"
            >
              G{g.game.game_no}
              {g.map ? ` · ${g.map.name}` : ""}
              {g.completed ? ` · ${g.game.team_a_rounds}–${g.game.team_b_rounds}` : ""}
            </Link>
          ))}
        </div>
      )}
      <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">{NOTES[stage]}</p>
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
      <div>
        <SeriesCard stage="qualifier_2" series={series.get("qualifier_2")} />
      </div>
      <div>
        <SeriesCard stage="final" series={series.get("final")} />
      </div>
    </div>
  );
}
