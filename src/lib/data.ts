import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { buildSampleData } from "./sample-data";
import { buildIndex, currentSeason, seasonByNumber, type LeagueIndex } from "./engine/league";
import { isSupabaseConfigured } from "./supabase/config";
import { createPublicClient } from "./supabase/server";
import type { LeagueData, Season } from "./types";

const PAGE = 1000;

async function fetchAll<T>(table: string, orderBy: string[]): Promise<T[]> {
  const supabase = createPublicClient();
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select("*");
    for (const col of orderBy) query = query.order(col);
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw new Error(`Could not load ${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return rows;
  }
}

/** Uncached load, used by admin actions that need fresh data right after a write. */
export async function fetchLeagueData(): Promise<LeagueData> {
  const [seasons, teams, seasonTeams, players, aliases, rosters, maps, seasonMaps, fixtures, games, stats] =
    await Promise.all([
      fetchAll<Season>("seasons", ["number"]),
      fetchAll<LeagueData["teams"][number]>("teams", ["name"]),
      fetchAll<LeagueData["seasonTeams"][number]>("season_teams", ["season_id", "team_id"]),
      fetchAll<LeagueData["players"][number]>("players", ["ign"]),
      fetchAll<LeagueData["aliases"][number]>("player_aliases", ["id"]),
      fetchAll<LeagueData["rosters"][number]>("roster_entries", ["id"]),
      fetchAll<LeagueData["maps"][number]>("maps", ["name"]),
      fetchAll<LeagueData["seasonMaps"][number]>("season_maps", ["season_id", "map_id"]),
      fetchAll<LeagueData["fixtures"][number]>("fixtures", ["id"]),
      fetchAll<LeagueData["games"][number]>("games", ["id"]),
      fetchAll<LeagueData["stats"][number]>("player_game_stats", ["game_id", "player_id"]),
    ]);
  return {
    seasons: seasons.map((s) => ({
      ...s,
      mvp_kill_weight: Number(s.mvp_kill_weight),
      mvp_revive_weight: Number(s.mvp_revive_weight),
    })),
    teams,
    seasonTeams,
    players,
    aliases,
    rosters,
    maps,
    seasonMaps,
    fixtures,
    games,
    stats,
  };
}

let demoData: LeagueData | null = null;

/** Public pages never see draft seasons (or anything attached to them). */
function withoutDrafts(data: LeagueData): LeagueData {
  const hidden = new Set(data.seasons.filter((s) => s.status === "draft").map((s) => s.id));
  if (hidden.size === 0) return data;
  const fixtures = data.fixtures.filter((f) => !hidden.has(f.season_id));
  const fixtureIds = new Set(fixtures.map((f) => f.id));
  const games = data.games.filter((g) => fixtureIds.has(g.fixture_id));
  const gameIds = new Set(games.map((g) => g.id));
  return {
    ...data,
    seasons: data.seasons.filter((s) => !hidden.has(s.id)),
    seasonTeams: data.seasonTeams.filter((r) => !hidden.has(r.season_id)),
    rosters: data.rosters.filter((r) => !hidden.has(r.season_id)),
    seasonMaps: data.seasonMaps.filter((r) => !hidden.has(r.season_id)),
    fixtures,
    games,
    stats: data.stats.filter((s) => gameIds.has(s.game_id)),
  };
}

/**
 * Loads the whole league once per request (it's small: a few thousand rows even after many seasons).
 * Demo data is used until Supabase env vars are set. Admin pages pass `includeDrafts`.
 */
export const loadLeague = cache(async (includeDrafts: boolean = false): Promise<{ idx: LeagueIndex; demo: boolean }> => {
  let data: LeagueData;
  let demo = false;
  if (!isSupabaseConfigured) {
    demoData ??= buildSampleData();
    data = demoData;
    demo = true;
  } else {
    data = await fetchLeagueData();
  }
  return { idx: buildIndex(includeDrafts ? data : withoutDrafts(data)), demo };
});

/** Resolves the public `[season]` route param (a season number) or 404s. */
export async function loadSeason(param: string) {
  const { idx, demo } = await loadLeague();
  const season = seasonByNumber(idx.data, Number(param));
  if (!season) notFound();
  return { idx, demo, season };
}

export async function loadCurrentSeason() {
  const { idx } = await loadLeague();
  return currentSeason(idx.data);
}
