// Story stats from finished games: last-round thrillers, upsets, carries, clutch records, streaks.
// Pure functions over GameViews, so the same code serves a season or every season ("all-time").
import type { GameMap, Player, Team } from "../types";
import type { GameView, LeagueIndex } from "./league";
import { teamKillsFor } from "./players";

export interface GameStory {
  view: GameView;
  winner: Team;
  loser: Team;
  winnerRounds: number;
  loserRounds: number;
  margin: number;
  winnerKills: number;
  loserKills: number;
  totalKills: number;
}

function stories(games: GameView[]): GameStory[] {
  return games
    .filter((v) => v.completed && v.teamA && v.teamB)
    .map((v) => {
      const aWon = v.winnerId === v.teamA!.id;
      const ra = v.game.team_a_rounds!;
      const rb = v.game.team_b_rounds!;
      return {
        view: v,
        winner: aWon ? v.teamA! : v.teamB!,
        loser: aWon ? v.teamB! : v.teamA!,
        winnerRounds: aWon ? ra : rb,
        loserRounds: aWon ? rb : ra,
        margin: Math.abs(ra - rb),
        winnerKills: aWon ? v.killsA : v.killsB,
        loserKills: aWon ? v.killsB : v.killsA,
        totalKills: v.killsA + v.killsB,
      };
    });
}

const newestFirst = (a: GameStory, b: GameStory) => (b.view.game.scheduled_at ?? "").localeCompare(a.view.game.scheduled_at ?? "");

export interface MatchStories {
  played: number;
  /** Won by a single round: went to the very last round. */
  thrillers: GameStory[];
  /** Won despite fewer kills than the losers. */
  upsets: GameStory[];
  /** Largest round margins. */
  blowouts: GameStory[];
  /** Most kills in one game, both teams together. */
  bloodbaths: GameStory[];
}

export function matchStories(games: GameView[], limit = 6): MatchStories {
  const all = stories(games);
  return {
    played: all.length,
    thrillers: all.filter((s) => s.margin === 1).sort(newestFirst),
    upsets: all.filter((s) => s.winnerKills < s.loserKills).sort((a, b) => b.loserKills - b.winnerKills - (a.loserKills - a.winnerKills)),
    blowouts: [...all].sort((a, b) => b.margin - a.margin || b.winnerKills - b.loserKills - (a.winnerKills - a.loserKills)).slice(0, limit),
    bloodbaths: [...all].sort((a, b) => b.totalKills - a.totalKills).slice(0, limit),
  };
}

export interface Carry {
  player: Player;
  team: Team | null;
  view: GameView;
  kills: number;
  teamKills: number;
  share: number;
  won: boolean;
}

/** Biggest single-game shares of a team's kills. */
export function carryJobs(idx: LeagueIndex, games: GameView[], limit = 6): Carry[] {
  const out: Carry[] = [];
  for (const v of games) {
    if (!v.completed) continue;
    for (const s of [...v.statsA, ...v.statsB]) {
      const player = idx.playerById.get(s.player_id);
      const tk = teamKillsFor(v, s.team_id);
      // A carry needs teammates on the scoresheet (a lone recorded player is always 100%).
      const mates = (s.team_id === v.fixture.team_a_id ? v.statsA : v.statsB).length;
      if (!player || tk < 10 || mates < 2) continue;
      out.push({ player, team: idx.teamById.get(s.team_id) ?? null, view: v, kills: s.kills, teamKills: tk, share: s.kills / tk, won: v.winnerId === s.team_id });
    }
  }
  return out.sort((a, b) => b.share - a.share || b.kills - a.kills).slice(0, limit);
}

export interface Clutch {
  player: Player;
  team: Team | null;
  games: number;
  kills: number;
}

