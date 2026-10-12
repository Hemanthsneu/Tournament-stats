"use server";

import { redirect } from "next/navigation";
import { int, must, optionalText, run, text, UserError, type ActionResult } from "@/lib/admin";
import { fetchLeagueData } from "@/lib/data";
import { buildIndex, filterGames } from "@/lib/engine/league";
import { playerLeaderboard, rankBy } from "@/lib/engine/players";
import type { AuctionIncrement } from "@/lib/types";

/** "200:10, 500:25, *:50" → below 200 step 10, below 500 step 25, above that step 50. */
function parseIncrements(raw: string): AuctionIncrement[] {
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) throw new UserError("Enter at least one bid step, e.g. *:10");
  const out = parts.map((p) => {
    const [upto, step] = p.split(":").map((s) => s.trim());
    const stepN = Number(step);
    if (!Number.isInteger(stepN) || stepN < 1) throw new UserError(`"${p}": step must be a whole number like 10.`);
    if (upto === "*" || upto === "") return { upto: null, step: stepN };
    const uptoN = Number(upto);
    if (!Number.isInteger(uptoN) || uptoN < 1) throw new UserError(`"${p}": use "upto:step", e.g. 200:10.`);
    return { upto: uptoN, step: stepN };
  });
  out.sort((a, b) => (a.upto ?? Infinity) - (b.upto ?? Infinity));
  if (out.at(-1)!.upto !== null) out.push({ upto: null, step: out.at(-1)!.step });
  return out;
}

export async function createAuction(fd: FormData) {
  let id: string | null = null;
  const res = await run(async (db) => {
    const row = must(
      await db
        .from("auctions")
        .insert({ name: text(fd, "name", { required: "Give the auction a name." }), season_id: optionalText(fd, "season_id") })
        .select("id")
        .single(),
    );
    id = row.id;
  });
  if (res.ok && id) redirect(`/admin/auction/${id}`);
  return res;
}

export async function updateAuctionSettings(auctionId: string, fd: FormData) {
  return run(async (db) => {
    const minBuys = int(fd, "min_buys", { min: 0, max: 30, label: "Min players to buy" });
    const maxBuys = int(fd, "max_buys", { min: 1, max: 30, label: "Max players to buy" });
    if (minBuys > maxBuys) throw new UserError("Min players can't be more than max players.");
    must(
      await db
        .from("auctions")
        .update({
          name: text(fd, "name", { required: "Give the auction a name." }),
          season_id: optionalText(fd, "season_id"),
          purse: int(fd, "purse", { min: 1, label: "Purse" }),
          base_price: int(fd, "base_price", { min: 0, label: "Base price" }),
          min_buys: minBuys,
          max_buys: maxBuys,
          increments: parseIncrements(String(fd.get("increments") ?? "")),
          timer_seconds: int(fd, "timer_seconds", { min: 5, max: 600, label: "Time per player" }),
          bid_extend_seconds: int(fd, "bid_extend_seconds", { min: 0, max: 300, label: "Time after each bid" }),
          countdown_seconds: int(fd, "countdown_seconds", { min: 0, max: 10, label: "Final countdown" }),
          auto_next_seconds: int(fd, "auto_next_seconds", { min: 0, max: 120, label: "Auto next player" }),
          voice_enabled: fd.get("voice_enabled") === "on",
          registration_open: fd.get("registration_open") === "on",
        })
        .eq("id", auctionId),
    );
    return "Auction settings saved";
  });
}

export async function deleteAuction(auctionId: string): Promise<ActionResult> {
  const res = await run(async (db) => {
    const a = must(await db.from("auctions").select("status").eq("id", auctionId).single());
    if (a.status === "live" || a.status === "paused") throw new UserError("Pause and reset the auction before deleting it.");
    must(await db.from("auctions").delete().eq("id", auctionId));
  });
  if (res.ok) redirect("/admin/auction");
  return res;
}

