import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "./supabase/config";
import { createPublicClient, createSessionClient } from "./supabase/server";
import type { Auction, CommunityData, PlayerProfile } from "./types";

const EMPTY: CommunityData = { availability: [], accounts: [], profiles: [], auctions: [], auctionTeams: [], auctionLots: [] };

/** Reads a table; returns [] if it doesn't exist yet (e.g. before the Season 2 migration runs). */
async function readTable<T>(table: string, order: string): Promise<T[]> {
  const rows: T[] = [];
  const supabase = createPublicClient();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select("*").order(order).range(from, from + 999);
    if (error) {
      if (error.code === "PGRST205" || error.code === "42P01" || /does not exist|schema cache/i.test(error.message)) return [];
      throw new Error(`Could not load ${table}: ${error.message}`);
    }
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return rows;
  }
}

/** Accounts, player profiles and auctions, once per request. */
export const loadCommunity = cache(async (): Promise<CommunityData> => {
  if (!isSupabaseConfigured) return EMPTY;
  const [availability, accounts, profiles, auctions, auctionTeams, auctionLots] = await Promise.all([
    readTable<CommunityData["availability"][number]>("player_availability", "player_id"),
    readTable<CommunityData["accounts"][number]>("player_accounts", "claimed_at"),
    readTable<PlayerProfile>("player_profiles", "player_id"),
    readTable<Auction>("auctions", "created_at"),
    readTable<CommunityData["auctionTeams"][number]>("auction_teams", "sort_order"),
    readTable<CommunityData["auctionLots"][number]>("auction_lots", "created_at"),
  ]);
  return { availability, accounts, profiles, auctions, auctionTeams, auctionLots };
});

export interface Viewer {
  userId: string;
  email: string | null;
  playerId: string | null;
  isAdmin: boolean;
}

/** The signed-in person (player and/or organizer), or null. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: playerId }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("my_player_id"),
    supabase.rpc("is_admin"),
  ]);
  return { userId: user.id, email: user.email ?? null, playerId: (playerId as string | null) ?? null, isAdmin: !!isAdmin };
});

/** Most relevant auction to show: a running one (real first), else the newest real one, else a practice run. */
export function featuredAuction(data: CommunityData): Auction | null {
  const sorted = [...data.auctions].sort((a, b) => Number(!!a.is_practice) - Number(!!b.is_practice) || b.created_at.localeCompare(a.created_at));
  return sorted.find((a) => a.status === "live" || a.status === "paused") ?? sorted[0] ?? null;
}

/** Auctions that count (practice runs never appear in history, records or value stats). */
export const realAuctions = (data: CommunityData) => data.auctions.filter((a) => !a.is_practice);

export function profileMap(data: CommunityData): Map<string, PlayerProfile> {
  return new Map(data.profiles.map((p) => [p.player_id, p]));
}

export function availabilityMap(data: CommunityData) {
  return new Map(data.availability.map((a) => [a.player_id, a]));
}

export function verifiedSet(data: CommunityData): Set<string> {
  return new Set(data.accounts.map((a) => a.player_id));
}
