import { describe, expect, it } from "vitest";
import { generateSchedule, playoffMapOrder, roundRobinMatchdays } from "./schedule";
import {
  buildIndex,
  computeStandings,
  filterGames,
  isCalendarSeason,
  leagueStandings,
  planPlayoffs,
  playoffSeries,
  standingsMovement,
  teamFinish,
  upNext,
} from "./league";
import { playerCareer, playerLeaderboard, rankBy, suggestPotm } from "./players";
import { buildSampleData } from "../sample-data";
import type { Fixture, Game, LeagueData, PlayerGameStat, Season, Team } from "../types";

const season: Season = {
  id: "s1",
  number: 1,
  name: "Season 1",
  status: "active",
  round_robins: 1,
  points_win: 2,
  points_loss: 0,
  tiebreak_order: ["nrr", "nkr", "h2h", "kills"],
  mvp_kill_weight: 1,
  mvp_revive_weight: 1,
};

function league(teamNames: string[]) {
  const data: LeagueData = {
    seasons: [season],
    teams: teamNames.map((n) => ({ id: n, name: n, tag: n, logo_url: null })),
    seasonTeams: teamNames.map((n) => ({ season_id: "s1", team_id: n })),
    players: [],
    aliases: [],
    rosters: [],
    maps: [{ id: "m21", name: "M21", wow_map_id: null, total_rounds: 21 }],
    seasonMaps: [{ season_id: "s1", map_id: "m21", sort_order: 0 }],
    fixtures: [],
    games: [],
    stats: [],
  };
  let n = 0;
  const game = (a: string, b: string, ra: number | null, rb: number | null, kills: [number, number] = [0, 0]) => {
    const f: Fixture = {
      id: `f${++n}`,
      season_id: "s1",
      type: "official",
      stage: "league",
      round_robin: 1,
      matchday: n,
      sort_order: n,
      team_a_id: a,
      team_b_id: b,
    };
    const g: Game = {
      id: `g${n}`,
      fixture_id: f.id,
      game_no: 1,
      map_id: "m21",
      scheduled_at: null,
      squad_size: 4,
      team_a_rounds: ra,
      team_b_rounds: rb,
      status: ra == null ? "scheduled" : "completed",
      potm_player_id: null,
    };
    data.fixtures.push(f);
    data.games.push(g);
    const stat = (team: string, k: number): PlayerGameStat => ({
      game_id: g.id,
      player_id: `${team}-p`,
      team_id: team,
      kills: k,
      revives: 0,
    });
    if (ra != null) data.stats.push(stat(a, kills[0]), stat(b, kills[1]));
  };
  return { data, game };
}

describe("roundRobinMatchdays", () => {
  it.each([4, 5, 6, 7, 8])("every pair meets exactly once with %i teams", (count) => {
    const teams = Array.from({ length: count }, (_, i) => `t${i}`);
    const days = roundRobinMatchdays(teams);
    const pairs = days.flat().map(([a, b]) => [a, b].sort().join("-"));
    expect(new Set(pairs).size).toBe((count * (count - 1)) / 2);
    expect(pairs.length).toBe((count * (count - 1)) / 2);
    for (const day of days) {
      const ids = day.flat();
      expect(new Set(ids).size).toBe(ids.length); // nobody plays twice on a matchday
    }
  });
});

describe("generateSchedule", () => {
  it("5 teams × 2 maps × 2 round robins = 40 league games + 4 playoff series", () => {
    const fixtures = generateSchedule({
      teamIds: ["a", "b", "c", "d", "e"],
      mapIds: ["m1", "m2"],
      roundRobins: 2,
    });
    const leagueFixtures = fixtures.filter((f) => f.stage === "league");
    expect(leagueFixtures.length).toBe(20);
    expect(leagueFixtures.flatMap((f) => f.games).length).toBe(40);
    expect(new Set(leagueFixtures.map((f) => f.matchday)).size).toBe(10);
    // each pairing plays both maps in every round robin
    for (const f of leagueFixtures) expect(f.games.map((g) => g.map_id).sort()).toEqual(["m1", "m2"]);
    expect(fixtures.filter((f) => f.stage !== "league").map((f) => f.stage)).toEqual([
      "qualifier_1",
      "eliminator",
      "qualifier_2",
      "final",
    ]);
  });

  it("swaps sides in the second round robin", () => {
    const fixtures = generateSchedule({ teamIds: ["a", "b", "c", "d"], mapIds: ["m1"], roundRobins: 2 });
    const rr1 = fixtures.filter((f) => f.round_robin === 1).map((f) => `${f.team_a_id}-${f.team_b_id}`);
    const rr2 = fixtures.filter((f) => f.round_robin === 2).map((f) => `${f.team_b_id}-${f.team_a_id}`);
    expect(rr2).toEqual(rr1);
  });

  it("skips playoffs with fewer than 4 teams", () => {
    const fixtures = generateSchedule({ teamIds: ["a", "b", "c"], mapIds: ["m1"], roundRobins: 1 });
    expect(fixtures.every((f) => f.stage === "league")).toBe(true);
  });
});

