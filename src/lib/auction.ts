// Bidding maths shared by the live room (client) and pages (server). Mirrors the database rules in
// auction_place_bid(), which is the final authority.
import type { Auction, AuctionIncrement, AuctionLot, AuctionSnapshot } from "./types";

export function bidStep(increments: AuctionIncrement[], amount: number): number {
  const sorted = [...increments].sort((a, b) => (a.upto ?? Infinity) - (b.upto ?? Infinity));
  return sorted.find((i) => i.upto === null || amount < i.upto)?.step ?? 10;
}

export function lotBase(auction: Auction, lot: AuctionLot): number {
  return lot.base_price ?? auction.base_price;
}

/** Smallest valid next bid on a lot. */
export function nextBid(auction: Auction, lot: AuctionLot): number {
  return lot.current_bid == null ? lotBase(auction, lot) : lot.current_bid + bidStep(auction.increments, lot.current_bid);
}

/** `count` bid options: the minimum, then one, two… extra steps above it. */
export function bidOptions(auction: Auction, lot: AuctionLot, count = 3): number[] {
  const out = [nextBid(auction, lot)];
  while (out.length < count) out.push(out.at(-1)! + bidStep(auction.increments, out.at(-1)!));
  return out;
}

export interface TeamPurse {
  spent: number;
  bought: number;
  left: number;
  slotsLeft: number;
  /** Highest bid allowed while keeping enough to fill the minimum squad at base price. */
  maxBid: number;
}

export function teamPurse(auction: Auction, team: AuctionSnapshot["teams"][number]): TeamPurse {
  const left = auction.purse - team.spent;
  return {
    spent: team.spent,
    bought: team.bought,
    left,
    slotsLeft: Math.max(auction.max_buys - team.bought, 0),
    maxBid: left - Math.max(auction.min_buys - team.bought - 1, 0) * auction.base_price,
  };
}

export const credits = (n: number) => n.toLocaleString("en-IN");
