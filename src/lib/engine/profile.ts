// A player's scouting card: ratings against the rest of the league, recent form and personal highlights.
// Official games only; pure functions over the league index.
import type { GameMap, Player, Team } from "../types";
import { filterGames, type LeagueIndex } from "./league";
import { CARRY_SHARE, playerCareer, playerLeaderboard, teamKillsFor, type PlayerAgg } from "./players";

/** Players need this many official games to be rated (and to count in the comparison pool). */
export const RATED_GAMES = 5;

export interface Rating {
  key: "fragging" | "contribution" | "winner" | "consistency" | "carry" | "experience";
  label: string;
  /** 40–99, from where the player sits in the league. */
  value: number;
  detail: string;
}

export interface FormGame {
  gameId: string;
  label: string;
  kills: number;
  won: boolean;
  opponent: Team | null;
}

export interface ScoutReport {
  overall: number | null;
  ratings: Rating[];
  /** Last 10 official games, oldest first. */
  form: FormGame[];
  formAvg: number;
  careerAvg: number;
  bestGame: { gameId: string; kills: number; label: string; opponent: Team | null } | null;
  bestMap: { map: GameMap; games: number; avg: number } | null;
  favouriteOpponent: { team: Team; games: number; avg: number } | null;
  bestPartner: { player: Player; games: number; wins: number } | null;
  longestWinStreak: number;
  carries: number;
}

const WEIGHTS: Record<Rating["key"], number> = { fragging: 0.3, contribution: 0.2, winner: 0.15, consistency: 0.15, carry: 0.1, experience: 0.1 };

/** Share of the pool below `v` (ties count half), 0..1. */
function percentile(pool: number[], v: number): number {
  if (pool.length <= 1) return 1;
  let below = 0;
  let equal = 0;
  for (const x of pool) {
    if (x < v) below++;
    else if (x === v) equal++;
  }
  return Math.min(1, Math.max(0, (below + (equal - 1) / 2) / (pool.length - 1)));
}
const toRating = (p: number) => Math.round(40 + p * 59);

/** Coefficient of variation of per-game kills (lower = steadier). */
function spread(kills: number[]): number {
  if (kills.length < 2) return 0;
  const mean = kills.reduce((a, b) => a + b, 0) / kills.length;
  if (mean === 0) return 0;
  const variance = kills.reduce((a, k) => a + (k - mean) ** 2, 0) / kills.length;
  return Math.sqrt(variance) / mean;
}

