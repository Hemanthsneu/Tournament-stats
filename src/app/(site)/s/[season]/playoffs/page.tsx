import Link from "next/link";
import { Crown } from "@/components/icons";
import { Bracket } from "@/components/bracket";
import { EmptyState, PageHeader } from "@/components/page-header";
import { TeamLogo } from "@/components/team";
import { loadSeason } from "@/lib/data";
import { isLeagueComplete, leagueStandings, playoffSeries } from "@/lib/engine/league";

export async function generateMetadata({ params }: PageProps<"/s/[season]/playoffs">) {
  return { title: `Season ${(await params).season} playoffs` };
}

export default async function PlayoffsPage({ params }: PageProps<"/s/[season]/playoffs">) {
  const { season: param } = await params;
  const { idx, season } = await loadSeason(param);
  const series = playoffSeries(idx, season.id);
  const complete = isLeagueComplete(idx, season.id);
  const table = leagueStandings(idx, season);
  const champion = idx.teamById.get(series.get("final")?.winnerId ?? "");

  return (
    <div>
      <PageHeader
        title="Playoffs"
        subtitle={`${season.name} · IPL format · every series is best of 3 (both maps, then a decider if it's 1–1)`}
      />
      {series.size === 0 ? (
        <EmptyState title="Playoffs not scheduled">Playoffs need at least 4 teams and a published schedule.</EmptyState>
      ) : (
        <>
          {champion && (
            <div className="mb-6 flex items-center gap-4 rounded-2xl border border-primary/50 bg-card p-5">
              <TeamLogo team={champion} size="xl" />
              <div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Crown className="size-4" /> {season.name} Champion
                </div>
                <Link href={`/teams/${champion.id}`} className="font-heading text-3xl hover:text-primary">
                  {champion.name}
                </Link>
              </div>
            </div>
          )}
          {!complete && table.some((r) => r.played > 0) && (
            <p className="mb-4 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              Teams are filled in automatically when the last league game is published. If the league ended today:{" "}
              <b className="text-foreground">{table[0]?.team.tag}</b> vs <b className="text-foreground">{table[1]?.team.tag}</b> in
              Qualifier 1, <b className="text-foreground">{table[2]?.team.tag}</b> vs{" "}
              <b className="text-foreground">{table[3]?.team.tag}</b> in the Eliminator.
            </p>
          )}
          <Bracket series={series} />
        </>
      )}
    </div>
  );
}
