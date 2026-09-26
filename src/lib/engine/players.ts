import type { FixtureType, Player, PlayerGameStat, Season, Team } from "../types";
import {
  sortedSeasons,
  teamFinish,
  type GameView,
  type LeagueIndex,
} from "./league";

export function mvpScore(stat: Pick<PlayerGameStat, "kills" | "revives">, season: Season): number {
  return stat.kills * Number(season.mvp_kill_weight) + stat.revives * Number(season.mvp_revive_weight);
}

// ---------------------------------------------------------------------------
// Leaderboards
// ---------------------------------------------------------------------------

export interface PlayerAgg {
  player: Player;
  /** Team in the player's most recent game within the filtered set. */
  team: Team | null;
  games: number;
  kills: number;
  revives: number;
  mvp: number;
  potm: number;
  avgKills: number;
  avgRevives: number;
  /** Completed games the player's team played in the set; used for the "Best average" minimum. */
  teamGames: number;
  qualifiesForAverage: boolean;
}

export function playerLeaderboard(idx: LeagueIndex, games: GameView[]): PlayerAgg[] {
  const completed = games.filter((g) => g.completed);
  const aggs = new Map<string, PlayerAgg & { lastTeamId: string }>();
  const teamGameCount = new Map<string, number>();

  for (const g of completed) {
    for (const t of [g.teamA, g.teamB]) {
      if (t) teamGameCount.set(t.id, (teamGameCount.get(t.id) ?? 0) + 1);
    }
    for (const stat of [...g.statsA, ...g.statsB]) {
      const player = idx.playerById.get(stat.player_id);
      if (!player) continue;
      let agg = aggs.get(player.id);
      if (!agg) {
        agg = {
          player,
          team: null,
          lastTeamId: stat.team_id,
          games: 0,
          kills: 0,
          revives: 0,
          mvp: 0,
          potm: 0,
          avgKills: 0,
          avgRevives: 0,
          teamGames: 0,
          qualifiesForAverage: false,
        };
        aggs.set(player.id, agg);
      }
      agg.games++;
      agg.kills += stat.kills;
      agg.revives += stat.revives;
      agg.mvp += mvpScore(stat, g.season);
      agg.lastTeamId = stat.team_id;
    }
    if (g.game.potm_player_id) {
      const agg = aggs.get(g.game.potm_player_id);
      if (agg) agg.potm++;
    }
  }

  return [...aggs.values()].map(({ lastTeamId, ...agg }) => {
    const teamGames = teamGameCount.get(lastTeamId) ?? agg.games;
    return {
      ...agg,
      team: idx.teamById.get(lastTeamId) ?? null,
      avgKills: agg.games ? agg.kills / agg.games : 0,
      avgRevives: agg.games ? agg.revives / agg.games : 0,
      teamGames,
      qualifiesForAverage: agg.games >= Math.ceil(teamGames / 2),
    };
  });
}

export type AwardKey = "kills" | "revives" | "mvp" | "potm" | "avgKills";

export const AWARDS: { key: AwardKey; title: string; stat: string; description: string }[] = [
  { key: "mvp", title: "Season MVP", stat: "MVP pts", description: "Kills and revives combined" },
  { key: "kills", title: "Top Fragger", stat: "Kills", description: "Most kills" },
  { key: "revives", title: "Best Support", stat: "Revives", description: "Most revives" },
  { key: "potm", title: "Most POTM", stat: "Awards", description: "Most Player of the Match awards" },
  {
    key: "avgKills",
    title: "Best Average",
    stat: "Kills / game",
    description: "Kills per game (played at least half of their team's games)",
  },
];

export function rankBy(rows: PlayerAgg[], key: AwardKey): PlayerAgg[] {
  const pool = key === "avgKills" ? rows.filter((r) => r.qualifiesForAverage) : rows;
  return [...pool].sort(
    (a, b) =>
      b[key] - a[key] ||
      b.mvp - a.mvp ||
      b.kills - a.kills ||
      a.player.ign.localeCompare(b.player.ign),
  );
}

export interface TeamAgg {
  team: Team;
  games: number;
  kills: number;
  revives: number;
}

export function teamTotals(idx: LeagueIndex, games: GameView[]): TeamAgg[] {
  const out = new Map<string, TeamAgg>();
  for (const g of games) {
    if (!g.completed) continue;
    for (const [team, kills, revives] of [
      [g.teamA, g.killsA, g.revivesA],
      [g.teamB, g.killsB, g.revivesB],
    ] as const) {
      if (!team) continue;
      const agg = out.get(team.id) ?? { team, games: 0, kills: 0, revives: 0 };
      agg.games++;
      agg.kills += kills;
      agg.revives += revives;
      out.set(team.id, agg);
    }
  }
  return [...out.values()];
}

/** Top MVP score on the winning side (ties: kills, then revives). */
export function suggestPotm(
  season: Season,
  winnerStats: Pick<PlayerGameStat, "player_id" | "kills" | "revives">[],
): string | null {
  const best = [...winnerStats].sort(
    (a, b) =>
      mvpScore(b, season) - mvpScore(a, season) || b.kills - a.kills || b.revives - a.revives,
  )[0];
  return best?.player_id ?? null;
}

// ---------------------------------------------------------------------------
// Player career
// ---------------------------------------------------------------------------