describe("computeStandings", () => {
  it("computes points, NRR, NKR and form", () => {
    const { data, game } = league(["A", "B"]);
    game("A", "B", 12, 9, [60, 40]);
    game("B", "A", 13, 10, [55, 50]);
    const idx = buildIndex(data);
    const table = leagueStandings(idx, season);
    const a = table.find((r) => r.team.id === "A")!;
    expect(a.played).toBe(2);
    expect(a.points).toBe(2);
    expect(a.roundsWon).toBe(22);
    expect(a.roundsLost).toBe(22);
    expect(a.nrr).toBeCloseTo(0);
    expect(a.kills).toBe(110);
    expect(a.killsConceded).toBe(95);
    expect(a.nkr).toBeCloseTo(15 / 44);
    expect(a.form).toEqual(["W", "L"]);
  });

  it("breaks points ties with NRR", () => {
    const { data, game } = league(["A", "B", "C"]);
    game("A", "B", 11, 10); // A +1
    game("B", "C", 15, 6); // B +9
    game("C", "A", 12, 9); // C +3
    const table = leagueStandings(buildIndex(data), season);
    // all on 2 pts; NRR: B (9+(-1))/40... compute order only
    expect(table.map((r) => r.points)).toEqual([2, 2, 2]);
    expect(table[0].team.id).toBe("B");
  });

  it("uses head-to-head only among the teams still tied", () => {
    const { data, game } = league(["A", "B"]);
    game("A", "B", 11, 10);
    game("B", "A", 11, 10);
    const custom = { ...season, tiebreak_order: ["h2h" as const, "kills" as const] };
    const idx = buildIndex(data);
    const teams: Team[] = data.teams;
    const table = computeStandings(custom, teams, filterGames(idx, { seasonId: "s1" }));
    // h2h equal (2 each), kills equal (0) → alphabetical fallback
    expect(table.map((r) => r.team.id)).toEqual(["A", "B"]);
  });

  it("marks qualified and eliminated teams conservatively", () => {
    const { data, game } = league(["A", "B", "C", "D", "E"]);
    // E has lost 3 and has 1 game left; four teams already have more than E can reach.
    game("A", "E", 12, 9);
    game("B", "E", 12, 9);
    game("C", "E", 12, 9);
    game("D", "B", 12, 9);
    game("A", "C", 12, 9);
    game("C", "D", 12, 9);
    game("B", "A", 12, 9);
    game("D", "A", 12, 9);
    game("D", "E", null, null);
    const table = leagueStandings(buildIndex(data), season);
    const e = table.find((r) => r.team.id === "E")!;
    expect(e.mark).toBe("E");
    expect(table.filter((r) => r.mark === "Q").length).toBeLessThanOrEqual(4);
  });
});

