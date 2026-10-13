import Link from "next/link";
import { Crown } from "@/components/icons";
import { EmptyState, PageHeader, SectionTitle } from "@/components/page-header";
import { TeamLink, TeamLogo } from "@/components/team";
import { credits } from "@/lib/auction";
import { loadCommunity } from "@/lib/community";
import { loadLeague } from "@/lib/data";
import { filterGames, leagueStandings, playoffSeries, sortedSeasons } from "@/lib/engine/league";
import { playerLeaderboard, rankBy, type AwardKey } from "@/lib/engine/players";

export const metadata = { title: "Hall of Fame" };

const SEASON_AWARDS: { key: AwardKey; title: string; unit: string }[] = [
  { key: "mvp", title: "Season MVP", unit: "MVP pts" },
  { key: "kills", title: "Top Fragger", unit: "kills" },
  { key: "revives", title: "Best Support", unit: "revives" },
  { key: "potm", title: "Most POTM", unit: "awards" },
];

export default async function HallOfFame() {
  const [{ idx }, community] = await Promise.all([loadLeague(), loadCommunity()]);
  const seasons = sortedSeasons(idx.data);
  if (seasons.length === 0) return <EmptyState title="No seasons yet" />;

  // All-time records (official games)
  const official = filterGames(idx, { type: "official" }).filter((g) => g.completed);
  const career = playerLeaderboard(idx, official);
  const titlesByPlayer = new Map<string, number>();
  const titlesByTeam = new Map<string, number>();
  for (const s of seasons) {
    const champ = playoffSeries(idx, s.id).get("final")?.winnerId;
    if (!champ) continue;
    titlesByTeam.set(champ, (titlesByTeam.get(champ) ?? 0) + 1);
    for (const r of idx.data.rosters.filter((x) => x.season_id === s.id && x.team_id === champ)) {
      titlesByPlayer.set(r.player_id, (titlesByPlayer.get(r.player_id) ?? 0) + 1);
    }
  }
  let bestGame: { kills: number; playerId: string; gameId: string; label: string } | null = null;
  let biggestWin: { margin: number; gameId: string; label: string; winner: string | null } | null = null;
  for (const g of official) {
    for (const st of [...g.statsA, ...g.statsB]) {
      if (!bestGame || st.kills > bestGame.kills) bestGame = { kills: st.kills, playerId: st.player_id, gameId: g.game.id, label: `S${g.season.number} · ${g.label}` };
    }
    const margin = Math.abs((g.game.team_a_rounds ?? 0) - (g.game.team_b_rounds ?? 0));
    if (!biggestWin || margin > biggestWin.margin) {
      biggestWin = { margin, gameId: g.game.id, label: `${g.teamA?.tag} ${g.game.team_a_rounds}–${g.game.team_b_rounds} ${g.teamB?.tag} · S${g.season.number}`, winner: g.winnerId };
    }
  }
  const mostTitledPlayer = [...titlesByPlayer.entries()].sort((a, b) => b[1] - a[1])[0];
  const mostTitledTeam = [...titlesByTeam.entries()].sort((a, b) => b[1] - a[1])[0];
  const records = [
    { title: "Most career kills", who: rankBy(career, "kills")[0], value: (r: (typeof career)[number]) => r.kills, unit: "kills" },
    { title: "Most career revives", who: rankBy(career, "revives")[0], value: (r: (typeof career)[number]) => r.revives, unit: "revives" },
    { title: "Most Player of the Match", who: rankBy(career, "potm")[0], value: (r: (typeof career)[number]) => r.potm, unit: "awards" },
  ];

  return (
    <div className="space-y-16">
      <PageHeader title="Hall of Fame" subtitle="Champions, award winners and records from every season" />

      {seasons.map((s) => {
        const final = playoffSeries(idx, s.id).get("final");
        const champ = final?.winnerId ? idx.teamById.get(final.winnerId) ?? null : null;
        const runner = final?.loserId ? idx.teamById.get(final.loserId) ?? null : null;
        const board = playerLeaderboard(idx, filterGames(idx, { seasonId: s.id, type: "official" }));
        const leader = leagueStandings(idx, s)[0];
        const auction = community.auctions.find((a) => a.season_id === s.id && !a.is_practice);
        const recordBuy = auction
          ? community.auctionLots.filter((l) => l.auction_id === auction.id && l.status === "sold").sort((a, b) => (b.sold_price ?? 0) - (a.sold_price ?? 0))[0]
          : undefined;
        return (
          <section key={s.id} className="grid gap-8 border-t pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div>
              <p className="text-sm text-muted-foreground">{champ ? `Season ${s.number}` : "In progress"}</p>
              <h2 className="mt-1 font-heading text-4xl font-normal">{s.name}</h2>
              <dl className="mt-6 space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <dt className="w-28 text-muted-foreground">{champ ? "Champion" : "Top of table"}</dt>
                  <dd className="flex items-center gap-1.5">
                    {champ ? (
                      <>
                        <Crown className="size-3.5 text-gold" /> <TeamLink team={champ} size="xs" />
                      </>
                    ) : leader && leader.played > 0 ? (
                      <TeamLink team={leader.team} size="xs" />
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </dd>
                </div>
                {runner && (
                  <div className="flex items-center gap-3">
                    <dt className="w-28 text-muted-foreground">Runner-up</dt>
                    <dd>
                      <TeamLink team={runner} size="xs" />
                    </dd>
                  </div>
                )}
                {recordBuy && (
                  <div className="flex items-center gap-3">
                    <dt className="w-28 text-muted-foreground">Record buy</dt>
                    <dd>
                      <Link href={`/players/${recordBuy.player_id}`} className="font-medium transition-colors hover:text-muted-foreground">
                        {idx.playerById.get(recordBuy.player_id)?.ign}
                      </Link>{" "}
                      <span className="tabular text-muted-foreground">· {credits(recordBuy.sold_price ?? 0)}</span>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
              {SEASON_AWARDS.map((award) => {
                const top = rankBy(board, award.key).filter((r) => r[award.key] > 0)[0];
                return (
                  <div key={award.key} className="bg-card p-5">
                    <div className="text-xs text-muted-foreground">
                      {award.title}
                      {!champ && " · leader"}
                    </div>
                    {top ? (
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/players/${top.player.id}`} className="block truncate font-heading text-2xl leading-none transition-colors hover:text-muted-foreground">
                            {top.player.ign}
                          </Link>
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <TeamLogo team={top.team} size="xs" /> {top.team?.name}
                          </div>
                        </div>
                        <span className="shrink-0 text-sm tabular text-muted-foreground">
                          {Math.round(top[award.key])} {award.unit}
                        </span>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">Not recorded yet</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="border-t pt-10">
        <SectionTitle>All-time records</SectionTitle>
        <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {records.map((r) =>
            r.who && r.value(r.who) > 0 ? (
              <Record key={r.title} title={r.title} href={`/players/${r.who.player.id}`} name={r.who.player.ign} value={`${r.value(r.who)} ${r.unit}`} />
            ) : null,
          )}
          {bestGame && (
            <Record title="Most kills in one game" href={`/games/${bestGame.gameId}`} name={idx.playerById.get(bestGame.playerId)?.ign ?? ""} value={`${bestGame.kills} kills`} sub={bestGame.label} />
          )}
          {biggestWin && biggestWin.margin > 0 && (
            <Record title="Biggest win" href={`/games/${biggestWin.gameId}`} name={idx.teamById.get(biggestWin.winner ?? "")?.name ?? ""} value={`by ${biggestWin.margin} rounds`} sub={biggestWin.label} />
          )}
          {mostTitledTeam && (
            <Record title="Most titles (team)" href={`/teams/${mostTitledTeam[0]}`} name={idx.teamById.get(mostTitledTeam[0])?.name ?? ""} value={`${mostTitledTeam[1]}×`} />
          )}
          {mostTitledPlayer && (
            <Record title="Most titles (player)" href={`/players/${mostTitledPlayer[0]}`} name={idx.playerById.get(mostTitledPlayer[0])?.ign ?? ""} value={`${mostTitledPlayer[1]}×`} />
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Records count official games only.</p>
      </section>
    </div>
  );
}

function Record({ title, href, name, value, sub }: { title: string; href: string; name: string; value: string; sub?: string }) {
  return (
    <Link href={href} className="bg-card p-5 transition-colors hover:bg-accent/40">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span className="truncate font-heading text-2xl leading-none">{name}</span>
        <span className="shrink-0 tabular text-sm text-muted-foreground">{value}</span>
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Link>
  );
}
