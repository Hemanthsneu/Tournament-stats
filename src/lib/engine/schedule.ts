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
 * Default maps for a best-of-3 playoff series: longest map first (e.g. 23, 21, then 19 rounds),
 * one map per distinct round count, topped up from the pool when there are fewer than three.
 */
export function playoffMapOrder(maps: { id: string; total_rounds: number }[]): string[] {
  if (!maps.length) return [];
  const byRounds = [...maps].sort((a, b) => b.total_rounds - a.total_rounds);
  const picked: string[] = [];
  const seen = new Set<number>();
  for (const m of byRounds) {
    if (seen.has(m.total_rounds)) continue;
    seen.add(m.total_rounds);
    picked.push(m.id);
  }
  for (const m of maps) if (picked.length < 3 && !picked.includes(m.id)) picked.push(m.id);
  while (picked.length < 3) picked.push(picked[picked.length % maps.length]);
  return picked.slice(0, 3);
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
  /** Maps for playoff games 1–3 (see playoffMapOrder); defaults to the first pool maps. */
  playoffMapIds?: string[];
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
    // Best of 3: all three games exist up front; game 3 is only played if the series is 1–1.
    const seriesMaps = opts.playoffMapIds?.length ? opts.playoffMapIds.slice(0, 3) : [mapIds[0], mapIds[1] ?? mapIds[0], mapIds[2] ?? mapIds[0]];
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