export interface CareerSeasonRow {
  season: Season;
  teams: Team[];
  games: number;
  kills: number;
  revives: number;
  mvp: number;
  potm: number;
  avgKills: number;
  finish: string | null;
}

export interface CareerLogRow {
  view: GameView;
  stat: PlayerGameStat;
  team: Team | null;
  opponent: Team | null;
  won: boolean;
  isPotm: boolean;
  mvp: number;
}

export interface Career {
  player: Player;
  totals: { games: number; kills: number; revives: number; mvp: number; potm: number; titles: number };
  currentTeam: Team | null;
  seasons: CareerSeasonRow[];
  log: CareerLogRow[];
  history: { season: Season; team: Team; left: boolean }[];
}

export function playerCareer(
  idx: LeagueIndex,
  playerId: string,
  type: FixtureType | "all",
): Career | null {
  const player = idx.playerById.get(playerId);
  if (!player) return null;

  const log: CareerLogRow[] = [];
  for (const stat of idx.statsByPlayer.get(playerId) ?? []) {
    const view = idx.viewById.get(stat.game_id);
    if (!view || !view.completed) continue;
    if (type !== "all" && view.fixture.type !== type) continue;
    const onA = stat.team_id === view.fixture.team_a_id;
    log.push({
      view,
      stat,
      team: idx.teamById.get(stat.team_id) ?? null,
      opponent: onA ? view.teamB : view.teamA,
      won: view.winnerId === stat.team_id,
      isPotm: view.game.potm_player_id === playerId,
      mvp: mvpScore(stat, view.season),
    });
  }
  log.sort((a, b) => -compareLog(a, b));

  // Roster history (every season the player was registered, even without games).
  const history = idx.data.rosters
    .filter((r) => r.player_id === playerId)
    .map((r) => ({
      season: idx.seasonById.get(r.season_id)!,
      team: idx.teamById.get(r.team_id)!,
      left: !!r.left_on,
      joined: r.joined_on,
    }))
    .filter((h) => h.season && h.team)
    .sort((a, b) => a.season.number - b.season.number || a.joined.localeCompare(b.joined))
    .map(({ season, team, left }) => ({ season, team, left }));

  const seasons: CareerSeasonRow[] = [];
  for (const season of sortedSeasons(idx.data)) {
    const rows = log.filter((l) => l.view.season.id === season.id);
    const rosterTeams = history.filter((h) => h.season.id === season.id).map((h) => h.team);
    if (rows.length === 0 && rosterTeams.length === 0) continue;
    const teams = uniqueTeams([...rosterTeams, ...rows.map((r) => r.team).filter((t): t is Team => !!t)]);
    const kills = rows.reduce((a, r) => a + r.stat.kills, 0);
    const lastTeam = rows[0]?.team ?? rosterTeams.at(-1) ?? null;
    seasons.push({
      season,
      teams,
      games: rows.length,
      kills,
      revives: rows.reduce((a, r) => a + r.stat.revives, 0),
      mvp: rows.reduce((a, r) => a + r.mvp, 0),
      potm: rows.filter((r) => r.isPotm).length,
      avgKills: rows.length ? kills / rows.length : 0,
      finish: lastTeam ? teamFinish(idx, season.id, lastTeam.id) : null,
    });
  }

  const latestSeason = sortedSeasons(idx.data)[0];
  const current = idx.data.rosters.find(
    (r) => r.player_id === playerId && r.season_id === latestSeason?.id && !r.left_on,
  );

  return {
    player,
    totals: {
      games: log.length,
      kills: log.reduce((a, r) => a + r.stat.kills, 0),
      revives: log.reduce((a, r) => a + r.stat.revives, 0),
      mvp: log.reduce((a, r) => a + r.mvp, 0),
      potm: log.filter((r) => r.isPotm).length,
      titles: seasons.filter((s) => s.finish === "Champion").length,
    },
    currentTeam: current ? idx.teamById.get(current.team_id) ?? null : null,
    seasons,
    log,
    history,
  };
}

function compareLog(a: CareerLogRow, b: CareerLogRow): number {
  const av = a.view;
  const bv = b.view;
  return (
    av.season.number - bv.season.number ||
    (av.game.scheduled_at ?? "").localeCompare(bv.game.scheduled_at ?? "") ||
    (av.fixture.matchday ?? 0) - (bv.fixture.matchday ?? 0) ||
    av.fixture.sort_order - bv.fixture.sort_order ||
    av.game.game_no - bv.game.game_no
  );
}

function uniqueTeams(teams: Team[]): Team[] {
  const seen = new Set<string>();
  return teams.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
}

/** Players registered for a team in a season (active first). */
export function teamRoster(idx: LeagueIndex, seasonId: string, teamId: string) {
  return idx.data.rosters
    .filter((r) => r.season_id === seasonId && r.team_id === teamId)
    .map((r) => ({ entry: r, player: idx.playerById.get(r.player_id)! }))
    .filter((r) => r.player)
    .sort(
      (a, b) =>
        Number(!!a.entry.left_on) - Number(!!b.entry.left_on) ||
        a.player.ign.localeCompare(b.player.ign),
    );
}

export function gamesForTeam(games: GameView[], teamId: string): GameView[] {
  return games.filter((g) => g.teamA?.id === teamId || g.teamB?.id === teamId);
}

