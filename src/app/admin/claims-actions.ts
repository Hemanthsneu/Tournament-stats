"use server";

import { randomInt } from "node:crypto";
import { must, run, text, UserError } from "@/lib/admin";
import { serviceSupabase } from "@/lib/supabase/service";

// No 0/O, 1/I/L so codes are easy to read out or type from WhatsApp.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newCode = () => {
  const pick = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${pick()}-${pick()}`;
};

export async function generateClaimCode(playerId: string) {
  return run(async (db) => {
    must(await db.from("claim_codes").upsert({ player_id: playerId, code: newCode(), created_at: new Date().toISOString() }));
    return "New code generated";
  });
}

export async function generateAllClaimCodes() {
  return run(async (db) => {
    const [players, accounts, codes] = await Promise.all([
      db.from("players").select("id"),
      db.from("player_accounts").select("player_id"),
      db.from("claim_codes").select("player_id"),
    ]);
    const skip = new Set([...must(accounts), ...must(codes)].map((r) => r.player_id));
    const rows = must(players)
      .filter((p) => !skip.has(p.id))
      .map((p) => ({ player_id: p.id, code: newCode() }));
    if (rows.length) must(await db.from("claim_codes").insert(rows));
    return rows.length ? `Generated ${rows.length} codes` : "Every unclaimed player already has a code";
  });
}

export async function deleteClaimCode(playerId: string) {
  return run(async (db) => {
    must(await db.from("claim_codes").delete().eq("player_id", playerId));
    return "Code cancelled";
  });
}

export async function revokeClaim(playerId: string) {
  return run(async (db) => {
    must(await db.from("player_accounts").delete().eq("player_id", playerId));
    return "Claim removed. The login still exists but no longer owns this profile.";
  });
}

export async function resetPlayerPassword(playerId: string, fd: FormData) {
  return run(async (db) => {
    const password = text(fd, "password", { required: "Enter a new password." });
    if (password.length < 8) throw new UserError("Use at least 8 characters.");
    const account = must(await db.from("player_accounts").select("user_id").eq("player_id", playerId).maybeSingle());
    if (!account) throw new UserError("This profile hasn't been claimed yet.");
    const { error } = await serviceSupabase().auth.admin.updateUserById(account.user_id, { password });
    if (error) throw new UserError(error.message);
    return "Password changed. Send it to the player and ask them to keep it safe.";
  });
}
