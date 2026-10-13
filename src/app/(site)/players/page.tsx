import Link from "next/link";
import { Search, Swords } from "@/components/icons";
import { MEDALS, PlayerAvatar, Podium, type PodiumEntry } from "@/components/player-podium";
import { CrosshairIcon, PanIcon } from "@/components/pubg-icons";
import { EmptyState, PageHeader } from "@/components/page-header";
import { TeamLink } from "@/components/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadCommunity, profileMap } from "@/lib/community";
import { loadLeague } from "@/lib/data";
import { filterGames, sortedSeasons } from "@/lib/engine/league";
import { playerLeaderboard, rankBy, type AwardKey, type PlayerAgg } from "@/lib/engine/players";
import { num } from "@/lib/format";

export const metadata = { title: "Players" };

export default async function PlayersPage({ searchParams }: PageProps<"/players">) {
  const { q: rawQ } = await searchParams;
  const q = (typeof rawQ === "string" ? rawQ : "").trim().toLowerCase();
  const [{ idx }, community] = await Promise.all([loadLeague(), loadCommunity()]);
  const board = playerLeaderboard(idx, filterGames(idx, { type: "official" }));
  const career = new Map(board.map((r) => [r.player.id, r]));
  const profiles = profileMap(community);
  const photoOf = (id: string) => profiles.get(id)?.photo_url ?? idx.playerById.get(id)?.photo_url ?? null;
  const latest = sortedSeasons(idx.data)[0];
  const aliases = new Map<string, string[]>();
  for (const a of idx.data.aliases) aliases.set(a.player_id, [...(aliases.get(a.player_id) ?? []), a.ign]);

  const players = idx.data.players
    .filter((p) => {
      if (!q) return true;
      const names = [p.ign, p.real_name ?? "", p.bgmi_uid ?? "", ...(aliases.get(p.id) ?? [])];
      return names.some((n) => n.toLowerCase().includes(q));
    })
    .map((p) => {
      const entry = idx.data.rosters.find((r) => r.player_id === p.id && r.season_id === latest?.id && !r.left_on);
      return { player: p, team: entry ? idx.teamById.get(entry.team_id) ?? null : null, stats: career.get(p.id) };
    })
    .sort((a, b) => (b.stats?.kills ?? 0) - (a.stats?.kills ?? 0) || a.player.ign.localeCompare(b.player.ign));

  // Top 3 fraggers and top 3 MVPs get their photo on a podium and next to their name in the list.
  const top = (key: AwardKey, fmt: (r: PlayerAgg) => string): PodiumEntry[] =>
    rankBy(board, key)
      .filter((r) => r[key] > 0)
      .slice(0, 3)
      .map((r) => ({ player: r.player, team: r.team, photo: photoOf(r.player.id), value: fmt(r) }));
  const fraggers = top("kills", (r) => String(r.kills));
  const mvps = top("mvp", (r) => num(r.mvp, Number.isInteger(r.mvp) ? 0 : 1));
  const honours = new Map<string, string[]>();
  fraggers.forEach((e, i) => honours.set(e.player.id, [...(honours.get(e.player.id) ?? []), `#${i + 1} fragger`]));
  mvps.forEach((e, i) => honours.set(e.player.id, [...(honours.get(e.player.id) ?? []), `#${i + 1} MVP`]));
  const medal = (id: string) => {
    const ranks = [fraggers.findIndex((e) => e.player.id === id), mvps.findIndex((e) => e.player.id === id)].filter((r) => r >= 0);
    return ranks.length ? MEDALS[Math.min(...ranks)] : null;
  };

  return (
    <div>
      <PageHeader title="Players" subtitle="Career stats across every season (official games). Search by IGN, old IGN or BGMI UID.">
        <Button asChild variant="outline">
          <Link href="/compare">
            <Swords /> Head-to-head
          </Link>
        </Button>
        <form className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search players…" className="w-64 pl-8" />
        </form>
      </PageHeader>
      {!q && (fraggers.length > 0 || mvps.length > 0) && (
        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          {fraggers.length > 0 && <Podium title="Top fraggers" stat="Kills" icon={<CrosshairIcon className="size-5" />} entries={fraggers} />}
          {mvps.length > 0 && <Podium title="MVP race" stat="MVP pts" icon={<PanIcon className="size-5" />} entries={mvps} />}
        </div>
      )}
      {players.length === 0 ? (
        <EmptyState title="No players found" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-max text-sm tabular">
            <thead>
              <tr className="border-b bg-muted/50 font-heading text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-3 text-left font-semibold">Player</th>
                <th className="px-2 py-3 text-left font-semibold">{latest ? `${latest.name} team` : "Team"}</th>
                <th className="px-2 py-3 text-center font-semibold">Games</th>
                <th className="px-2 py-3 text-center font-semibold">Kills</th>
                <th className="px-2 py-3 text-center font-semibold">Revives</th>
                <th className="px-4 py-3 text-center font-semibold">POTM</th>
              </tr>
            </thead>
            <tbody>
              {players.map(({ player, team, stats }) => (
                <tr key={player.id} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      {honours.has(player.id) ? (
                        <PlayerAvatar
                          ign={player.ign}
                          photo={photoOf(player.id)}
                          team={team}
                          className="size-9 rounded-lg text-sm ring-2"
                          style={{ "--tw-ring-color": medal(player.id) } as React.CSSProperties}
                        />
                      ) : (
                        <span className="size-9 shrink-0" aria-hidden />
                      )}
                      <div className="min-w-0">
                        <Link href={`/players/${player.id}`} className="font-medium hover:text-primary">
                          {player.ign}
                        </Link>
                        {aliases.get(player.id) && <span className="ml-2 text-xs text-muted-foreground">formerly {aliases.get(player.id)!.join(", ")}</span>}
                        {honours.has(player.id) && (
                          <div className="mt-0.5 flex gap-1">
                            {honours.get(player.id)!.map((h) => (
                              <span key={h} className="rounded-sm bg-gold-soft px-1.5 py-px font-heading text-[10px] font-bold tracking-wide text-gold uppercase">
                                {h}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2.5">{team ? <TeamLink team={team} size="xs" /> : <span className="text-muted-foreground">–</span>}</td>
                  <td className="px-2 py-2.5 text-center">{stats?.games ?? 0}</td>
                  <td className="px-2 py-2.5 text-center font-semibold">{stats?.kills ?? 0}</td>
                  <td className="px-2 py-2.5 text-center">{stats?.revives ?? 0}</td>
                  <td className="px-4 py-2.5 text-center">{stats?.potm ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
