import { EmptyState, PageHeader, SectionTitle } from "@/components/page-header";
import { StandingsLegend, StandingsTable } from "@/components/standings-table";
import { TeamLink } from "@/components/team";
import { loadSeason } from "@/lib/data";
import { isLeagueComplete, leagueStandings } from "@/lib/engine/league";
import { TIEBREAK_LABELS } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/s/[season]/table">) {
  return { title: `Season ${(await params).season} points table` };
}

export default async function TablePage({ params }: PageProps<"/s/[season]/table">) {
  const { season: param } = await params;
  const { idx, season } = await loadSeason(param);
  const rows = leagueStandings(idx, season);
  const complete = isLeagueComplete(idx, season.id);
  const anyPlayed = rows.some((r) => r.played > 0);

  return (
    <div>
      <PageHeader
        title="Points Table"
        subtitle={`${season.name} · League stage · Win = ${season.points_win} pts · every map is its own match`}
      />
      {rows.length ? (
        <>
          <StandingsTable rows={rows} playoffLines={rows.length >= 4} />
          <StandingsLegend playoffLines={rows.length >= 4} />
        </>
      ) : (
        <EmptyState title="No teams in this season yet" />
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {rows.length >= 4 && anyPlayed && (
          <div className="rounded-xl border bg-card p-5">
            <SectionTitle>{complete ? "Playoff line-up" : "Playoff picture if the league ended today"}</SectionTitle>
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-24 text-muted-foreground">Qualifier 1</span>
                <TeamLink team={rows[0].team} /> <span className="text-muted-foreground">vs</span> <TeamLink team={rows[1].team} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-24 text-muted-foreground">Eliminator</span>
                <TeamLink team={rows[2].team} /> <span className="text-muted-foreground">vs</span> <TeamLink team={rows[3].team} />
              </div>
            </div>
          </div>
        )}
        <div className="rounded-xl border bg-card p-5 text-sm">
          <SectionTitle>How teams are ranked</SectionTitle>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Points</li>
            {season.tiebreak_order.map((k) => (
              <li key={k}>{TIEBREAK_LABELS[k]}</li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            NRR works like cricket&apos;s net run rate. Dividing by rounds played keeps it fair between 21- and 23-round maps.
          </p>
        </div>
      </div>
    </div>
  );
}