describe("playoffs", () => {
  it("seeds Q1/Eliminator, keeps game 3 for every series (needed only at 1–1), and advances winners", () => {
    const { data, game } = league(["A", "B", "C", "D", "E"]);
    // A > B > C > D > E by points
    const results: [string, string][] = [
      ["A", "B"], ["A", "C"], ["A", "D"], ["A", "E"],
      ["B", "C"], ["B", "D"], ["B", "E"],
      ["C", "D"], ["C", "E"],
      ["D", "E"],
    ];
    for (const [w, l] of results) game(w, l, 12, 9);
    const stages = ["qualifier_1", "eliminator", "qualifier_2", "final"] as const;
    stages.forEach((stage, i) => {
      data.fixtures.push({
        id: `p${i}`,
        season_id: "s1",
        type: "official",
        stage,
        round_robin: null,
        matchday: null,
        sort_order: 100 + i,
        team_a_id: null,
        team_b_id: null,
      });
      for (const no of [1, 2]) {
        data.games.push({
          id: `p${i}g${no}`,
          fixture_id: `p${i}`,
          game_no: no,
          map_id: "m21",
          scheduled_at: null,
          squad_size: null,
          team_a_rounds: null,
          team_b_rounds: null,
          status: "scheduled",
          potm_player_id: null,
        });
      }
    });

    const apply = () => {
      const plan = planPlayoffs(buildIndex(data), "s1");
      for (const ft of plan.fixtureTeams) {
        const f = data.fixtures.find((x) => x.id === ft.fixture_id)!;
        f.team_a_id = ft.team_a_id;
        f.team_b_id = ft.team_b_id;
      }
      for (const cg of plan.createGames) {
        data.games.push({
          id: `${cg.fixture_id}g3`,
          fixture_id: cg.fixture_id,
          game_no: 3,
          map_id: cg.map_id,
          scheduled_at: null,
          squad_size: null,
          team_a_rounds: null,
          team_b_rounds: null,
          status: "scheduled",
          potm_player_id: null,
        });
      }
      return plan;
    };
    const result = (id: string, a: number, b: number) => {
      const g = data.games.find((x) => x.id === id)!;
      g.team_a_rounds = a;
      g.team_b_rounds = b;
      g.status = "completed";
    };

    // Older schedules have only games 1–2: game 3 is added to every series.
    expect(apply().createGames).toHaveLength(4);
    expect(apply().createGames).toHaveLength(0);
    expect(buildIndex(data).viewById.get("p0g3")!.playoffNote).toBe("if_needed");
    expect(data.fixtures.find((f) => f.id === "p0")).toMatchObject({ team_a_id: "A", team_b_id: "B" });
    expect(data.fixtures.find((f) => f.id === "p1")).toMatchObject({ team_a_id: "C", team_b_id: "D" });

    // Q1: A wins game 1, B wins game 2 → game 3 is the decider
    result("p0g1", 12, 9);
    result("p0g2", 9, 12);
    expect(buildIndex(data).viewById.get("p0g3")!.playoffNote).toBeNull();
    result("p0g3", 9, 12); // B wins Q1 2–1
    // Eliminator: C wins 2–0, so game 3 isn't needed (and isn't up next)
    result("p1g1", 12, 9);
    result("p1g2", 12, 9);
    apply();
    const mid = buildIndex(data);
    expect(mid.viewById.get("p1g3")!.playoffNote).toBe("not_needed");
    expect(upNext(filterGames(mid, { seasonId: "s1" }), 10).map((v) => v.game.id)).not.toContain("p1g3");
    expect(data.fixtures.find((f) => f.id === "p2")).toMatchObject({ team_a_id: "A", team_b_id: "C" });
    expect(data.fixtures.find((f) => f.id === "p3")).toMatchObject({ team_a_id: "B", team_b_id: null });

    result("p2g1", 9, 12);
    result("p2g2", 9, 12); // C wins Q2
    apply();
    expect(data.fixtures.find((f) => f.id === "p3")).toMatchObject({ team_a_id: "B", team_b_id: "C" });
    result("p3g1", 12, 9);
    result("p3g2", 12, 9);
    apply();

    const idx = buildIndex(data);
    expect(playoffSeries(idx, "s1").get("final")!.winnerId).toBe("B");
    expect(teamFinish(idx, "s1", "B")).toBe("Champion");
    expect(teamFinish(idx, "s1", "C")).toBe("Runner-up");
    expect(teamFinish(idx, "s1", "A")).toBe("3rd");
    expect(teamFinish(idx, "s1", "D")).toBe("4th");
    expect(teamFinish(idx, "s1", "E")).toBe("5th");
  });
});

