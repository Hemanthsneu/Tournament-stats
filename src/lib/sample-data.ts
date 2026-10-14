// Deterministic demo league used when Supabase is not configured (and by `npm run db:demo`).
// Season 1: 5 teams, 2 round robins, full IPL playoffs. Season 2: 6 teams, 1 round robin, in progress,
// with transfers between seasons, one mid-season transfer and one IGN change.

import { generateSchedule } from "./engine/schedule";
import { buildIndex, planPlayoffs } from "./engine/league";
import { suggestPotm } from "./engine/players";
import type {
  Fixture,
  Game,
  GameMap,
  LeagueData,
  Player,
  PlayerGameStat,
  RosterEntry,
  Season,
  Team,
} from "./types";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const IGNS = [
  "Zenith", "Vortex", "Raze", "Blitz", "Kairo", "Nyx", "Hawk", "Shadow", "Viper", "Frost",
  "Jolt", "Onyx", "Rogue", "Titan", "Echo", "Pulse", "Drift", "Fang", "Nova", "Ghost",
  "Rex", "Sage", "Brisk", "Crux", "Duke", "Ember", "Flick", "Grit", "Haze", "Ivy",
  "Jinx", "Karma", "Lynx", "Mako", "Neon", "Orbit", "Pyro", "Quake", "Rift", "Sonic",
  "Tusk", "Umbra", "Volt", "Wisp", "Xeno",
];

const TEAMS: [string, string, number][] = [
  ["Crimson Vipers", "CV", 1.25],
  ["Night Owls", "NOWL", 1.1],
  ["Iron Wolves", "IW", 1.0],
  ["Storm Riders", "SR", 0.95],
  ["Phantom Squad", "PS", 0.85],
  ["Blaze Esports", "BLZ", 1.05],
];

