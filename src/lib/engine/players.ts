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
  /** Games their team won. */
  wins: number;
  /** Their team's kills in the games they played. */
  teamKills: number;
  /** Contribution: share of their team's kills in the games they played (0–1). */
  share: number;
  /** Win contribution: share of their team's kills in the games their team won (0–1). */
  winShare: number;
  /** Rounds played (fairer than games: maps are 21 or 23 rounds). */
  rounds: number;
  /** Kills per round. */
  kpr: number;
  /** Games with at least CARRY_SHARE of their team's kills. */
  carries: number;
  /** Most kills in one game. */
  best: number;
}

/** A "carry" game: the player took at least this share of the team's kills. */
export const CARRY_SHARE = 0.4;

/** Their team's kills in a game (from the side they played on). */
export const teamKillsFor = (g: GameView, teamId: string) => (teamId === g.fixture.team_a_id ? g.killsA : g.killsB);
const roundsOf = (g: GameView) => (g.game.team_a_rounds ?? 0) + (g.game.team_b_rounds ?? 0);

export function playerLeaderboard(idx: LeagueIndex, games: GameView[]): PlayerAgg[] {
  const completed = games.filter((g) => g.completed);
  const aggs = new Map<string, PlayerAgg & { lastTeamId: string; winKills: number; winTeamKills: number }>();
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
          wins: 0,
          teamKills: 0,
          share: 0,
          winShare: 0,
          rounds: 0,
          kpr: 0,
          carries: 0,
          best: 0,
          winKills: 0,
          winTeamKills: 0,
        };
        aggs.set(player.id, agg);
      }
      const tk = teamKillsFor(g, stat.team_id);
      const won = g.winnerId === stat.team_id;
      agg.games++;
      agg.kills += stat.kills;
      agg.revives += stat.revives;
      agg.mvp += mvpScore(stat, g.season);
      agg.lastTeamId = stat.team_id;
      agg.teamKills += tk;
      agg.rounds += roundsOf(g);
      agg.best = Math.max(agg.best, stat.kills);
      const mates = (stat.team_id === g.fixture.team_a_id ? g.statsA : g.statsB).length;
      if (tk > 0 && mates >= 2 && stat.kills / tk >= CARRY_SHARE) agg.carries++;
      if (won) {
        agg.wins++;
        agg.winKills += stat.kills;
        agg.winTeamKills += tk;
      }
    }
    if (g.game.potm_player_id) {
      const agg = aggs.get(g.game.potm_player_id);
      if (agg) agg.potm++;
    }
  }

  return [...aggs.values()].map(({ lastTeamId, winKills, winTeamKills, ...agg }) => {
    const teamGames = teamGameCount.get(lastTeamId) ?? agg.games;
    return {
      ...agg,
      team: idx.teamById.get(lastTeamId) ?? null,
      avgKills: agg.games ? agg.kills / agg.games : 0,
      avgRevives: agg.games ? agg.revives / agg.games : 0,
      teamGames,
      qualifiesForAverage: agg.games >= Math.ceil(teamGames / 2),
      share: agg.teamKills ? agg.kills / agg.teamKills : 0,
      winShare: winTeamKills ? winKills / winTeamKills : 0,
      kpr: agg.rounds ? agg.kills / agg.rounds : 0,
    };
  });
}

export type AwardKey = "kills" | "revives" | "mvp" | "potm" | "avgKills" | "share" | "winShare" | "kpr" | "carries";

/** Rate stats are only ranked for players who played at least half of their team's games. */
const RATE_KEYS: AwardKey[] = ["avgKills", "share", "winShare", "kpr"];

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
  { key: "share", title: "Biggest Contributor", stat: "of team kills", description: "Share of their team's kills in the games they played" },
  { key: "winShare", title: "Match Winner", stat: "of kills in wins", description: "Share of their team's kills in the games it won" },
  { key: "kpr", title: "Kills per Round", stat: "Kills / round", description: "Kills per round played (fair across 21 and 23 round maps)" },
  { key: "carries", title: "Carry King", stat: "Carry games", description: `Games with ${CARRY_SHARE * 100}%+ of their team's kills` },
];

export function rankBy(rows: PlayerAgg[], key: AwardKey): PlayerAgg[] {
  const pool = RATE_KEYS.includes(key) ? rows.filter((r) => r.qualifiesForAverage && (key !== "winShare" || r.wins > 0)) : rows;
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
  /** Share of the team's kills (0–1), and the same in won games only. */
  share: number;
  winShare: number;
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
  /** Their team's kills in this game. */
  teamKills: number;
}

export interface Career {
  player: Player;
  totals: { games: number; kills: number; revives: number; mvp: number; potm: number; titles: number; share: number; winShare: number };
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
      teamKills: teamKillsFor(view, stat.team_id),
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
      ...shares(rows),
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
      ...shares(log),
    },
    currentTeam: current ? idx.teamById.get(current.team_id) ?? null : null,
    seasons,
    log,
    history,
  };
}

function shares(rows: CareerLogRow[]): { share: number; winShare: number } {
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const tk = sum(rows.map((r) => r.teamKills));
  const wins = rows.filter((r) => r.won);
  const wtk = sum(wins.map((r) => r.teamKills));
  return { share: tk ? sum(rows.map((r) => r.stat.kills)) / tk : 0, winShare: wtk ? sum(wins.map((r) => r.stat.kills)) / wtk : 0 };
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

