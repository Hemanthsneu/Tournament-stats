import Link from "next/link";
import { ArrowRight, Crown } from "lucide-react";
import { GameCard } from "@/components/game-card";
import { AwardCards } from "@/components/leaderboard";
import { EmptyState, SectionTitle } from "@/components/page-header";
import { StandingsTable } from "@/components/standings-table";
import { TeamLogo } from "@/components/team";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loadSeason } from "@/lib/data";
import { filterGames, isLeagueComplete, leagueStandings, playoffSeries, seasonMaps, seasonTeams, upNext } from "@/lib/engine/league";
import { playerLeaderboard } from "@/lib/engine/players";

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
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-card to-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <Badge variant="outline" className="mb-3 border-primary/40 text-primary">
              {stage}
            </Badge>
            <h1 className="text-3xl font-extrabold sm:text-5xl">{season.name}</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              {teams.length} teams · {season.round_robins} round robin{season.round_robins > 1 ? "s" : ""} ·{" "}
              {maps.map((m) => `${m.name} (${m.total_rounds}R)`).join(", ") || "maps TBA"} · IPL-style best-of-3 playoffs
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href={`${base}/table`}>Points table</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`${base}/schedule`}>Full schedule</Link>
              </Button>
            </div>
          </div>
          {champion ? (
            <div className="flex items-center gap-4 rounded-xl border border-primary/40 bg-primary/10 p-4">
              <TeamLogo team={champion} size="lg" />
              <div>
                <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Crown className="size-4" /> Champion
                </div>
                <Link href={`/teams/${champion.id}`} className="font-heading text-2xl font-bold hover:text-primary">
                  {champion.name}
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6 text-center">
              <div>
                <div className="font-heading text-3xl font-bold tabular">{played.length}</div>
                <div className="text-xs text-muted-foreground">games played</div>
              </div>
              <div>
                <div className="font-heading text-3xl font-bold tabular">{official.length - played.length}</div>
                <div className="text-xs text-muted-foreground">to go</div>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-5">
        <section className="space-y-6 lg:col-span-3">
          {next.length > 0 && (
            <div>
              <SectionTitle>Up next</SectionTitle>
              <div className="grid gap-3">
                {next.map((v, i) => (
                  <GameCard key={v.game.id} view={v} idx={idx} highlight={i === 0} showDate />
                ))}
              </div>
            </div>
          )}
          <div>
            <SectionTitle
              action={
                <Link href={`${base}/schedule`} className="inline-flex items-center gap-1 text-sm text-primary">
                  All results <ArrowRight className="size-4" />
                </Link>
              }
            >
              Latest results
            </SectionTitle>
            {latest.length ? (
              <div className="grid gap-3">
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
          <SectionTitle
            action={
              <Link href={`${base}/table`} className="inline-flex items-center gap-1 text-sm text-primary">
                Full table <ArrowRight className="size-4" />
              </Link>
            }
          >
            Points table
          </SectionTitle>
          {table.length ? <StandingsTable rows={table} compact playoffLines /> : <EmptyState title="No teams yet" />}
        </section>
      </div>

      <section>
        <SectionTitle
          action={
            <Link href={`${base}/stats`} className="inline-flex items-center gap-1 text-sm text-primary">
              All stats <ArrowRight className="size-4" />
            </Link>
          }
        >
          Award race
        </SectionTitle>
        <AwardCards rows={board} keys={["mvp", "kills", "revives"]} />
      </section>
    </div>
  );
}
