// Champions and runners-up with their squads, and the honours each player has won.
import type { Player, Season, Team } from "../types";
import { filterGames, playoffSeries, seasonPodium, sortedSeasons, type LeagueIndex } from "./league";

export interface SquadMember {
  player: Player;
  /** Official games and kills for this team in the season. */
  games: number;
  kills: number;
}

export interface SeasonHonours {
  season: Season;
  champion: Team;
  runnerUp: Team | null;
  championSquad: SquadMember[];
  runnerUpSquad: SquadMember[];
  /** The Final series score from the champion's side, or null when the league table decided it. */
  final: { won: number; lost: number; fixtureId: string } | null;
  /** The champion's top fragger across the Final's games. */
  finalStar: { player: Player; kills: number } | null;
}

/** Everyone on the team's roster that season, plus anyone who played for it; most kills first. */
function squad(idx: LeagueIndex, seasonId: string, teamId: string): SquadMember[] {
  const rows = new Map<string, SquadMember>();
  const add = (playerId: string) => {
    const player = idx.playerById.get(playerId);
    if (player && !rows.has(playerId)) rows.set(playerId, { player, games: 0, kills: 0 });
    return rows.get(playerId);
  };
  for (const r of idx.data.rosters) if (r.season_id === seasonId && r.team_id === teamId) add(r.player_id);
  for (const g of filterGames(idx, { seasonId, type: "official" })) {
    if (!g.completed) continue;
    for (const st of [...g.statsA, ...g.statsB]) {
      if (st.team_id !== teamId) continue;
      const row = add(st.player_id);
      if (!row) continue;
      row.games++;
      row.kills += st.kills;
    }
  }
  return [...rows.values()].sort((a, b) => b.kills - a.kills || b.games - a.games || a.player.ign.localeCompare(b.player.ign));
}

export function seasonHonours(idx: LeagueIndex, seasonId: string): SeasonHonours | null {
  const season = idx.seasonById.get(seasonId);
  const { champion, runnerUp } = seasonPodium(idx, seasonId);
  if (!season || !champion) return null;

  const series = playoffSeries(idx, seasonId).get("final");
  let final: SeasonHonours["final"] = null;
  let finalStar: SeasonHonours["finalStar"] = null;
  if (series?.winnerId === champion.id) {
    const champIsA = series.fixture.team_a_id === champion.id;
    final = { won: champIsA ? series.winsA : series.winsB, lost: champIsA ? series.winsB : series.winsA, fixtureId: series.fixture.id };
    const kills = new Map<string, number>();
    for (const g of series.games) {
      if (!g.completed) continue;
      for (const st of champIsA ? g.statsA : g.statsB) kills.set(st.player_id, (kills.get(st.player_id) ?? 0) + st.kills);
    }
    const [id, k] = [...kills.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    const player = id ? idx.playerById.get(id) : undefined;
    if (player && k) finalStar = { player, kills: k };
  }

  return {
    season,
    champion,
    runnerUp,
    championSquad: squad(idx, seasonId, champion.id),
    runnerUpSquad: runnerUp ? squad(idx, seasonId, runnerUp.id) : [],
    final,
    finalStar,
  };
}

export interface PlayerHonour {
  season: Season;
  kind: "champion" | "runner-up";
  team: Team;
}

/** Every season that has a champion, newest first. */
export function honoursBySeason(idx: LeagueIndex): SeasonHonours[] {
  return sortedSeasons(idx.data)
    .map((s) => seasonHonours(idx, s.id))
    .filter((h): h is SeasonHonours => h !== null);
}

/** Player id → their champion / runner-up finishes, oldest season first. */
export function playerHonoursMap(idx: LeagueIndex): Map<string, PlayerHonour[]> {
  const out = new Map<string, PlayerHonour[]>();
  const push = (id: string, h: PlayerHonour) => out.set(id, [...(out.get(id) ?? []), h]);
  for (const h of honoursBySeason(idx).reverse()) {
    for (const m of h.championSquad) push(m.player.id, { season: h.season, kind: "champion", team: h.champion });
    if (h.runnerUp) for (const m of h.runnerUpSquad) push(m.player.id, { season: h.season, kind: "runner-up", team: h.runnerUp });
  }
  return out;
}
