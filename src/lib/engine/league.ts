import {
  PLAYOFF_STAGES,
  STAGE_LABELS,
  type Fixture,
  type FixtureType,
  type Game,
  type GameMap,
  type LeagueData,
  type Player,
  type PlayerGameStat,
  type PlayoffStage,
  type Season,
  type Stage,
  type Team,
  type TiebreakKey,
} from "../types";
import { dateKey } from "../time";
import { playoffMapOrder } from "./schedule";
import { playoffFormat, playoffsActive } from "../playoff-formats";

// ---------------------------------------------------------------------------
// Index: lookup maps + a denormalised view of every game
// ---------------------------------------------------------------------------

export interface GameView {
  game: Game;
  fixture: Fixture;
  season: Season;
  map: GameMap | null;
  teamA: Team | null;
  teamB: Team | null;
  completed: boolean;
  winnerId: string | null;
  loserId: string | null;
  statsA: PlayerGameStat[];
  statsB: PlayerGameStat[];
  killsA: number;
  killsB: number;
  revivesA: number;
  revivesB: number;
  /** "Match 12", "Qualifier 1 · Game 2", "Practice 3" */
  label: string;
  /** Unplayed playoff games: game 3 before a 1–1 ("if_needed"), or any game after a series is won ("not_needed"). */
  playoffNote: "if_needed" | "not_needed" | null;
}

export interface LeagueIndex {
  data: LeagueData;
  seasonById: Map<string, Season>;
  teamById: Map<string, Team>;
  playerById: Map<string, Player>;
  mapById: Map<string, GameMap>;
  fixtureById: Map<string, Fixture>;
  statsByPlayer: Map<string, PlayerGameStat[]>;
  views: GameView[];
  viewById: Map<string, GameView>;
}

const STAGE_ORDER: Record<Stage, number> = {
  league: 0,
  qualifier_1: 1,
  semi_final_1: 2,
  semi_final_2: 3,
  eliminator: 4,
  qualifier_2: 5,
  final: 6,
  practice: 7,
};

function byId<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((r) => [r.id, r]));
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = out.get(k);
    if (list) list.push(r);
    else out.set(k, [r]);
  }
  return out;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

const byDateNullsLast = (a: string | null, b: string | null) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1);

export function compareGames(a: GameView, b: GameView): number {
  return (
    a.season.number - b.season.number ||
    STAGE_ORDER[a.fixture.stage] - STAGE_ORDER[b.fixture.stage] ||
    (a.fixture.stage === "practice"
      ? (a.game.scheduled_at ?? "").localeCompare(b.game.scheduled_at ?? "")
      : 0) ||
    // Calendar-planned league games (no matchdays): by date, unscheduled last.
    (a.fixture.stage === "league" && a.fixture.matchday == null && b.fixture.matchday == null
      ? byDateNullsLast(a.game.scheduled_at, b.game.scheduled_at)
      : 0) ||
    (a.fixture.matchday ?? 0) - (b.fixture.matchday ?? 0) ||
    a.fixture.sort_order - b.fixture.sort_order ||
    a.game.game_no - b.game.game_no ||
    a.game.id.localeCompare(b.game.id)
  );
}

