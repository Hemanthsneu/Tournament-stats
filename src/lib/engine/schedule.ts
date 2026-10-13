import { PLAYOFF_STAGES, type Stage } from "../types";

export interface PlannedGame {
  game_no: number;
  map_id: string | null;
}

export interface PlannedFixture {
  stage: Stage;
  round_robin: number | null;
  matchday: number | null;
  sort_order: number;
  team_a_id: string | null;
  team_b_id: string | null;
  games: PlannedGame[];
}

/**
 * Circle-method round robin. Returns one list of pairings per matchday; every pair meets exactly once.
 * With an odd team count a phantom "bye" slot is added, so one team rests each matchday.
 */
export function roundRobinMatchdays(teamIds: string[]): [string, string][][] {
  if (teamIds.length < 2) return [];
  const slots: (string | null)[] = [...teamIds];
  if (slots.length % 2 === 1) slots.push(null);
  const n = slots.length;
  const matchdays: [string, string][][] = [];

  for (let round = 0; round < n - 1; round++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = slots[i];
      const b = slots[n - 1 - i];
      if (a && b) pairs.push(round % 2 === 0 ? [a, b] : [b, a]);
    }
    matchdays.push(pairs);
    // Keep slot 0 fixed, rotate the rest by one.
    slots.splice(1, 0, slots.pop()!);
  }
  return matchdays;
}

/**
 * Builds the full official schedule: every pair plays every map once per round robin, plus empty
 * best-of-3 playoff series (teams filled in later by planPlayoffs). With `matchdays: false` the
 * fixtures carry no matchday numbers (organizers place each game on a date themselves); the
 * balanced round-robin order is kept as the suggested order.
 */
export function generateSchedule(opts: {
  teamIds: string[];
  mapIds: string[];
  roundRobins: number;
  matchdays?: boolean;
}): PlannedFixture[] {
  const { teamIds, mapIds, roundRobins, matchdays: withMatchdays = true } = opts;
  if (teamIds.length < 2) throw new Error("Add at least 2 teams to the season first.");
  if (mapIds.length < 1) throw new Error("Add at least 1 map to the season first.");
  if (roundRobins < 1 || roundRobins > 3) throw new Error("Round robins must be 1, 2 or 3.");

  const base = roundRobinMatchdays(teamIds);
  const fixtures: PlannedFixture[] = [];
  let matchday = 0;
  let sortOrder = 0;

  for (let rr = 1; rr <= roundRobins; rr++) {
    base.forEach((pairs, dayIndex) => {
      matchday++;
      // Rotate map order per matchday and per round robin so nobody always opens on the same map.
      const offset = (rr - 1 + dayIndex) % mapIds.length;
      const mapOrder = [...mapIds.slice(offset), ...mapIds.slice(0, offset)];
      for (const [home, away] of pairs) {
        const [a, b] = rr % 2 === 1 ? [home, away] : [away, home];
        fixtures.push({
          stage: "league",
          round_robin: rr,
          matchday: withMatchdays ? matchday : null,
          sort_order: sortOrder++,
          team_a_id: a,
          team_b_id: b,
          games: mapOrder.map((mapId, i) => ({ game_no: i + 1, map_id: mapId })),
        });
      }
    });
  }

  if (teamIds.length >= 4) {
    const seriesMaps = [mapIds[0], mapIds[1] ?? mapIds[0]];
    for (const stage of PLAYOFF_STAGES) {
      fixtures.push({
        stage,
        round_robin: null,
        matchday: null,
        sort_order: sortOrder++,
        team_a_id: null,
        team_b_id: null,
        games: seriesMaps.map((mapId, i) => ({ game_no: i + 1, map_id: mapId })),
      });
    }
  }

  return fixtures;
}