// ---------------------------------------------------------------------------
// Teams & captains
// ---------------------------------------------------------------------------

export async function addAuctionTeam(auctionId: string, fd: FormData) {
  return run(async (db) => {
    let teamId = optionalText(fd, "team_id");
    if (!teamId) {
      const name = text(fd, "name", { required: "Pick an existing team or type a new team name." });
      const team = must(
        await db.from("teams").insert({ name, tag: text(fd, "tag", { required: "Enter a short tag (e.g. CV)." }).toUpperCase(), logo_url: optionalText(fd, "logo_url") }).select("id").single(),
      );
      teamId = team.id;
    }
    const existing = must(await db.from("auction_teams").select("sort_order").eq("auction_id", auctionId));
    must(
      await db.from("auction_teams").insert({
        auction_id: auctionId,
        team_id: teamId,
        sort_order: existing.reduce((m, r) => Math.max(m, r.sort_order + 1), 0),
      }),
    );
    return "Team added";
  });
}

export async function setCaptain(auctionId: string, teamId: string, fd: FormData) {
  return run(async (db) => {
    const playerId = optionalText(fd, "captain_player_id");
    if (playerId) {
      const lot = must(await db.from("auction_lots").select("id, status").eq("auction_id", auctionId).eq("player_id", playerId).maybeSingle());
      if (lot && lot.status !== "pool") throw new UserError("That player has already been auctioned.");
      if (lot) must(await db.from("auction_lots").delete().eq("id", lot.id));
    }
    must(await db.from("auction_teams").update({ captain_player_id: playerId }).eq("auction_id", auctionId).eq("team_id", teamId));
    return playerId ? "Captain set (and removed from the pool)" : "Captain cleared";
  });
}

export async function removeAuctionTeam(auctionId: string, teamId: string) {
  return run(async (db) => {
    const sold = must(await db.from("auction_lots").select("id").eq("auction_id", auctionId).eq("sold_team_id", teamId).limit(1));
    if (sold.length) throw new UserError("This team has already bought players. Reset the auction first.");
    must(await db.from("auction_teams").delete().eq("auction_id", auctionId).eq("team_id", teamId));
    return "Team removed";
  });
}

// ---------------------------------------------------------------------------
// Player pool
// ---------------------------------------------------------------------------

async function captainIds(db: Parameters<Parameters<typeof run>[0]>[0], auctionId: string) {
  const rows = must(await db.from("auction_teams").select("captain_player_id").eq("auction_id", auctionId));
  return new Set(rows.map((r) => r.captain_player_id).filter(Boolean));
}

export async function addLots(auctionId: string, fd: FormData) {
  return run(async (db) => {
    const ids = fd.getAll("player_id").map(String).filter(Boolean);
    if (!ids.length) throw new UserError("Tick at least one player.");
    const captains = await captainIds(db, auctionId);
    const rows = ids.filter((id) => !captains.has(id)).map((player_id) => ({ auction_id: auctionId, player_id }));
    must(await db.from("auction_lots").upsert(rows, { onConflict: "auction_id,player_id", ignoreDuplicates: true }));
    return `Added ${rows.length} player${rows.length === 1 ? "" : "s"} to the pool`;
  });
}

export async function addAllLots(auctionId: string, which: "claimed" | "all") {
  return run(async (db) => {
    const captains = await captainIds(db, auctionId);
    const players =
      which === "claimed"
        ? must(await db.from("player_accounts").select("player_id")).map((r) => r.player_id)
        : must(await db.from("players").select("id")).map((r) => r.id);
    const rows = players.filter((id) => !captains.has(id)).map((player_id) => ({ auction_id: auctionId, player_id }));
    if (rows.length) must(await db.from("auction_lots").upsert(rows, { onConflict: "auction_id,player_id", ignoreDuplicates: true }));
    return `Pool updated (${rows.length} players considered)`;
  });
}