export function buildIndex(data: LeagueData): LeagueIndex {
  const seasonById = byId(data.seasons);
  const teamById = byId(data.teams);
  const playerById = byId(data.players);
  const mapById = byId(data.maps);
  const fixtureById = byId(data.fixtures);
  const statsByGame = groupBy(data.stats, (s) => s.game_id);
  const statsByPlayer = groupBy(data.stats, (s) => s.player_id);

  const views: GameView[] = [];
  for (const game of data.games) {
    const fixture = fixtureById.get(game.fixture_id);
    const season = fixture && seasonById.get(fixture.season_id);
    if (!fixture || !season) continue;
    const stats = statsByGame.get(game.id) ?? [];
    const statsA = stats.filter((s) => s.team_id === fixture.team_a_id);
    const statsB = stats.filter((s) => s.team_id === fixture.team_b_id);
    const hasScore =
      game.status === "completed" &&
      game.team_a_rounds != null &&
      game.team_b_rounds != null &&
      game.team_a_rounds !== game.team_b_rounds &&
      !!fixture.team_a_id &&
      !!fixture.team_b_id;
    const aWon = hasScore && game.team_a_rounds! > game.team_b_rounds!;
    views.push({
      game,
      fixture,
      season,
      map: game.map_id ? mapById.get(game.map_id) ?? null : null,
      teamA: fixture.team_a_id ? teamById.get(fixture.team_a_id) ?? null : null,
      teamB: fixture.team_b_id ? teamById.get(fixture.team_b_id) ?? null : null,
      completed: hasScore,
      winnerId: hasScore ? (aWon ? fixture.team_a_id : fixture.team_b_id) : null,
      loserId: hasScore ? (aWon ? fixture.team_b_id : fixture.team_a_id) : null,
      statsA,
      statsB,
      killsA: sum(statsA.map((s) => s.kills)),
      killsB: sum(statsB.map((s) => s.kills)),
      revivesA: sum(statsA.map((s) => s.revives)),
      revivesB: sum(statsB.map((s) => s.revives)),
      label: "",
      playoffNote: null,
    });
  }
  views.sort(compareGames);

  // Sequential labels per season and type.
  const counters = new Map<string, number>();
  for (const v of views) {
    if (v.fixture.stage === "league" || v.fixture.stage === "practice") {
      const key = `${v.season.id}:${v.fixture.stage}`;
      const n = (counters.get(key) ?? 0) + 1;
      counters.set(key, n);
      v.label = v.fixture.stage === "league" ? `Match ${n}` : `Practice ${n}`;
    } else {
      v.label = `${STAGE_LABELS[v.fixture.stage]} · Game ${v.game.game_no}`;
    }
  }

  // Best-of-3 series: mark games that can no longer be needed, and game 3 until it's 1–1.
  for (const [, games] of groupBy(
    views.filter((v) => PLAYOFF_STAGES.includes(v.fixture.stage as PlayoffStage)),
    (v) => v.fixture.id,
  )) {
    const { winsA, winsB, winnerId } = seriesFromGames(games[0].fixture.team_a_id, games[0].fixture.team_b_id, games);
    for (const v of games) {
      if (v.completed) continue;
      v.playoffNote = winnerId ? "not_needed" : v.game.game_no === 3 && !(winsA === 1 && winsB === 1) ? "if_needed" : null;
    }
  }

  return {
    data,
    seasonById,
    teamById,
    playerById,
    mapById,
    fixtureById,
    statsByPlayer,
    views,
    viewById: new Map(views.map((v) => [v.game.id, v])),
  };
}

// ---------------------------------------------------------------------------
// Season helpers
// ---------------------------------------------------------------------------

export function sortedSeasons(data: LeagueData): Season[] {
  return [...data.seasons].sort((a, b) => b.number - a.number);
}

/** The latest active season, else the latest non-draft, else the latest. */
export function currentSeason(data: LeagueData): Season | null {
  const seasons = sortedSeasons(data);
  return (
    seasons.find((s) => s.status === "active") ??
    seasons.find((s) => s.status !== "draft") ??
    seasons[0] ??
    null
  );
}

/** Seasons running right now (several can overlap, e.g. one in its playoffs as the next starts). */
export function activeSeasons(data: LeagueData): Season[] {
  return sortedSeasons(data).filter((s) => s.status === "active");
}

/**
 * The season to open by default when several are active: one already under way and not finished,
 * then whichever has the soonest scheduled game, then the newest.
 */
