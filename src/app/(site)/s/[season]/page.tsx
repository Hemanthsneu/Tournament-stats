import Link from "next/link";
import { ArrowRight, Crown } from "@/components/icons";
import { FeaturedMatch } from "@/components/featured-match";
import { GameCard } from "@/components/game-card";
import { AwardCards } from "@/components/leaderboard";
import { EmptyState, SectionTitle } from "@/components/page-header";
import { StandingsTable } from "@/components/standings-table";
import { Button } from "@/components/ui/button";
import { loadSeason } from "@/lib/data";
import { filterGames, isLeagueComplete, leagueStandings, playoffSeries, seasonMaps, seasonTeams, upNext } from "@/lib/engine/league";
import { playerLeaderboard } from "@/lib/engine/players";

function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 font-heading text-sm font-semibold tracking-wide text-muted-foreground uppercase transition-colors hover:text-hot">
      {children} <ArrowRight className="size-3.5" />
    </Link>
  );
}

export default async function SeasonHome({ params }: PageProps<"/s/[season]">) {
  const { season: param } = await params;
  const { idx, season } = await loadSeason(param);
  const official = filterGames(idx, { seasonId: season.id, type: "official" });
  const played = official.filter((g) => g.completed);
  const next = upNext(official, 3);
  const latest = [...played].sort((a, b) => (b.game.scheduled_at ?? "").localeCompare(a.game.scheduled_at ?? "")).slice(0, 6);
  const table = leagueStandings(idx, season);
  const champion = idx.teamById.get(playoffSeries(idx, season.id).get("final")?.winnerId ?? "") ?? null;
  const stage = champion ? "Champions crowned" : isLeagueComplete(idx, season.id) ? "Playoffs" : played.length ? "League stage" : "Coming soon";
  const board = playerLeaderboard(idx, official);
  const teams = seasonTeams(idx, season.id);
  const maps = seasonMaps(idx, season.id);
  const base = `/s/${season.number}`;
  const featured = next[0] ?? latest[0] ?? null;

  return (
    <div className="space-y-14">
      <section className="full-bleed -mt-8 bg-brand text-brand-foreground sm:-mt-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1fr_minmax(0,520px)]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-sm bg-hot px-2 py-1 font-heading text-xs font-bold tracking-widest uppercase">
              {stage === "League stage" && <span className="size-1.5 animate-pulse rounded-full bg-white" />}
              {stage}
            </span>
            <h1 className="mt-4 text-5xl leading-[0.95] sm:text-7xl">{season.name}</h1>
            <p className="mt-4 max-w-xl text-sm text-white/70">
              {teams.length} teams · {season.round_robins} round robin{season.round_robins > 1 ? "s" : ""} ·{" "}
              {maps.map((m) => m.name).join(", ") || "maps TBA"} · top 4 to IPL-style playoffs
            </p>
            <div className="mt-6 flex flex-wrap gap-8">
              {[
                ["Games played", played.length],
                ["Still to play", official.length - played.length],
                ["Teams", teams.length],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="font-heading text-4xl leading-none font-bold tabular">{value}</div>
                  <div className="mt-1 text-xs font-medium tracking-wide text-white/60 uppercase">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap gap-2">
              <Button asChild className="bg-white font-semibold text-brand hover:bg-white/90">
                <Link href={`${base}/table`}>Standings</Link>
              </Button>
              <Button asChild variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link href={`${base}/schedule`}>Schedule</Link>
              </Button>
            </div>
          </div>
          {champion ? (
            <Link href={`/teams/${champion.id}`} className="block overflow-hidden rounded-xl bg-brand-2 p-6 ring-1 ring-white/10 transition hover:ring-white/30">
              <div className="flex items-center gap-2 font-heading text-sm font-bold tracking-widest text-gold uppercase">
                <Crown className="size-4" /> {season.name} champions
              </div>
              <div className="mt-3 font-heading text-5xl leading-none font-extrabold uppercase italic">{champion.name}</div>
            </Link>
          ) : featured ? (
            <FeaturedMatch view={featured} eyebrow={featured.completed ? "Latest result" : "Up next"} />
          ) : null}
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
        <div className="space-y-12">
          {next.length > 1 && (
            <section>
              <SectionTitle action={<MoreLink href={`${base}/schedule`}>Full schedule</MoreLink>}>Upcoming</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                {next.slice(1).map((v) => (
                  <GameCard key={v.game.id} view={v} idx={idx} showDate />
                ))}
              </div>
            </section>
          )}
          <section>
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
          </section>
        </div>
        <aside>
          <SectionTitle action={<MoreLink href={`${base}/table`}>Full table</MoreLink>}>Standings</SectionTitle>
          {table.length ? <StandingsTable rows={table} compact playoffLines /> : <EmptyState title="No teams yet" />}
        </aside>
      </div>

      <section>
        <SectionTitle action={<MoreLink href={`${base}/stats`}>All stats</MoreLink>}>Stat leaders</SectionTitle>
        <AwardCards rows={board} keys={["mvp", "kills", "revives"]} />
      </section>
    </div>
  );
}
