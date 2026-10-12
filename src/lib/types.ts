// Row types mirror supabase/migrations (snake_case, as returned by Supabase).

export type SeasonStatus = "draft" | "active" | "completed";
export type FixtureType = "official" | "practice";
export type Stage = "league" | "qualifier_1" | "eliminator" | "qualifier_2" | "final" | "practice";
export type PlayoffStage = "qualifier_1" | "eliminator" | "qualifier_2" | "final";
export type GameStatus = "scheduled" | "live" | "completed";
export type TiebreakKey = "nrr" | "nkr" | "h2h" | "kills" | "round_win_pct" | "revives";

export interface Season {
  id: string;
  number: number;
  name: string;
  status: SeasonStatus;
  round_robins: number;
  points_win: number;
  points_loss: number;
  tiebreak_order: TiebreakKey[];
  mvp_kill_weight: number;
  mvp_revive_weight: number;
}

export interface Team {
  id: string;
  name: string;
  tag: string;
  logo_url: string | null;
}

export interface SeasonTeam {
  season_id: string;
  team_id: string;
}

export interface Player {
  id: string;
  ign: string;
  bgmi_uid: string | null;
  real_name: string | null;
  photo_url: string | null;
}

export interface PlayerAlias {
  id: string;
  player_id: string;
  ign: string;
  changed_on: string;
}

export interface RosterEntry {
  id: string;
  season_id: string;
  team_id: string;
  player_id: string;
  joined_on: string;
  left_on: string | null;
}

export interface GameMap {
  id: string;
  name: string;
  wow_map_id: string | null;
  total_rounds: number;
}

export interface SeasonMap {
  season_id: string;
  map_id: string;
  sort_order: number;
}

export interface Fixture {
  id: string;
  season_id: string;
  type: FixtureType;
  stage: Stage;
  round_robin: number | null;
  matchday: number | null;
  sort_order: number;
  team_a_id: string | null;
  team_b_id: string | null;
}

export interface Game {
  id: string;
  fixture_id: string;
  game_no: number;
  map_id: string | null;
  scheduled_at: string | null;
  squad_size: number | null;
  team_a_rounds: number | null;
  team_b_rounds: number | null;
  status: GameStatus;
  potm_player_id: string | null;
}

export interface PlayerGameStat {
  game_id: string;
  player_id: string;
  team_id: string;
  kills: number;
  revives: number;
}

export interface LeagueData {
  seasons: Season[];
  teams: Team[];
  seasonTeams: SeasonTeam[];
  players: Player[];
  aliases: PlayerAlias[];
  rosters: RosterEntry[];
  maps: GameMap[];
  seasonMaps: SeasonMap[];
  fixtures: Fixture[];
  games: Game[];
  stats: PlayerGameStat[];
}

export const PLAYOFF_STAGES: PlayoffStage[] = ["qualifier_1", "eliminator", "qualifier_2", "final"];

export const STAGE_LABELS: Record<Stage, string> = {
  league: "League",
  qualifier_1: "Qualifier 1",
  eliminator: "Eliminator",
  qualifier_2: "Qualifier 2",
  final: "Final",
  practice: "Practice",
};

export const TIEBREAK_LABELS: Record<TiebreakKey, string> = {
  nrr: "Net Round Rate (NRR)",
  nkr: "Net Kill Rate (NKR)",
  h2h: "Head-to-head points",
  kills: "Total kills",
  round_win_pct: "Round win %",
  revives: "Total revives",
};

// ---------------------------------------------------------------------------
// Season 2: accounts, profiles, auction (supabase/migrations/20261012000000_accounts_auction.sql)
// ---------------------------------------------------------------------------

export const PLAYER_ROLES = ["Fragger", "Support", "IGL", "Sniper", "Flex"] as const;
export type PlayerRole = (typeof PLAYER_ROLES)[number];

export interface PlayerAccount {
  user_id: string;
  player_id: string;
  claimed_at: string;
}

export interface PlayerProfile {
  player_id: string;
  photo_url: string | null;
  bio: string | null;
  role: PlayerRole | null;
  instagram: string | null;
  youtube: string | null;
}

export type AuctionStatus = "setup" | "live" | "paused" | "completed";
export type LotStatus = "pool" | "live" | "sold" | "unsold";

export interface AuctionIncrement {
  upto: number | null;
  step: number;
}

export interface Auction {
  id: string;
  season_id: string | null;
  name: string;
  status: AuctionStatus;
  registration_open: boolean;
  purse: number;
  base_price: number;
  min_buys: number;
  max_buys: number;
  increments: AuctionIncrement[];
  timer_seconds: number;
  bid_extend_seconds: number;
  countdown_seconds: number;
  auto_next_seconds: number;
  voice_enabled: boolean;
  current_lot_id: string | null;
  paused_remaining_ms: number | null;
  created_at: string;
}

export interface AuctionTeam {
  auction_id: string;
  team_id: string;
  captain_player_id: string | null;
  sort_order: number;
}

export interface AuctionLot {
  id: string;
  auction_id: string;
  player_id: string;
  set_name: string;
  set_order: number;
  base_price: number | null;
  status: LotStatus;
  round: number;
  draw_no: number | null;
  current_bid: number | null;
  current_team_id: string | null;
  ends_at: string | null;
  sold_price: number | null;
  sold_team_id: string | null;
  closed_at: string | null;
  registered_by_player: boolean;
  created_at: string;
}

export interface AuctionBid {
  id: number;
  auction_id: string;
  lot_id: string;
  team_id: string;
  amount: number;
  user_id: string | null;
  created_at: string;
}

/** Shape returned by the auction_snapshot() database function. */
export interface AuctionSnapshot {
  now: string;
  auction: Auction | null;
  teams: (AuctionTeam & { spent: number; bought: number })[];
  lots: AuctionLot[];
  bids: AuctionBid[];
}

export interface CommunityData {
  accounts: PlayerAccount[];
  profiles: PlayerProfile[];
  auctions: Auction[];
  auctionTeams: AuctionTeam[];
  auctionLots: AuctionLot[];
}
