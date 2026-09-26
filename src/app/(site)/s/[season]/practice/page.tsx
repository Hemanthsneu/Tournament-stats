import { GameCard } from "@/components/game-card";
import { AwardCards } from "@/components/leaderboard";
import { EmptyState, PageHeader, SectionTitle } from "@/components/page-header";
import { StandingsLegend, StandingsTable } from "@/components/standings-table";
import { loadSeason } from "@/lib/data";
import { filterGames, practiceStandings } from "@/lib/engine/league";
import { playerLeaderboard } from "@/lib/engine/players";

export async function generateMetadata({ params }: PageProps<"/s/[season]/practice">) {
  return { title: `Season ${(await params).season} practice` };
}

export default async function PracticePage({ params }: PageProps<"/s/[season]/practice">) {
  const { season: param } = await params;
  const { idx, season } = await loadSeason(param);
  const games = filterGames(idx, { seasonId: season.id, type: "practice" });
  const rows = practiceStandings(idx, season);
  const board = playerLeaderboard(idx, games);
  const recent = [...games].reverse();

  return (
    <div className="space-y-10">
      <PageHeader
        title="Practice"
        subtitle={`${season.name} · practice games never count toward the official table, playoffs or awards`}
      />
      {games.length === 0 ? (
        <EmptyState title="No practice games yet" />
      ) : (
        <>
          <section>
            <SectionTitle>Practice table</SectionTitle>
            <StandingsTable rows={rows} />
            <StandingsLegend />
          </section>
          <section>
            <SectionTitle>Practice leaders</SectionTitle>
            <AwardCards rows={board} keys={["mvp", "kills", "revives", "avgKills"]} />
          </section>
          <section>
            <SectionTitle>Practice results</SectionTitle>
            <div className="grid gap-3 md:grid-cols-2">
              {recent.map((v) => (
                <GameCard key={v.game.id} view={v} idx={idx} showDate />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
