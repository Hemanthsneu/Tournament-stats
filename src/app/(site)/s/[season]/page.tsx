import Link from "next/link";
import { ArrowRight, Crown } from "@/components/icons";
import { GameCard } from "@/components/game-card";
import { AwardCards } from "@/components/leaderboard";
import { EmptyState, SectionTitle, Stat } from "@/components/page-header";
import { StandingsTable } from "@/components/standings-table";
import { TeamLogo } from "@/components/team";
import { loadSeason } from "@/lib/data";
import { filterGames, isLeagueComplete, leagueStandings, playoffSeries, seasonMaps, seasonTeams, upNext } from "@/lib/engine/league";
import { playerLeaderboard } from "@/lib/engine/players";

function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
      {children} <ArrowRight className="size-3.5" />
    </Link>
  );
}

export default async function SeasonHome({ params }: PageProps<"/s/[season]">) {
  const { season: param } = await params;
  const { idx, season } = await loadSeason(param);
  const official = filterGames(idx, { seasonId: season.id, type: "official" });
  const played = official.filter((g) => g.completed);
  const next = upNext(official, 2);
  const latest = [...played].sort((a, b) => (b.game.scheduled_at ?? "").localeCompare(a.game.scheduled_at ?? "")).slice(0, 4);
  const table = leagueStandings(idx, season);
  const champion = idx.teamById.get(playoffSeries(idx, season.id).get("final")?.winnerId ?? "") ?? null;
  const stage = champion ? "Completed" : isLeagueComplete(idx, season.id) ? "Playoffs" : played.length ? "League stage" : "Upcoming";
  const board = playerLeaderboard(idx, official);
  const teams = seasonTeams(idx, season.id);
  const maps = seasonMaps(idx, season.id);
  const base = `/s/${season.number}`;

  return (
    <div className="space-y-20">
      <section className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className={stage === "League stage" || stage === "Playoffs" ? "size-1.5 rounded-full bg-win" : "size-1.5 rounded-full bg-muted-foreground/40"} />
            {stage}
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl leading-[1.02] sm:text-7xl">{season.name}</h1>
          <p className="mt-5 max-w-xl text-[15px] text-muted-foreground">
            {teams.length} teams, {season.round_robins} round robin{season.round_robins > 1 ? "s" : ""}, played on{" "}
            {maps.map((m) => `${m.name} (${m.total_rounds} rounds)`).join(" and ") || "maps to be announced"}. Top four go to IPL-style,
            best-of-three playoffs.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            <MoreLink href={`${base}/table`}>Points table</MoreLink>
            <MoreLink href={`${base}/schedule`}>Schedule</MoreLink>
            <MoreLink href={`${base}/stats`}>Stats</MoreLink>
          </div>
        </div>
        {champion ? (
          <Link href={`/teams/${champion.id}`} className="flex items-center gap-4 rounded-xl border bg-card p-5 transition-colors hover:border-foreground/20">
            <TeamLogo team={champion} size="lg" />
            <div>
              <div className="flex items-center gap-1.5 text-xs text-gold">
                <Crown className="size-3.5" /> Champion
              </div>
              <div className="mt-1 font-heading text-3xl">{champion.name}</div>
            </div>
          </Link>
        ) : (
          <div className="flex gap-10">
            <Stat label="Games played" value={played.length} />
            <Stat label="Still to play" value={official.length - played.length} />
          </div>
        )}
      </section>

      <div className="grid gap-12 lg:grid-cols-5">
        <section className="space-y-10 lg:col-span-3">
          {next.length > 0 && (
            <div>
              <SectionTitle>Up next</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                {next.map((v, i) => (
                  <GameCard key={v.game.id} view={v} idx={idx} highlight={i === 0} showDate />
                ))}
              </div>
            </div>
          )}
          <div>
            <SectionTitle action={<MoreLink href={`${base}/schedule`}>All results</MoreLink>}>Latest results</SectionTitle>
            {latest.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {latest.map((v) => (
                  <GameCard key={v.game.id} view={v} idx={idx} showDate />
                ))}
              </div>
            ) : (
              <EmptyState title="No results yet" />
            )}
          </div>
        </section>
        <section className="lg:col-span-2">
          <SectionTitle action={<MoreLink href={`${base}/table`}>Full table</MoreLink>}>Points table</SectionTitle>
          {table.length ? <StandingsTable rows={table} compact playoffLines /> : <EmptyState title="No teams yet" />}
        </section>
      </div>

      <section>
        <SectionTitle action={<MoreLink href={`${base}/stats`}>All stats</MoreLink>}>Award race</SectionTitle>
        <AwardCards rows={board} keys={["mvp", "kills", "revives"]} />
      </section>
    </div>
  );
}
