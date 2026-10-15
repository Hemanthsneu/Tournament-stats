import Link from "next/link";
import { Crown } from "@/components/icons";
import { Bracket } from "@/components/bracket";
import { EmptyState, PageHeader } from "@/components/page-header";
import { TeamLogo } from "@/components/team";
import { loadSeason } from "@/lib/data";
import { isLeagueComplete, leagueStandings, playoffSeries, seasonPodium, seasonTeams } from "@/lib/engine/league";
import { playoffFormat, playoffsActive } from "@/lib/playoff-formats";

export async function generateMetadata({ params }: PageProps<"/s/[season]/playoffs">) {
  return { title: `Season ${(await params).season} playoffs` };
}

export default async function PlayoffsPage({ params }: PageProps<"/s/[season]/playoffs">) {
  const { season: param } = await params;
  const { idx, season } = await loadSeason(param);
  const series = playoffSeries(idx, season.id);
  const complete = isLeagueComplete(idx, season.id);
  const table = leagueStandings(idx, season);
  const format = playoffFormat(season);
  const active = playoffsActive(format, seasonTeams(idx, season.id).length);
  const champion = seasonPodium(idx, season.id).champion;
  const seed = (i: number) => <b className="text-foreground">{table[i]?.team.tag}</b>;
  const ifToday =
    format.id === "semis4" ? (
      <>
        {seed(0)} vs {seed(3)} and {seed(1)} vs {seed(2)} in the semi-finals.
      </>
    ) : format.id === "top3" ? (
      <>
        {seed(0)} straight to the Final, {seed(1)} vs {seed(2)} in the Eliminator.
      </>
    ) : format.id === "final2" ? (
      <>
        {seed(0)} vs {seed(1)} in the Final.
      </>
    ) : (
      <>
        {seed(0)} vs {seed(1)} in Qualifier 1, {seed(2)} vs {seed(3)} in the Eliminator.
      </>
    );

  return (
    <div>
      <PageHeader
        title="Playoffs"
        subtitle={
          active
            ? `${season.name} · ${format.label} · every series is best of 3 (game 3 is played only if it's 1–1)`
            : `${season.name} · ${format.id === "none" ? "No playoffs: the league winner is champion" : format.label}`
        }
      />
      {!active || series.size === 0 ? (
        champion ? (
          <EmptyState title={`${champion.name} are champions`}>Top of the league table. This season has no playoffs.</EmptyState>
        ) : (
          <EmptyState title={format.id === "none" ? "No playoffs this season" : "Playoffs not scheduled"}>
            {format.id === "none"
              ? "The team on top of the league table when the last game is played is champion."
              : `This format needs at least ${format.qualify} teams and a published schedule.`}
          </EmptyState>
        )
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
              Teams are filled in automatically when the last league game is published. If the league ended today: {ifToday}
            </p>
          )}
          <Bracket series={series} format={format} />
        </>
      )}
    </div>
  );
}
