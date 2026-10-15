import { EmptyState, PageHeader, SectionTitle } from "@/components/page-header";
import { StandingsLegend, StandingsTable } from "@/components/standings-table";
import { TeamLink } from "@/components/team";
import { loadSeason } from "@/lib/data";
import { isLeagueComplete, leagueStandings, standingsMovement } from "@/lib/engine/league";
import { playoffFormat, playoffsActive } from "@/lib/playoff-formats";
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
  const format = playoffFormat(season);
  // First-round match-ups by table position: [label, team A index, team B index or null].
  const picture: [string, number, number | null][] = !playoffsActive(format, rows.length)
    ? format.id === "none" && rows.length
      ? [["Champion", 0, null]]
      : []
    : format.id === "semis4"
      ? [["Semi-final 1", 0, 3], ["Semi-final 2", 1, 2]]
      : format.id === "top3"
        ? [["Final", 0, null], ["Eliminator", 1, 2]]
        : format.id === "final2"
          ? [["Final", 0, 1]]
          : [["Qualifier 1", 0, 1], ["Eliminator", 2, 3]];

  return (
    <div>
      <PageHeader
        title="Points Table"
        subtitle={`${season.name} · League stage · Win = ${season.points_win} pts · every map is its own match`}
      />
      {rows.length ? (
        <>
          <StandingsTable rows={rows} playoffLines={playoffsActive(format, rows.length)} format={format} movement={standingsMovement(idx, season)} />
          <StandingsLegend playoffLines={playoffsActive(format, rows.length)} format={format} />
        </>
      ) : (
        <EmptyState title="No teams in this season yet" />
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {picture.length > 0 && anyPlayed && (
          <div className="rounded-xl border bg-card p-5">
            <SectionTitle>{complete ? "Playoff line-up" : "Playoff picture if the league ended today"}</SectionTitle>
            <div className="space-y-3 text-sm">
              {picture.map(([label, a, b]) => (
                <div key={label} className="flex flex-wrap items-center gap-2">
                  <span className="w-28 text-muted-foreground">{label}</span>
                  <TeamLink team={rows[a].team} />
                  {b === null ? (
                    <span className="text-muted-foreground">{format.id === "none" ? "" : "waits for the Eliminator winner"}</span>
                  ) : (
                    <>
                      <span className="text-muted-foreground">vs</span> <TeamLink team={rows[b].team} />
                    </>
                  )}
                </div>
              ))}
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