export function featuredSeason(idx: LeagueIndex): Season | null {
  const active = activeSeasons(idx.data);
  if (active.length <= 1) return currentSeason(idx.data);
  const info = active.map((season) => {
    const games = filterGames(idx, { seasonId: season.id, type: "official" });
    const next = upNext(games, 1)[0];
    return {
      season,
      underway: games.some((g) => g.completed) && !!next,
      at: next?.game.scheduled_at ?? "~",
    };
  });
  info.sort((x, y) => Number(y.underway) - Number(x.underway) || (x.at < y.at ? -1 : x.at > y.at ? 1 : 0) || y.season.number - x.season.number);
  return info[0].season;
}

/** Short stage for season pickers: "Champions", "Playoffs", "League", "Starting soon". */
export function seasonPhase(idx: LeagueIndex, season: Season): string {
  const games = filterGames(idx, { seasonId: season.id, type: "official" });
  if (seasonPodium(idx, season.id).champion) return "Champions";
  if (isLeagueComplete(idx, season.id)) return "Playoffs";
  return games.some((g) => g.completed) ? "League" : "Starting soon";
}

export function seasonByNumber(data: LeagueData, n: number): Season | null {
  return data.seasons.find((s) => s.number === n) ?? null;
}

export interface GameFilter {
  seasonId?: string | null;
  type?: FixtureType | "all";
  stages?: Stage[];
}

export function filterGames(idx: LeagueIndex, f: GameFilter): GameView[] {
  return idx.views.filter(
    (v) =>
      (!f.seasonId || v.season.id === f.seasonId) &&
      (!f.type || f.type === "all" || v.fixture.type === f.type) &&
      (!f.stages || f.stages.includes(v.fixture.stage)),
  );
}

