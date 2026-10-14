import { Gavel } from "@/components/icons";
import { AuctionRoom, type RoomPlayer } from "@/components/auction/auction-room";
import { AuctionValue } from "@/components/auction/auction-value";
import { EmptyState } from "@/components/page-header";
import { availabilityMap, availabilitySeason, dateAnswers, featuredAuction, getViewer, loadCommunity, matchDaysFor, profileMap, verifiedSet } from "@/lib/community";
import { loadLeague } from "@/lib/data";
import { filterGames, sortedSeasons } from "@/lib/engine/league";
import { playerLeaderboard } from "@/lib/engine/players";
import { createPublicClient } from "@/lib/supabase/server";
import { dateKey } from "@/lib/time";
import type { AuctionSnapshot, Team } from "@/lib/types";

export const metadata = { title: "Player Auction" };

export default async function AuctionPage({ searchParams }: PageProps<"/auction">) {
  const sp = await searchParams;
  const [{ idx }, community, viewer] = await Promise.all([loadLeague(true), loadCommunity(), getViewer()]);
  const auction = (typeof sp.id === "string" && community.auctions.find((a) => a.id === sp.id)) || featuredAuction(community);
  if (!auction) {
    return (
      <EmptyState title="No auction scheduled yet">
        <span className="inline-flex items-center gap-1">
          <Gavel className="size-4" /> When the organizers set up the next player auction it will appear here, live.
        </span>
      </EmptyState>
    );
  }

  const { data } = await createPublicClient().rpc("auction_snapshot", { p_auction_id: auction.id });
  const snapshot = data as AuctionSnapshot;
  const profiles = profileMap(community);
  const verified = verifiedSet(community);
  const availability = availabilityMap(community);
  // Match days of the auction's season (or the season players are currently answering for).
  const datesSeasonId = auction.season_id ?? availabilitySeason(community, idx.data.seasons, dateKey(new Date().toISOString()))?.id;
  const matchDays = matchDaysFor(community, datesSeasonId).map((d) => ({ day: d.day, label: d.label }));
  const answers = dateAnswers(community, datesSeasonId);
  const career = new Map(playerLeaderboard(idx, filterGames(idx, { type: "official" })).map((r) => [r.player.id, r]));
  const latestSeason = sortedSeasons(idx.data).find((s) => s.id !== auction.season_id);

  const playerIds = new Set([...snapshot.lots.map((l) => l.player_id), ...snapshot.teams.map((t) => t.captain_player_id).filter((x): x is string => !!x)]);
  const players: Record<string, RoomPlayer> = {};
  for (const id of playerIds) {
    const p = idx.playerById.get(id);
    if (!p) continue;
    const prof = profiles.get(id);
    const c = career.get(id);
    const lastRoster = idx.data.rosters.filter((r) => r.player_id === id && r.season_id === latestSeason?.id).at(-1);
    players[id] = {
      id,
      ign: p.ign,
      photo: prof?.photo_url ?? p.photo_url ?? null,
      role: prof?.role ?? null,
      bio: prof?.bio ?? null,
      verified: verified.has(id),
      lastTeam: lastRoster ? idx.teamById.get(lastRoster.team_id)?.name ?? null : null,
      stats: c ? { games: c.games, kills: c.kills, revives: c.revives, mvp: c.mvp, potm: c.potm, avgKills: c.avgKills } : null,
      availability: availability.get(id) ?? null,
      dates: answers.get(id) ?? {},
    };
  }
  const teams: Record<string, Team> = {};
  for (const t of snapshot.teams) {
    const team = idx.teamById.get(t.team_id);
    if (team) teams[t.team_id] = team;
  }
  const captainTeamId = viewer?.playerId ? snapshot.teams.find((t) => t.captain_player_id === viewer.playerId)?.team_id ?? null : null;

  return (
    <div className="space-y-10">
      <AuctionRoom
        auctionId={auction.id}
        initial={snapshot}
        players={players}
        matchDays={matchDays}
        teams={teams}
        viewer={{ isAdmin: !!viewer?.isAdmin, captainTeamId, signedIn: !!viewer, playerId: viewer?.playerId ?? null, userId: viewer?.userId ?? null }}
        screen={sp.screen === "1"}
      />
      {sp.screen !== "1" && (
        <AuctionValue
          idx={idx}
          auction={auction}
          lots={community.auctionLots.filter((l) => l.auction_id === auction.id)}
          teams={community.auctionTeams.filter((t) => t.auction_id === auction.id)}
        />
      )}
    </div>
  );
}