export function scoutReport(idx: LeagueIndex, playerId: string): ScoutReport | null {
  const career = playerCareer(idx, playerId, "official");
  if (!career) return null;
  const games = filterGames(idx, { type: "official" }).filter((g) => g.completed);
  const board = playerLeaderboard(idx, games);
  const me = board.find((r) => r.player.id === playerId);
  const log = career.log.filter((r) => r.view.completed); // newest first
  const ordered = [...log].reverse();

  // ---- ratings
  const killsByPlayer = new Map<string, number[]>();
  for (const g of games) for (const s of [...g.statsA, ...g.statsB]) killsByPlayer.set(s.player_id, [...(killsByPlayer.get(s.player_id) ?? []), s.kills]);
  const pool = board.filter((r) => r.games >= RATED_GAMES);
  const metric: Record<Rating["key"], (r: PlayerAgg) => number> = {
    fragging: (r) => r.avgKills,
    contribution: (r) => r.share,
    winner: (r) => r.winShare,
    consistency: (r) => -spread(killsByPlayer.get(r.player.id) ?? []),
    carry: (r) => (r.games ? r.carries / r.games : 0),
    experience: (r) => r.games,
  };
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const detail: Record<Rating["key"], (r: PlayerAgg) => string> = {
    fragging: (r) => `${r.avgKills.toFixed(1)} kills a game`,
    contribution: (r) => `${pct(r.share)} of team kills`,
    winner: (r) => (r.wins ? `${pct(r.winShare)} of kills in wins` : "No wins yet"),
    consistency: (r) => `±${Math.round(spread(killsByPlayer.get(r.player.id) ?? []) * 100)}% game to game`,
    carry: (r) => `${r.carries} carry game${r.carries === 1 ? "" : "s"}`,
    experience: (r) => `${r.games} official games`,
  };
  const LABELS: Record<Rating["key"], string> = { fragging: "Fragging", contribution: "Contribution", winner: "Match winner", consistency: "Consistency", carry: "Carry", experience: "Experience" };
  const rated = !!me && me.games >= RATED_GAMES;
  const ratings: Rating[] = rated
    ? (Object.keys(WEIGHTS) as Rating["key"][]).map((key) => ({
        key,
        label: LABELS[key],
        value: toRating(percentile(pool.map(metric[key]), metric[key](me))),
        detail: detail[key](me),
      }))
    : [];
  const overall = rated ? Math.round(ratings.reduce((a, r) => a + r.value * WEIGHTS[r.key], 0)) : null;

  // ---- form
  const form = log.slice(0, 10).reverse().map((r) => ({ gameId: r.view.game.id, label: `S${r.view.season.number} · ${r.view.label}`, kills: r.stat.kills, won: r.won, opponent: r.opponent }));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  // ---- highlights
  const best = [...log].sort((a, b) => b.stat.kills - a.stat.kills)[0];
  const group = <K,>(key: (r: (typeof log)[number]) => K | null) => {
    const m = new Map<K, { games: number; kills: number }>();
    for (const r of log) {
      const k = key(r);
      if (k == null) continue;
      const e = m.get(k) ?? { games: 0, kills: 0 };
      e.games++;
      e.kills += r.stat.kills;
      m.set(k, e);
    }
    return [...m.entries()].filter(([, e]) => e.games >= 3).sort((a, b) => b[1].kills / b[1].games - a[1].kills / a[1].games || b[1].games - a[1].games)[0];
  };
  const map = group((r) => r.view.map);
  const opp = group((r) => r.opponent);

  const partners = new Map<string, { games: number; wins: number }>();
  for (const r of log) {
    const mates = r.stat.team_id === r.view.fixture.team_a_id ? r.view.statsA : r.view.statsB;
    for (const m of mates) {
      if (m.player_id === playerId) continue;
      const e = partners.get(m.player_id) ?? { games: 0, wins: 0 };
      e.games++;
      if (r.won) e.wins++;
      partners.set(m.player_id, e);
    }
  }
  const partner = [...partners.entries()].filter(([, e]) => e.games >= 5).sort((a, b) => b[1].wins / b[1].games - a[1].wins / a[1].games || b[1].games - a[1].games)[0];

  let run = 0;
  let longestWinStreak = 0;
  for (const r of ordered) {
    run = r.won ? run + 1 : 0;
    longestWinStreak = Math.max(longestWinStreak, run);
  }
  const carries = log.filter((r) => {
    const tk = teamKillsFor(r.view, r.stat.team_id);
    const mates = (r.stat.team_id === r.view.fixture.team_a_id ? r.view.statsA : r.view.statsB).length;
    return tk > 0 && mates >= 2 && r.stat.kills / tk >= CARRY_SHARE;
  }).length;

  return {
    overall,
    ratings,
    form,
    formAvg: avg(form.map((f) => f.kills)),
    careerAvg: avg(log.map((r) => r.stat.kills)),
    bestGame: best ? { gameId: best.view.game.id, kills: best.stat.kills, label: `S${best.view.season.number} · ${best.view.label}`, opponent: best.opponent } : null,
    bestMap: map ? { map: map[0], games: map[1].games, avg: map[1].kills / map[1].games } : null,
    favouriteOpponent: opp ? { team: opp[0], games: opp[1].games, avg: opp[1].kills / opp[1].games } : null,
    bestPartner: partner && idx.playerById.get(partner[0]) ? { player: idx.playerById.get(partner[0])!, games: partner[1].games, wins: partner[1].wins } : null,
    longestWinStreak,
    carries,
  };
}