describe("players", () => {
  it("suggests the top MVP score on the winning side", () => {
    expect(
      suggestPotm(season, [
        { player_id: "x", kills: 10, revives: 0 },
        { player_id: "y", kills: 8, revives: 4 },
      ]),
    ).toBe("y");
  });

  it("sample data: careers follow players across teams and seasons", () => {
    const data = buildSampleData();
    const idx = buildIndex(data);
    // "Kairo" (index 4 in the IGN list) stayed at CV; "Blitz" (index 3) moved CV → BLZ in S2.
    const blitz = data.players.find((p) => p.ign === "Blitz")!;
    const career = playerCareer(idx, blitz.id, "official")!;
    const teamsBySeason = career.seasons.map((s) => [s.season.number, s.teams.map((t) => t.tag)]);
    expect(teamsBySeason).toEqual([
      [2, ["BLZ"]],
      [1, ["CV"]],
    ]);
    // every logged stat belongs to the team recorded for that game
    for (const row of career.log) expect(row.team?.id).toBe(row.stat.team_id);

    const s1 = data.seasons.find((s) => s.number === 1)!;
    const s1Final = playoffSeries(idx, s1.id).get("final")!;
    expect(s1Final.winnerId).not.toBeNull();

    const board = playerLeaderboard(idx, filterGames(idx, { seasonId: s1.id, type: "official" }));
    expect(rankBy(board, "kills")[0].kills).toBeGreaterThan(0);
  });
});

describe("calendar-planned seasons", () => {
  it("generates fixtures without matchdays but keeps the balanced order", () => {
    const fx = generateSchedule({ teamIds: ["A", "B", "C", "D"], mapIds: ["m1", "m2"], roundRobins: 1, matchdays: false });
    const league = fx.filter((f) => f.stage === "league");
    expect(league).toHaveLength(6);
    expect(league.every((f) => f.matchday === null)).toBe(true);
    expect(league.map((f) => f.sort_order)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(league.flatMap((f) => f.games)).toHaveLength(12);
  });

  it("orders games by date (unscheduled last) and numbers matches in that order", () => {
    const { data, game } = league(["A", "B", "C"]);
    game("A", "B", null, null);
    game("A", "C", null, null);
    game("B", "C", null, null);
    for (const f of data.fixtures) f.matchday = null;
    data.games[0].scheduled_at = null;
    data.games[1].scheduled_at = "2026-11-08T14:00:00Z";
    data.games[2].scheduled_at = "2026-11-07T14:00:00Z";
    const idx = buildIndex(data);
    expect(isCalendarSeason(idx, "s1")).toBe(true);
    expect(filterGames(idx, { seasonId: "s1" }).map((v) => `${v.label}:${v.game.id}`)).toEqual(["Match 1:g3", "Match 2:g2", "Match 3:g1"]);
  });

  it("movement compares with the table before the latest match date", () => {
    const { data, game } = league(["A", "B", "C"]);
    game("B", "C", 11, 5); // day 1: B top
    game("A", "C", 11, 3); // day 2
    game("A", "B", 11, 2); // day 2: A goes top
    for (const f of data.fixtures) f.matchday = null;
    data.games[0].scheduled_at = "2026-11-07T14:00:00Z";
    data.games[1].scheduled_at = "2026-11-08T14:00:00Z";
    data.games[2].scheduled_at = "2026-11-08T15:00:00Z";
    const move = standingsMovement(buildIndex(data), season);
    expect(move.get("A")).toBeGreaterThan(0);
    expect(move.get("B")).toBeLessThan(0);
  });

  it("matchday seasons are not calendar seasons", () => {
    const { data, game } = league(["A", "B"]);
    game("A", "B", null, null);
    expect(isCalendarSeason(buildIndex(data), "s1")).toBe(false);
  });
});

describe("playoff maps", () => {
  it("defaults to the longest maps first: 23, 21, then 19 rounds", () => {
    const pool = [
      { id: "cr21", total_rounds: 21 },
      { id: "rr19a", total_rounds: 19 },
      { id: "cr23", total_rounds: 23 },
      { id: "rr19b", total_rounds: 19 },
    ];
    expect(playoffMapOrder(pool)).toEqual(["cr23", "cr21", "rr19a"]);
    expect(playoffMapOrder([{ id: "only", total_rounds: 21 }])).toEqual(["only", "only", "only"]);
    const fx = generateSchedule({ teamIds: ["A", "B", "C", "D"], mapIds: ["cr21", "rr19a"], roundRobins: 1, playoffMapIds: playoffMapOrder(pool) });
    const q1 = fx.find((f) => f.stage === "qualifier_1")!;
    expect(q1.games.map((g) => `${g.game_no}:${g.map_id}`)).toEqual(["1:cr23", "2:cr21", "3:rr19a"]);
  });
});
