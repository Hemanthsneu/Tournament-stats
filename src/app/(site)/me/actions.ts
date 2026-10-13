"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/admin";
import { createSessionClient } from "@/lib/supabase/server";
import { PLAYER_ROLES, type PlayerRole } from "@/lib/types";

async function player<T>(fn: (db: Awaited<ReturnType<typeof createSessionClient>>) => Promise<T>): Promise<ActionResult> {
  try {
    const db = await createSessionClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return { ok: false, error: "Please sign in again." };
    const message = await fn(db);
    revalidatePath("/", "layout");
    return { ok: true, message: typeof message === "string" ? message : undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function claimProfile(fd: FormData) {
  return player(async (db) => {
    const code = String(fd.get("code") ?? "").trim();
    if (!code) throw new Error("Enter the code your organizer sent you.");
    const { error } = await db.rpc("claim_profile", { p_code: code });
    if (error) throw new Error(error.message);
    return "Profile claimed. Welcome!";
  });
}

const handle = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "") || null;

const url = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://youtube.com/@${s.replace(/^@/, "")}`;
};

export async function saveProfile(fd: FormData) {
  return player(async (db) => {
    const { data: playerId } = await db.rpc("my_player_id");
    if (!playerId) throw new Error("Claim your profile first.");
    const role = String(fd.get("role") ?? "");
    const bio = String(fd.get("bio") ?? "").trim();
    if (bio.length > 280) throw new Error("Keep your bio under 280 characters.");
    const photo = String(fd.get("photo_url") ?? "").trim();
    const { error } = await db.from("player_profiles").upsert({
      player_id: playerId,
      photo_url: photo || null,
      bio: bio || null,
      role: PLAYER_ROLES.includes(role as PlayerRole) ? role : null,
      instagram: handle(fd.get("instagram")),
      youtube: url(fd.get("youtube")),
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return "Profile saved";
  });
}

export async function saveAvailability(fd: FormData) {
  return player(async (db) => {
    const { data: playerId } = await db.rpc("my_player_id");
    if (!playerId) throw new Error("Claim your profile first.");
    const days = [...new Set(fd.getAll("day").map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
    const from = String(fd.get("time_from") ?? "") || null;
    const to = String(fd.get("time_to") ?? "") || null;
    if (from && to && from >= to) throw new Error("'Until' must be later than 'From'.");
    const note = String(fd.get("note") ?? "").trim();
    if (note.length > 160) throw new Error("Keep the note under 160 characters.");
    const { error } = await db.from("player_availability").upsert({
      player_id: playerId,
      days,
      time_from: from,
      time_to: to,
      note: note || null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return days.length ? `Saved: ${days.length} day${days.length === 1 ? "" : "s"} a week` : "Saved (no days selected)";
  });
}

export async function setAuctionRegistration(auctionId: string, join: boolean) {
  return player(async (db) => {
    const { error } = await db.rpc("auction_register", { p_auction_id: auctionId, p_join: join });
    if (error) throw new Error(error.message);
    return join ? "You're in the auction pool!" : "Removed from the auction pool";
  });
}

export async function signOutPlayer(): Promise<void> {
  const db = await createSessionClient();
  await db.auth.signOut();
  redirect("/");
}
