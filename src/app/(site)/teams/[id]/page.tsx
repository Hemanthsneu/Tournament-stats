import Link from "next/link";
import { notFound } from "next/navigation";
import { GameCard } from "@/components/game-card";
import { EmptyState, SectionTitle } from "@/components/page-header";
import { TeamLogo } from "@/components/team";
import { Badge } from "@/components/ui/badge";
import { loadLeague } from "@/lib/data";
import { filterGames, leagueStandings, sortedSeasons, teamFinish, upNext } from "@/lib/engine/league";
import { gamesForTeam, teamRoster } from "@/lib/engine/players";
import { signed } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/teams/[id]">) {
  const { idx } = await loadLeague();
  return { title: idx.teamById.get((await params).id)?.name ?? "Team" };
}

export default async function TeamPage({ params }: PageProps<"/teams/[id]">) {
  const { id } = await params;
  const { idx } = await loadLeague();
  const team = idx.teamById.get(id);
  if (!team) notFound();

  const seasons = sortedSeasons(idx.data).filter((s) =>
    idx.data.seasonTeams.some((st) => st.season_id === s.id && st.team_id === id),
  );
  const official = gamesForTeam(filterGames(idx, { type: "official" }), id);
  const played = official.filter((g) => g.completed);
  const wins = played.filter((g) => g.winnerId === id).length;
  const kills = played.reduce((a, g) => a + (g.teamA?.id === id ? g.killsA : g.killsB), 0);
  const revives = played.reduce((a, g) => a + (g.teamA?.id === id ? g.revivesA : g.revivesB), 0);
  const finishes = seasons.map((s) => ({ season: s, finish: teamFinish(idx, s.id, id), row: leagueStandings(idx, s).find((r) => r.team.id === id) }));
  const titles = finishes.filter((f) => f.finish === "Champion").length;
  const latestSeason = seasons[0];
  const upcoming = latestSeason ? upNext(official.filter((g) => g.season.id === latestSeason.id), 4) : [];
  const recent = [...played].reverse().slice(0, 6);

  // Top players while playing for this team (official, all seasons).
  const byPlayer = new Map<string, { kills: number; revives: number; games: number }>();
  for (const g of played) {
    for (const s of g.teamA?.id === id ? g.statsA : g.statsB) {
      const agg = byPlayer.get(s.player_id) ?? { kills: 0, revives: 0, games: 0 };
      agg.kills += s.kills;
      agg.revives += s.revives;
      agg.games++;
      byPlayer.set(s.player_id, agg);
    }
  }
  const topPlayers = [...byPlayer.entries()].sort((a, b) => b[1].kills - a[1].kills).slice(0, 5);

  return (
    <div className="space-y-10">
      <section className="flex flex-wrap items-center gap-5 rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-6">
        <TeamLogo team={team} size="xl" />
        <div className="flex-1">
          <h1 className="text-3xl font-extrabold">{team.name}</h1>
          <p className="text-sm text-muted-foreground">
            {team.tag} · {seasons.length} season{seasons.length === 1 ? "" : "s"}
            {titles > 0 && <span className="ml-2 text-primary">🏆 {titles}× champion</span>}
          </p>
        </div>
        <div className="grid grid-cols-4 gap-6 text-center">
          {[
            ["Games", played.length],
            ["W–L", `${wins}–${played.length - wins}`],
            ["Kills", kills],
            ["Revives", revives],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="font-heading text-2xl font-bold tabular">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Season by season</SectionTitle>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-max text-sm tabular">
            <thead>
              <tr className="border-b text-xs uppercase text-muted-foreground">
                {["Season", "Finish", "P", "W", "L", "Pts", "NRR", "Kills"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {finishes.map(({ season, finish, row }) => (
                <tr key={season.id} className="border-b last:border-0">
                  <td className="px-4 py-2.5">
                    <Link href={`/s/${season.number}/table`} className="font-medium hover:text-primary">{season.name}</Link>
                  </td>
                  <td className="px-4 py-2.5">{finish === "Champion" ? <Badge>Champion</Badge> : finish ?? "–"}</td>
                  <td className="px-4 py-2.5">{row?.played ?? 0}</td>
                  <td className="px-4 py-2.5">{row?.won ?? 0}</td>
                  <td className="px-4 py-2.5">{row?.lost ?? 0}</td>
                  <td className="px-4 py-2.5 font-semibold">{row?.points ?? 0}</td>
                  <td className="px-4 py-2.5">{row ? signed(row.nrr) : "–"}</td>
                  <td className="px-4 py-2.5">{row?.kills ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionTitle>Rosters</SectionTitle>
          <div className="space-y-4">
            {seasons.map((s) => {
              const roster = teamRoster(idx, s.id, id);
              return (
                <div key={s.id} className="rounded-xl border bg-card p-4">
                  <div className="mb-2 text-sm font-semibold">{s.name}</div>
                  {roster.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No roster registered</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {roster.map(({ entry, player }) => (
                        <Link
                          key={entry.id}
                          href={`/players/${player.id}`}
                          className={`rounded-md border px-2 py-1 text-sm hover:border-primary/50 ${entry.left_on ? "text-muted-foreground line-through decoration-muted-foreground/50" : ""}`}
                          title={entry.left_on ? `Left on ${entry.left_on}` : undefined}
                        >
                          {player.ign}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <section>
          <SectionTitle>Top players for {team.tag}</SectionTitle>
          {topPlayers.length === 0 ? (
            <EmptyState title="No games yet" />
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm tabular">
                <thead>
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">Player</th>
                    <th className="px-2 py-2 text-center font-medium">Games</th>
                    <th className="px-2 py-2 text-center font-medium">Kills</th>
                    <th className="px-4 py-2 text-center font-medium">Revives</th>
                  </tr>
                </thead>
                <tbody>
                  {topPlayers.map(([pid, a]) => (
                    <tr key={pid} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        <Link href={`/players/${pid}`} className="font-medium hover:text-primary">{idx.playerById.get(pid)?.ign}</Link>
                      </td>
                      <td className="px-2 py-2 text-center">{a.games}</td>
                      <td className="px-2 py-2 text-center">{a.kills}</td>
                      <td className="px-4 py-2 text-center">{a.revives}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {upcoming.length > 0 && (
        <section>
          <SectionTitle>Upcoming</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {upcoming.map((v) => <GameCard key={v.game.id} view={v} idx={idx} showDate />)}
          </div>
        </section>
      )}
      <section>
        <SectionTitle>Recent results</SectionTitle>
        {recent.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {recent.map((v) => <GameCard key={v.game.id} view={v} idx={idx} showDate />)}
          </div>
        ) : (
          <EmptyState title="No results yet" />
        )}
      </section>
    </div>
  );
}