export function seasonTeams(idx: LeagueIndex, seasonId: string): Team[] {
  return idx.data.seasonTeams
    .filter((st) => st.season_id === seasonId)
    .map((st) => idx.teamById.get(st.team_id))
    .filter((t): t is Team => !!t)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function seasonMaps(idx: LeagueIndex, seasonId: string): GameMap[] {
  return idx.data.seasonMaps
    .filter((sm) => sm.season_id === seasonId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((sm) => idx.mapById.get(sm.map_id))
    .filter((m): m is GameMap => !!m);
}

/** Next game to be played (earliest scheduled among unplayed games with both teams known). */
export function upNext(games: GameView[], count = 1): GameView[] {
  return games
    .filter((v) => !v.completed && v.teamA && v.teamB && v.playoffNote !== "not_needed")
    .sort((a, b) => {
      const ta = a.game.scheduled_at ?? "9999";
      const tb = b.game.scheduled_at ?? "9999";
      return ta.localeCompare(tb) || compareGames(a, b);
    })
    .slice(0, count);
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

export interface StandingRow {
  team: Team;
  position: number;
  played: number;
  won: number;
  lost: number;
  points: number;
  roundsWon: number;
  roundsLost: number;
  kills: number;
  killsConceded: number;
  revives: number;
  /** (RW − RL) ÷ rounds played */
  nrr: number;
  /** (kills − kills conceded) ÷ rounds played */
  nkr: number;
  roundWinPct: number;
  /** Oldest → newest, last 5 */
  form: ("W" | "L")[];
  remaining: number;
  mark: "Q" | "E" | null;
}

const EPS = 1e-9;

/**
 * Ranks teams from a set of games (e.g. a season's official league games, or its practice games).
 * Scheduled games with both teams known count toward `remaining` for qualification maths.
 */
export function computeStandings(
  season: Season,
  teams: Team[],
  games: GameView[],
  opts: { playoffSpots?: number } = {},
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const team of teams) {
    rows.set(team.id, {
      team,
      position: 0,
      played: 0,
      won: 0,
      lost: 0,
      points: 0,
      roundsWon: 0,
      roundsLost: 0,
      kills: 0,
      killsConceded: 0,
      revives: 0,
      nrr: 0,
      nkr: 0,
      roundWinPct: 0,
      form: [],
      remaining: 0,
      mark: null,
    });
  }

  const completed = games.filter((g) => g.completed);
  for (const g of games) {
    if (g.completed || !g.teamA || !g.teamB) continue;
    for (const id of [g.teamA.id, g.teamB.id]) {
      const row = rows.get(id);
      if (row) row.remaining++;
    }
  }

  for (const g of completed) {
    const sides: [Team | null, number, number, number, number, number][] = [
      [g.teamA, g.game.team_a_rounds!, g.game.team_b_rounds!, g.killsA, g.killsB, g.revivesA],
      [g.teamB, g.game.team_b_rounds!, g.game.team_a_rounds!, g.killsB, g.killsA, g.revivesB],
    ];
    for (const [team, rw, rl, k, kc, rev] of sides) {
      const row = team && rows.get(team.id);
      if (!row) continue;
      const won = g.winnerId === team.id;
      row.played++;
      if (won) row.won++;
      else row.lost++;
      row.points += won ? season.points_win : season.points_loss;
      row.roundsWon += rw;
      row.roundsLost += rl;
      row.kills += k;
      row.killsConceded += kc;
      row.revives += rev;
      row.form.push(won ? "W" : "L");
    }
  }

  for (const row of rows.values()) {
    const rounds = row.roundsWon + row.roundsLost;
    row.nrr = rounds ? (row.roundsWon - row.roundsLost) / rounds : 0;
    row.nkr = rounds ? (row.kills - row.killsConceded) / rounds : 0;
    row.roundWinPct = rounds ? row.roundsWon / rounds : 0;
    row.form = row.form.slice(-5);
  }

  const h2hPoints = (group: StandingRow[]): Map<string, number> => {
    const ids = new Set(group.map((r) => r.team.id));
    const pts = new Map(group.map((r) => [r.team.id, 0]));
    for (const g of completed) {
      if (!g.winnerId || !g.loserId || !ids.has(g.winnerId) || !ids.has(g.loserId)) continue;
      pts.set(g.winnerId, pts.get(g.winnerId)! + season.points_win);
      pts.set(g.loserId, pts.get(g.loserId)! + season.points_loss);
    }
    return pts;
  };

  const metric = (key: TiebreakKey, row: StandingRow, h2h: () => Map<string, number>): number => {
    switch (key) {
      case "nrr":
        return row.nrr;
      case "nkr":
        return row.nkr;
      case "kills":
        return row.kills;
      case "revives":
        return row.revives;
      case "round_win_pct":
        return row.roundWinPct;
      case "h2h":
        return h2h().get(row.team.id) ?? 0;
    }
  };

  const criteria: TiebreakKey[] = season.tiebreak_order?.length
    ? season.tiebreak_order
    : ["nrr", "nkr", "h2h", "kills"];

  // Sort a tied group by criteria[idx], split into still-tied subgroups and recurse.
  // Head-to-head is evaluated as a mini-league among exactly the teams still tied.
  const resolve = (group: StandingRow[], idx: number): StandingRow[] => {
    if (group.length < 2 || idx >= criteria.length) {
      return [...group].sort((a, b) => a.team.name.localeCompare(b.team.name));
    }
    let cachedH2h: Map<string, number> | null = null;
    const h2h = () => (cachedH2h ??= h2hPoints(group));
    const values = new Map(group.map((r) => [r.team.id, metric(criteria[idx], r, h2h)]));
    const sorted = [...group].sort((a, b) => values.get(b.team.id)! - values.get(a.team.id)!);
    const out: StandingRow[] = [];
    for (let i = 0; i < sorted.length; ) {
      let j = i + 1;
      while (
        j < sorted.length &&
        Math.abs(values.get(sorted[j].team.id)! - values.get(sorted[i].team.id)!) < EPS
      ) {
        j++;
      }
      out.push(...resolve(sorted.slice(i, j), idx + 1));
      i = j;
    }
    return out;
  };

  const byPoints = [...rows.values()].sort((a, b) => b.points - a.points);
  const ranked: StandingRow[] = [];
  for (let i = 0; i < byPoints.length; ) {
    let j = i + 1;
    while (j < byPoints.length && byPoints[j].points === byPoints[i].points) j++;
    ranked.push(...resolve(byPoints.slice(i, j), 0));
    i = j;
  }
  ranked.forEach((r, i) => (r.position = i + 1));

  if (opts.playoffSpots) applyQualificationMarks(ranked, season, opts.playoffSpots);
  return ranked;
}

/**
 * Q = guaranteed a top-`spots` finish, E = can no longer reach it. Uses points only, so it is
 * conservative: a team is only marked when no tie-breaker outcome could change it.
 */
function applyQualificationMarks(rows: StandingRow[], season: Season, spots: number) {
  const anyPlayed = rows.some((r) => r.played > 0);
  if (!anyPlayed) return;
  const n = Math.min(spots, rows.length);
  const leagueDone = rows.every((r) => r.remaining === 0);
  const maxPts = (r: StandingRow) => r.points + r.remaining * season.points_win;
  for (const row of rows) {
    if (leagueDone) {
      row.mark = row.position <= n ? "Q" : "E";
      continue;
    }
    const others = rows.filter((r) => r !== row);
    const surelyAbove = others.filter((r) => r.points > maxPts(row)).length;
    const couldReach = others.filter((r) => maxPts(r) >= row.points).length;
    if (surelyAbove >= n) row.mark = "E";
    else if (couldReach < n) row.mark = "Q";
  }
}

export function leagueStandings(idx: LeagueIndex, season: Season): StandingRow[] {
  const games = filterGames(idx, { seasonId: season.id, type: "official", stages: ["league"] });
  const teams = seasonTeams(idx, season.id);
  const spec = playoffFormat(season);
  return computeStandings(season, teams, games, { playoffSpots: playoffsActive(spec, teams.length) ? spec.qualify : 0 });
}

export function practiceStandings(idx: LeagueIndex, season: Season): StandingRow[] {
  const games = filterGames(idx, { seasonId: season.id, type: "practice" });
  const teamIds = new Set<string>();
  for (const g of games) {
    if (g.teamA) teamIds.add(g.teamA.id);
    if (g.teamB) teamIds.add(g.teamB.id);
  }
  const teams = [...teamIds].map((id) => idx.teamById.get(id)!).filter(Boolean);
  return computeStandings(season, teams, games);
}

export function isLeagueComplete(idx: LeagueIndex, seasonId: string): boolean {
  const league = filterGames(idx, { seasonId, type: "official", stages: ["league"] });
  return league.length > 0 && league.every((g) => g.completed);
}

// ---------------------------------------------------------------------------
// Playoffs (IPL style, best of 3)
// ---------------------------------------------------------------------------

export interface SeriesView {
  fixture: Fixture;
  stage: PlayoffStage;
  teamA: Team | null;
  teamB: Team | null;
  games: GameView[];
  winsA: number;
  winsB: number;
  winnerId: string | null;
  loserId: string | null;
}

const WINS_NEEDED = 2;

function seriesFromGames(
  teamAId: string | null,
  teamBId: string | null,
  games: GameView[],
): Pick<SeriesView, "winsA" | "winsB" | "winnerId" | "loserId"> {
  const winsA = games.filter((g) => g.completed && teamAId && g.winnerId === teamAId).length;
  const winsB = games.filter((g) => g.completed && teamBId && g.winnerId === teamBId).length;
  const winnerId = winsA >= WINS_NEEDED ? teamAId : winsB >= WINS_NEEDED ? teamBId : null;
  const loserId = winnerId ? (winnerId === teamAId ? teamBId : teamAId) : null;
  return { winsA, winsB, winnerId, loserId };
}

export function playoffSeries(idx: LeagueIndex, seasonId: string): Map<PlayoffStage, SeriesView> {
  const out = new Map<PlayoffStage, SeriesView>();
  for (const fixture of idx.data.fixtures) {
    if (fixture.season_id !== seasonId || !PLAYOFF_STAGES.includes(fixture.stage as PlayoffStage)) {
      continue;
    }
    const stage = fixture.stage as PlayoffStage;
    const games = idx.views.filter((v) => v.fixture.id === fixture.id);
    out.set(stage, {
      fixture,
      stage,
      teamA: fixture.team_a_id ? idx.teamById.get(fixture.team_a_id) ?? null : null,
      teamB: fixture.team_b_id ? idx.teamById.get(fixture.team_b_id) ?? null : null,
      games,
      ...seriesFromGames(fixture.team_a_id, fixture.team_b_id, games),
    });
  }
  return out;
}

export interface PlayoffPlan {
  fixtureTeams: { fixture_id: string; team_a_id: string | null; team_b_id: string | null }[];
  createGames: { fixture_id: string; game_no: number; map_id: string | null }[];
}

/**
 * Works out what the playoff fixtures should look like right now:
 * - Q1 (1v2) and Eliminator (3v4) seeded from the final league table once every league game is done
 * - Q2 = loser Q1 vs winner Eliminator, Final = winner Q1 vs winner Q2
 * - every series has games 1–3; a missing game 3 is added (older schedules made it only at 1–1).
 *   Game 3 is only played at 1–1; otherwise it shows as "if needed" / "not needed".
 * A series with any completed game keeps its teams (locked).
 */
export function planPlayoffs(idx: LeagueIndex, seasonId: string): PlayoffPlan {
  const plan: PlayoffPlan = { fixtureTeams: [], createGames: [] };
  const season = idx.seasonById.get(seasonId);
  if (!season) return plan;
  const series = playoffSeries(idx, seasonId);
  if (series.size === 0) return plan;

  let seeds: (string | null)[] = [null, null, null, null];
  if (isLeagueComplete(idx, seasonId)) {
    const table = leagueStandings(idx, season);
    seeds = [0, 1, 2, 3].map((i) => table[i]?.team.id ?? null);
  }
  const deciderMap = playoffMapOrder(seasonMaps(idx, seasonId))[2] ?? null;

  const settle = (stage: PlayoffStage, want: [string | null, string | null]) => {
    const s = series.get(stage);
    if (!s) return { winnerId: null, loserId: null };
    const locked = s.games.some((g) => g.completed);
    const [a, b] = locked ? [s.fixture.team_a_id, s.fixture.team_b_id] : want;
    if (!locked && (s.fixture.team_a_id !== a || s.fixture.team_b_id !== b)) {
      plan.fixtureTeams.push({ fixture_id: s.fixture.id, team_a_id: a, team_b_id: b });
    }

    if (!s.games.some((g) => g.game.game_no === 3)) {
      plan.createGames.push({ fixture_id: s.fixture.id, game_no: 3, map_id: deciderMap ?? s.games[0]?.game.map_id ?? null });
    }

    return locked ? seriesFromGames(a, b, s.games) : { winnerId: null, loserId: null };
  };

  const format = playoffFormat(season).id;
  if (format === "semis4") {
    const sf1 = settle("semi_final_1", [seeds[0], seeds[3]]);
    const sf2 = settle("semi_final_2", [seeds[1], seeds[2]]);
    settle("final", [sf1.winnerId, sf2.winnerId]);
  } else if (format === "top3") {
    // 1st waits in the Final for the winner of 2nd v 3rd.
    const el = settle("eliminator", [seeds[1], seeds[2]]);
    settle("final", [seeds[0], el.winnerId]);
  } else if (format === "final2") {
    settle("final", [seeds[0], seeds[1]]);
  } else if (format === "ipl4") {
    const q1 = settle("qualifier_1", [seeds[0], seeds[1]]);
    const el = settle("eliminator", [seeds[2], seeds[3]]);
    const q2 = settle("qualifier_2", [q1.loserId, el.winnerId]);
    settle("final", [q1.winnerId, q2.winnerId]);
  }
  return plan;
}

/**
 * Champion and runner-up: the Final's winner and loser, or with no playoffs (format "none", or
 * too few teams for the format) the top two of the finished league table.
 */
export function seasonPodium(idx: LeagueIndex, seasonId: string): { champion: Team | null; runnerUp: Team | null } {
  const season = idx.seasonById.get(seasonId);
  if (!season) return { champion: null, runnerUp: null };
  const spec = playoffFormat(season);
  if (!playoffsActive(spec, seasonTeams(idx, seasonId).length)) {
    if (!isLeagueComplete(idx, seasonId)) return { champion: null, runnerUp: null };
    const table = leagueStandings(idx, season);
    return { champion: table[0]?.team ?? null, runnerUp: table[1]?.team ?? null };
  }
  const final = playoffSeries(idx, seasonId).get("final");
  return {
    champion: final?.winnerId ? idx.teamById.get(final.winnerId) ?? null : null,
    runnerUp: final?.loserId ? idx.teamById.get(final.loserId) ?? null : null,
  };
}

// ---------------------------------------------------------------------------
// Finishing position of a team in a season
// ---------------------------------------------------------------------------

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function teamFinish(idx: LeagueIndex, seasonId: string, teamId: string): string | null {
  const season = idx.seasonById.get(seasonId);
  if (!season) return null;
  const series = playoffSeries(idx, seasonId);
  const final = series.get("final");
  const podium = seasonPodium(idx, seasonId);
  if (podium.champion?.id === teamId) return "Champion";
  if (podium.runnerUp?.id === teamId) return "Runner-up";
  for (const [stage, finish] of Object.entries(playoffFormat(season).loserFinish)) {
    if (series.get(stage as PlayoffStage)?.loserId === teamId) return finish;
  }

  const inPlayoffs = [...series.values()].some(
    (s) => s.fixture.team_a_id === teamId || s.fixture.team_b_id === teamId,
  );
  if (inPlayoffs && !final?.winnerId) return "In playoffs";

  const table = leagueStandings(idx, season);
  const row = table.find((r) => r.team.id === teamId);
  if (!row || row.played === 0) return null;
  return isLeagueComplete(idx, seasonId) ? ordinal(row.position) : `${ordinal(row.position)} (live)`;
}

/**
 * A season planned on the calendar: its league games have no matchday numbers, and organizers put
 * each game on a date. Seasons generated with matchdays (e.g. Season 1) keep working as before.
 */
export function isCalendarSeason(idx: LeagueIndex, seasonId: string): boolean {
  const league = idx.data.fixtures.filter((f) => f.season_id === seasonId && f.type === "official" && f.stage === "league");
  return league.length > 0 && league.every((f) => f.matchday == null);
}

/**
 * League positions before the latest matchday (or, for calendar seasons, the latest match date)
 * was played, for ▲/▼ movement arrows. Returns team id → places gained (positive) or lost
 * (negative); empty until two matchdays/dates exist.
 */
export function standingsMovement(idx: LeagueIndex, season: Season): Map<string, number> {
  const league = filterGames(idx, { seasonId: season.id, type: "official", stages: ["league"] });
  const played = league.filter((g) => g.completed);
  if (played.length === 0) return new Map();
  let before: GameView[];
  if (isCalendarSeason(idx, season.id)) {
    const day = (g: GameView) => (g.game.scheduled_at ? dateKey(g.game.scheduled_at) : "");
    const lastDate = played.map(day).sort().at(-1)!;
    before = played.filter((g) => day(g) < lastDate);
  } else {
    const lastDay = Math.max(...played.map((g) => g.fixture.matchday ?? 0));
    before = played.filter((g) => (g.fixture.matchday ?? 0) < lastDay);
  }
  if (before.length === 0) return new Map();
  const teams = seasonTeams(idx, season.id);
  const prev = new Map(computeStandings(season, teams, before).map((r) => [r.team.id, r.position]));
  const now = computeStandings(season, teams, league);
  return new Map(now.map((r) => [r.team.id, (prev.get(r.team.id) ?? r.position) - r.position]));
}