/** "Mr. Clutch": most kills in games their team won by one round. */
export function clutchPlayers(idx: LeagueIndex, games: GameView[], limit = 5): Clutch[] {
  const m = new Map<string, Clutch & { teamId: string }>();
  for (const s of stories(games).filter((x) => x.margin === 1)) {
    for (const st of [...s.view.statsA, ...s.view.statsB]) {
      if (st.team_id !== s.winner.id) continue;
      const player = idx.playerById.get(st.player_id);
      if (!player) continue;
      const row = m.get(player.id) ?? { player, team: null, teamId: st.team_id, games: 0, kills: 0 };
      row.games++;
      row.kills += st.kills;
      row.teamId = st.team_id;
      m.set(player.id, row);
    }
  }
  return [...m.values()]
    .map(({ teamId, ...r }) => ({ ...r, team: idx.teamById.get(teamId) ?? null }))
    .sort((a, b) => b.kills - a.kills || b.games - a.games)
    .slice(0, limit);
}

export interface TeamStory {
  team: Team;
  played: number;
  wins: number;
  /** Record in games decided by a single round. */
  closeWins: number;
  closeLosses: number;
  /** Won with fewer kills / lost with more kills. */
  upsetWins: number;
  longestStreak: number;
  /** Current run: positive = wins, negative = losses. */
  current: number;
  bestMap: { map: GameMap; wins: number; played: number } | null;
}

/** Per team: clutch record, streaks and best map (needs at least 2 games on a map). */
export function teamStories(games: GameView[]): TeamStory[] {
  const ordered = stories(games).sort((a, b) => (a.view.game.scheduled_at ?? "").localeCompare(b.view.game.scheduled_at ?? ""));
  const m = new Map<string, TeamStory & { run: number; maps: Map<string, { map: GameMap; wins: number; played: number }> }>();
  const row = (team: Team) => {
    let r = m.get(team.id);
    if (!r) {
      r = { team, played: 0, wins: 0, closeWins: 0, closeLosses: 0, upsetWins: 0, longestStreak: 0, current: 0, bestMap: null, run: 0, maps: new Map() };
      m.set(team.id, r);
    }
    return r;
  };
  for (const s of ordered) {
    for (const [team, won] of [
      [s.winner, true],
      [s.loser, false],
    ] as const) {
      const r = row(team);
      r.played++;
      if (won) r.wins++;
      if (s.margin === 1) {
        if (won) r.closeWins++;
        else r.closeLosses++;
      }
      if (won && s.winnerKills < s.loserKills) r.upsetWins++;
      r.current = won ? (r.current > 0 ? r.current + 1 : 1) : r.current < 0 ? r.current - 1 : -1;
      r.run = won ? r.run + 1 : 0;
      r.longestStreak = Math.max(r.longestStreak, r.run);
      if (s.view.map) {
        const mm = r.maps.get(s.view.map.id) ?? { map: s.view.map, wins: 0, played: 0 };
        mm.played++;
        if (won) mm.wins++;
        r.maps.set(s.view.map.id, mm);
      }
    }
  }
  return [...m.values()]
    .map(({ run, maps, ...r }) => {
      void run;
      const best = [...maps.values()].filter((x) => x.played >= 2).sort((a, b) => b.wins / b.played - a.wins / a.played || b.played - a.played)[0];
      return { ...r, bestMap: best ?? null };
    })
    .sort((a, b) => b.closeWins - a.closeWins || a.closeLosses - b.closeLosses || b.wins - a.wins);
}

/** Labels for one finished game: decided by a single round, and/or won with fewer kills. */
export function gameTags(v: GameView): { thriller: boolean; upset: boolean } {
  if (!v.completed || v.game.team_a_rounds == null || v.game.team_b_rounds == null) return { thriller: false, upset: false };
  const aWon = v.winnerId === v.fixture.team_a_id;
  return {
    thriller: Math.abs(v.game.team_a_rounds - v.game.team_b_rounds) === 1,
    upset: aWon ? v.killsA < v.killsB : v.killsB < v.killsA,
  };
}