export async function updateLot(lotId: string, fd: FormData) {
  return run(async (db) => {
    const base = optionalText(fd, "base_price");
    const baseN = base === null ? null : Number(base);
    if (baseN !== null && (!Number.isInteger(baseN) || baseN < 0)) throw new UserError("Base price must be a whole number.");
    must(
      await db
        .from("auction_lots")
        .update({
          set_name: text(fd, "set_name") || "Pool",
          set_order: int(fd, "set_order", { min: 0, max: 99, label: "Set order" }),
          base_price: baseN,
        })
        .eq("id", lotId),
    );
    return "Saved";
  });
}

export async function removeLot(lotId: string) {
  return run(async (db) => {
    const lot = must(await db.from("auction_lots").select("status").eq("id", lotId).single());
    if (lot.status !== "pool") throw new UserError("Only players still waiting in the pool can be removed.");
    must(await db.from("auction_lots").delete().eq("id", lotId));
    return "Removed from the pool";
  });
}

/**
 * Splits the pool into sets by career MVP points (official games): Marquee, Set A, Set B…
 * Players are drawn set by set (randomly within a set), like IPL marquee sets.
 */
export async function autoAssignSets(auctionId: string, fd: FormData) {
  return run(async (db) => {
    const sizes = String(fd.get("sizes") ?? "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (!sizes.length) throw new UserError('Enter set sizes like "4, 8" (the rest go in the last set).');
    const idx = buildIndex(await fetchLeagueData());
    const ranking = rankBy(playerLeaderboard(idx, filterGames(idx, { type: "official" })), "mvp").map((r) => r.player.id);
    const lots = must(await db.from("auction_lots").select("id, player_id").eq("auction_id", auctionId).eq("status", "pool"));
    const pos = (pid: string) => {
      const i = ranking.indexOf(pid);
      return i === -1 ? Infinity : i;
    };
    const sorted = [...lots].sort((a, b) => pos(a.player_id) - pos(b.player_id));
    const names = ["Marquee", "Set A", "Set B", "Set C", "Set D", "Set E"];
    let start = 0;
    for (let s = 0; s <= sizes.length; s++) {
      const chunk = s < sizes.length ? sorted.slice(start, start + sizes[s]) : sorted.slice(start);
      start += chunk.length;
      if (!chunk.length) continue;
      must(await db.from("auction_lots").update({ set_name: names[s] ?? `Set ${s}`, set_order: s }).in("id", chunk.map((l) => l.id)));
    }
    return "Sets assigned by career MVP points";
  });
}

// ---------------------------------------------------------------------------
// Rehearsal reset & finish
// ---------------------------------------------------------------------------

/** Puts every player back in the pool and deletes all bids, for a dry run before the real auction. */
export async function resetAuction(auctionId: string) {
  return run(async (db) => {
    const a = must(await db.from("auctions").select("status").eq("id", auctionId).single());
    if (a.status === "completed") throw new UserError("This auction is finished and written to the season rosters.");
    must(await db.from("auctions").update({ current_lot_id: null, status: "setup", paused_remaining_ms: null }).eq("id", auctionId));
    must(await db.from("auction_bids").delete().eq("auction_id", auctionId));
    must(
      await db
        .from("auction_lots")
        .update({
          status: "pool",
          round: 1,
          draw_no: null,
          current_bid: null,
          current_team_id: null,
          ends_at: null,
          sold_price: null,
          sold_team_id: null,
          closed_at: null,
        })
        .eq("auction_id", auctionId),
    );
    return "Auction reset. Every player is back in the pool.";
  });
}

export async function finalizeAuction(auctionId: string) {
  return run(async (db) => {
    const { data, error } = await db.rpc("auction_finalize", { p_auction_id: auctionId });
    if (error) throw new UserError(error.message);
    return `Done! ${data} players added to the season rosters.`;
  });
}
