import Link from "next/link";
import { Crown, Gem, TrendingUp } from "lucide-react";
import { SectionTitle } from "@/components/page-header";
import { TeamLink, TeamLogo } from "@/components/team";
import { credits } from "@/lib/auction";
import type { LeagueIndex } from "@/lib/engine/league";
import { filterGames, leagueStandings } from "@/lib/engine/league";
import { playerLeaderboard } from "@/lib/engine/players";
import type { Auction, AuctionLot, AuctionTeam } from "@/lib/types";

/** Price vs performance for every bought player, once the auction's season has games. */
export function AuctionValue({ idx, auction, lots, teams }: { idx: LeagueIndex; auction: Auction; lots: AuctionLot[]; teams: AuctionTeam[] }) {
  const sold = lots.filter((l) => l.status === "sold" && l.sold_price != null);
  if (sold.length === 0 || auction.is_practice) return null;
  const season = auction.season_id ? idx.seasonById.get(auction.season_id) : undefined;
  const board = season ? new Map(playerLeaderboard(idx, filterGames(idx, { seasonId: season.id, type: "official" })).map((r) => [r.player.id, r])) : new Map();
  const rows = sold
    .map((l) => {
      const s = board.get(l.player_id);
      const price = l.sold_price!;
      return { lot: l, player: idx.playerById.get(l.player_id), team: idx.teamById.get(l.sold_team_id ?? "") ?? null, price, s, value: s && price > 0 ? (s.mvp / price) * 100 : null };
    })
    .sort((a, b) => b.price - a.price);
  const priciest = rows[0];
  const steal = rows.filter((r) => r.value != null && r.s?.qualifiesForAverage).sort((a, b) => b.value! - a.value!)[0];
  const table = season ? leagueStandings(idx, season) : [];
  const spend = teams
    .map((t) => ({
      team: idx.teamById.get(t.team_id) ?? null,
      spent: sold.filter((l) => l.sold_team_id === t.team_id).reduce((a, l) => a + l.sold_price!, 0),
      bought: sold.filter((l) => l.sold_team_id === t.team_id).length,
      row: table.find((r) => r.team.id === t.team_id),
    }))
    .sort((a, b) => b.spent - a.spent);
  const hasGames = rows.some((r) => r.s);

  return (
    <section className="space-y-4">
      <SectionTitle>Auction value</SectionTitle>
      <div className="grid gap-4 md:grid-cols-3">
        <Highlight icon={<Crown className="size-4" />} title="Most expensive buy" player={priciest.player?.ign} playerId={priciest.lot.player_id} team={priciest.team} value={credits(priciest.price)} note="credits" />
        {steal ? (
          <Highlight
            icon={<Gem className="size-4" />}
            title="Steal of the auction"
            player={steal.player?.ign}
            playerId={steal.lot.player_id}
            team={steal.team}
            value={steal.value!.toFixed(1)}
            note={`MVP pts per 100 credits (bought for ${credits(steal.price)})`}
          />
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            <div className="mb-1 flex items-center gap-1 font-semibold text-foreground">
              <Gem className="size-4 text-primary" /> Steal of the auction
            </div>
            Shows up once {season?.name ?? "the season"} games are played.
          </div>
        )}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <TrendingUp className="size-4" /> Team spend
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {spend.map((s) => (
              <li key={s.team?.id} className="flex items-center gap-2">
                <TeamLogo team={s.team} size="xs" />
                <span className="flex-1 truncate">{s.team?.name}</span>
                <span className="text-xs text-muted-foreground">{s.bought} players</span>
                <span className="tabular font-medium">{credits(s.spent)}</span>
                {s.row && s.row.played > 0 && <span className="w-8 text-right text-xs text-muted-foreground">#{s.row.position}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-max text-sm tabular">
          <thead>
            <tr className="border-b text-xs uppercase text-muted-foreground">
              {["Player", "Team", "Price", ...(hasGames ? ["Games", "Kills", "Revives", "MVP", "MVP / 100 cr"] : [])].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.lot.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <Link href={`/players/${r.lot.player_id}`} className="font-medium hover:text-primary">
                    {r.player?.ign}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <TeamLink team={r.team} size="xs" short />
                </td>
                <td className="px-3 py-2 font-semibold">{credits(r.price)}</td>
                {hasGames && (
                  <>
                    <td className="px-3 py-2">{r.s?.games ?? 0}</td>
                    <td className="px-3 py-2">{r.s?.kills ?? 0}</td>
                    <td className="px-3 py-2">{r.s?.revives ?? 0}</td>
                    <td className="px-3 py-2">{r.s ? Math.round(r.s.mvp) : 0}</td>
                    <td className="px-3 py-2 text-primary">{r.value != null ? r.value.toFixed(1) : "–"}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Highlight({ icon, title, player, playerId, team, value, note }: { icon: React.ReactNode; title: string; player?: string; playerId: string; team: ReturnType<LeagueIndex["teamById"]["get"]> | null; value: string; note: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-primary">
        {icon} {title}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <TeamLogo team={team ?? null} size="md" />
        <div className="min-w-0 flex-1">
          <Link href={`/players/${playerId}`} className="block truncate font-heading text-lg font-bold hover:text-primary">
            {player}
          </Link>
          <div className="truncate text-xs text-muted-foreground">{team?.name}</div>
        </div>
        <div className="font-heading text-2xl font-bold tabular">{value}</div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{note}</p>
    </div>
  );
}