const istIso = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`).toISOString();

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function buildSampleData(): LeagueData {
  let counter = 0;
  const uid = () => `00000000-0000-4000-8000-${(++counter).toString(16).padStart(12, "0")}`;
  const rand = mulberry32(20260926);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

  const data: LeagueData = {
    seasons: [],
    teams: [],
    seasonTeams: [],
    players: [],
    aliases: [],
    rosters: [],
    maps: [],
    seasonMaps: [],
    fixtures: [],
    games: [],
    stats: [],
  };

  const strength = new Map<string, number>();
  const teams: Team[] = TEAMS.map(([name, tag, s]) => {
    const t = { id: uid(), name, tag, logo_url: null };
    strength.set(t.id, s);
    return t;
  });
  data.teams = teams;

  const skill = new Map<string, { kill: number; support: number }>();
  const players: Player[] = IGNS.map((ign, i) => {
    const p = { id: uid(), ign, bgmi_uid: String(5100000000 + i * 7919), real_name: null, photo_url: null };
    skill.set(p.id, { kill: 0.6 + rand(), support: 0.4 + rand() * 1.2 });
    return p;
  });
  data.players = players;

  // Player 5 changed IGN from "Nyx" to "NyxOP" before Season 2.
  data.aliases.push({ id: uid(), player_id: players[5].id, ign: "Nyx", changed_on: "2026-09-01" });
  players[5].ign = "NyxOP";

  const makeSeason = (number: number, status: Season["status"], roundRobins: number): Season => {
    const s: Season = {
      id: uid(),
      number,
      name: `Season ${number}`,
      status,
      round_robins: roundRobins,
      points_win: 2,
      points_loss: 0,
      tiebreak_order: ["nrr", "nkr", "h2h", "kills"],
      mvp_kill_weight: 1,
      mvp_revive_weight: 1,
    };
    data.seasons.push(s);
    return s;
  };

  const makeMaps = (season: Season, maps: [string, string, number][]) =>
    maps.map(([name, wowId, rounds], i) => {
      const m: GameMap = { id: uid(), name, wow_map_id: wowId, total_rounds: rounds };
      data.maps.push(m);
      data.seasonMaps.push({ season_id: season.id, map_id: m.id, sort_order: i });
      return m;
    });

  const roster = (season: Season, team: Team, playerIdx: number[], joined: string, left: string | null = null) => {
    for (const i of playerIdx) {
      const entry: RosterEntry = {
        id: uid(),
        season_id: season.id,
        team_id: team.id,
        player_id: players[i].id,
        joined_on: joined,
        left_on: left,
      };
      data.rosters.push(entry);
    }
  };

  const activeRoster = (season: Season, teamId: string, date: string) =>
    data.rosters
      .filter(
        (r) =>
          r.season_id === season.id &&
          r.team_id === teamId &&
          r.joined_on <= date &&
          (!r.left_on || r.left_on > date),
      )
      .map((r) => r.player_id);

  const distribute = (ids: string[], total: number, weight: (id: string) => number, out: Map<string, number>) => {
    const weights = ids.map(weight);
    const sumW = weights.reduce((a, b) => a + b, 0);
    for (let k = 0; k < total; k++) {
      let r = rand() * sumW;
      let i = 0;
      while (r > weights[i] && i < ids.length - 1) r -= weights[i++];
      out.set(ids[i], (out.get(ids[i]) ?? 0) + 1);
    }
  };

  const playGame = (season: Season, fixture: Fixture, game: Game) => {
    const map = data.maps.find((m) => m.id === game.map_id)!;
    const date = (game.scheduled_at ?? new Date().toISOString()).slice(0, 10);
    const rosterA = activeRoster(season, fixture.team_a_id!, date);
    const rosterB = activeRoster(season, fixture.team_b_id!, date);
    const squad = Math.min(pick([4, 4, 5, 5, 6]), rosterA.length, rosterB.length);
    const sideA = [...rosterA].sort(() => rand() - 0.5).slice(0, squad);
    const sideB = [...rosterB].sort(() => rand() - 0.5).slice(0, squad);
    const sA = strength.get(fixture.team_a_id!)!;
    const sB = strength.get(fixture.team_b_id!)!;

    let roundsA = 0;
    let roundsB = 0;
    const kills = new Map<string, number>();
    const revives = new Map<string, number>();
    const killW = (id: string) => skill.get(id)!.kill;
    const supW = (id: string) => skill.get(id)!.support;
    for (let r = 0; r < map.total_rounds; r++) {
      const aWins = rand() < sA / (sA + sB);
      if (aWins) roundsA++;
      else roundsB++;
      const [winSide, loseSide] = aWins ? [sideA, sideB] : [sideB, sideA];
      distribute(winSide, squad, killW, kills);
      distribute(loseSide, Math.floor(rand() * squad), killW, kills);
      if (rand() < 0.45) distribute(winSide, 1 + Math.floor(rand() * 2), supW, revives);
      if (rand() < 0.3) distribute(loseSide, 1, supW, revives);
    }

    const statsFor = (ids: string[], teamId: string): PlayerGameStat[] =>
      ids.map((id) => ({
        game_id: game.id,
        player_id: id,
        team_id: teamId,
        kills: kills.get(id) ?? 0,
        revives: revives.get(id) ?? 0,
      }));
    const statsA = statsFor(sideA, fixture.team_a_id!);
    const statsB = statsFor(sideB, fixture.team_b_id!);
    data.stats.push(...statsA, ...statsB);

    game.status = "completed";
    game.squad_size = squad;
    game.team_a_rounds = roundsA;
    game.team_b_rounds = roundsB;
    game.potm_player_id =
      fixture.type === "official" ? suggestPotm(season, roundsA > roundsB ? statsA : statsB) : null;
  };

  const buildSchedule = (
    season: Season,
    seasonTeamList: Team[],
    maps: GameMap[],
    startDate: string,
    slots: string[],
    daysBetween: number,
  ) => {
    for (const t of seasonTeamList) data.seasonTeams.push({ season_id: season.id, team_id: t.id });
    const planned = generateSchedule({
      teamIds: seasonTeamList.map((t) => t.id),
      mapIds: maps.map((m) => m.id),
      roundRobins: season.round_robins,
    });
    let lastLeagueDate = startDate;
    for (const pf of planned) {
      const fixture: Fixture = {
        id: uid(),
        season_id: season.id,
        type: "official",
        stage: pf.stage,
        round_robin: pf.round_robin,
        matchday: pf.matchday,
        sort_order: pf.sort_order,
        team_a_id: pf.team_a_id,
        team_b_id: pf.team_b_id,
      };
      data.fixtures.push(fixture);
      for (const pg of pf.games) {
        data.games.push({
          id: uid(),
          fixture_id: fixture.id,
          game_no: pg.game_no,
          map_id: pg.map_id,
          scheduled_at: null,
          squad_size: null,
          team_a_rounds: null,
          team_b_rounds: null,
          status: "scheduled",
          potm_player_id: null,
        });
      }
    }
    // Times: one matchday per date, games in the given slots.
    const leagueFixtures = data.fixtures.filter((f) => f.season_id === season.id && f.stage === "league");
    const byDay = new Map<number, Fixture[]>();
    for (const f of leagueFixtures) byDay.set(f.matchday!, [...(byDay.get(f.matchday!) ?? []), f]);
    for (const [day, fixtures] of byDay) {
      const date = addDays(startDate, (day - 1) * daysBetween);
      lastLeagueDate = date;
      let slot = 0;
      for (const f of fixtures.sort((a, b) => a.sort_order - b.sort_order)) {
        for (const g of data.games.filter((g) => g.fixture_id === f.id).sort((a, b) => a.game_no - b.game_no)) {
          g.scheduled_at = istIso(date, slots[slot++ % slots.length]);
        }
      }
    }
    // Playoffs: one series per day after the league.
    const playoffDates = { qualifier_1: 2, eliminator: 3, qualifier_2: 5, final: 7 } as const;
    for (const f of data.fixtures.filter((f) => f.season_id === season.id && f.stage !== "league")) {
      const date = addDays(lastLeagueDate, playoffDates[f.stage as keyof typeof playoffDates]);
      data.games
        .filter((g) => g.fixture_id === f.id)
        .forEach((g) => (g.scheduled_at = istIso(date, ["20:00", "20:45", "21:30"][g.game_no - 1])));
    }
  };

  const orderedSeasonGames = (season: Season) =>
    buildIndex(data)
      .views.filter((v) => v.season.id === season.id && v.fixture.type === "official")
      .map((v) => v.game);

  const runPlayoffs = (season: Season) => {
    for (let guard = 0; guard < 20; guard++) {
      const plan = planPlayoffs(buildIndex(data), season.id);
      for (const ft of plan.fixtureTeams) {
        const f = data.fixtures.find((x) => x.id === ft.fixture_id)!;
        f.team_a_id = ft.team_a_id;
        f.team_b_id = ft.team_b_id;
      }
      for (const cg of plan.createGames) {
        const g2 = data.games.find((g) => g.fixture_id === cg.fixture_id && g.game_no === 2)!;
        data.games.push({
          id: uid(),
          fixture_id: cg.fixture_id,
          game_no: 3,
          map_id: cg.map_id,
          scheduled_at: new Date(new Date(g2.scheduled_at!).getTime() + 45 * 60000).toISOString(),
          squad_size: null,
          team_a_rounds: null,
          team_b_rounds: null,
          status: "scheduled",
          potm_player_id: null,
        });
      }
      // Skip game 3 of a series already won 2–0.
      const decided = (fixtureId: string) => {
        const won = data.games
          .filter((g) => g.fixture_id === fixtureId && g.status === "completed")
          .map((g) => ((g.team_a_rounds ?? 0) > (g.team_b_rounds ?? 0) ? "a" : "b"));
        return won.filter((w) => w === "a").length >= 2 || won.filter((w) => w === "b").length >= 2;
      };
      const next = orderedSeasonGames(season).find((g) => {
        const f = data.fixtures.find((x) => x.id === g.fixture_id)!;
        return g.status !== "completed" && f.team_a_id && f.team_b_id && !decided(f.id);
      });
      if (!next) break;
      playGame(season, data.fixtures.find((x) => x.id === next.fixture_id)!, next);
    }
  };

  const addPractice = (season: Season, teamPool: Team[], maps: GameMap[], dates: string[]) => {
    dates.forEach((date, i) => {
      const [a, b] = [...teamPool].sort(() => rand() - 0.5);
      const fixture: Fixture = {
        id: uid(),
        season_id: season.id,
        type: "practice",
        stage: "practice",
        round_robin: null,
        matchday: null,
        sort_order: i,
        team_a_id: a.id,
        team_b_id: b.id,
      };
      data.fixtures.push(fixture);
      const gameCount = i % 3 === 0 ? 1 : 2;
      for (let n = 1; n <= gameCount; n++) {
        const game: Game = {
          id: uid(),
          fixture_id: fixture.id,
          game_no: n,
          map_id: maps[(i + n) % maps.length].id,
          scheduled_at: istIso(date, n === 1 ? "18:00" : "18:45"),
          squad_size: null,
          team_a_rounds: null,
          team_b_rounds: null,
          status: "scheduled",
          potm_player_id: null,
        };
        data.games.push(game);
        playGame(season, fixture, game);
      }
    });
  };

  // ---------------- Season 1 (completed) ----------------
  const s1 = makeSeason(1, "completed", 2);
  const s1Maps = makeMaps(s1, [
    ["Crossfire Yard", "21874523", 21],
    ["Dust Arena", "23419087", 23],
  ]);
  const s1Teams = teams.slice(0, 5);
  s1Teams.forEach((t, ti) => roster(s1, t, [0, 1, 2, 3, 4, 5, 6].map((k) => ti * 7 + k), "2026-05-20"));
  buildSchedule(s1, s1Teams, s1Maps, "2026-06-01", ["20:00", "20:45", "21:30", "22:15"], 2);
  addPractice(s1, s1Teams, s1Maps, ["2026-05-24", "2026-05-25", "2026-05-27", "2026-05-28", "2026-05-30", "2026-06-06"]);
  for (const g of orderedSeasonGames(s1)) {
    const f = data.fixtures.find((x) => x.id === g.fixture_id)!;
    if (f.stage === "league") playGame(s1, f, g);
  }
  runPlayoffs(s1);

  // ---------------- Season 2 (in progress) ----------------
  const s2 = makeSeason(2, "active", 1);
  const s2Maps = makeMaps(s2, [
    ["Neon Rooftops", "21990412", 21],
    ["Frozen Depot", "23055671", 23],
  ]);
  const joined = "2026-09-10";
  // Transfers between seasons: 3 CV→BLZ, 10 NOWL→IW, 17 IW→SR, 26 SR→NOWL; 34 (PS) left the league.
  roster(s2, teams[0], [0, 1, 2, 4, 5, 6], joined);
  roster(s2, teams[1], [7, 8, 9, 11, 12, 13, 26], joined);
  roster(s2, teams[2], [10, 14, 15, 16, 18, 19], joined);
  roster(s2, teams[3], [17, 21, 22, 23, 24, 25, 27], joined);
  roster(s2, teams[4], [28, 29, 30, 31, 32, 33], joined);
  roster(s2, teams[5], [3, 35, 36, 37, 38, 39, 40], joined);
  // Mid-season transfer: player 20 starts at Iron Wolves, moves to Phantom Squad on 2026-09-25.
  roster(s2, teams[2], [20], joined, "2026-09-25");
  roster(s2, teams[4], [20], "2026-09-25");
  buildSchedule(s2, teams, s2Maps, "2026-09-20", ["19:00", "19:40", "20:20", "21:00", "21:40", "22:20"], 2);
  addPractice(s2, teams, s2Maps, ["2026-09-14", "2026-09-15", "2026-09-17", "2026-09-26"]);
  const s2League = orderedSeasonGames(s2).filter(
    (g) => data.fixtures.find((x) => x.id === g.fixture_id)!.stage === "league",
  );
  for (const g of s2League.slice(0, 18)) playGame(s2, data.fixtures.find((x) => x.id === g.fixture_id)!, g);

  return data;
}
