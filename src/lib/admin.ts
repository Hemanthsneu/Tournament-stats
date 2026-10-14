import "server-only";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchLeagueData } from "./data";
import { buildIndex, planPlayoffs } from "./engine/league";
import { isSupabaseConfigured } from "./supabase/config";
import { createSessionClient } from "./supabase/server";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export class UserError extends Error {}

/** Supabase client for the signed-in organizer; throws if not signed in or not on the admin list. */
export async function adminClient(): Promise<SupabaseClient> {
  if (!isSupabaseConfigured) throw new UserError("Supabase is not configured yet (see README).");
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("Your session expired. Please sign in again.");
  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error) throw new UserError(`Could not verify organizer access: ${error.message}`);
  if (!isAdmin) throw new UserError("This account is not on the organizer list.");
  return supabase;
}

/** Runs an admin mutation, converts errors into a toast-friendly result and refreshes every page. */
export async function run(fn: (db: SupabaseClient) => Promise<string | void>): Promise<ActionResult> {
  try {
    const db = await adminClient();
    const message = await fn(db);
    revalidatePath("/", "layout");
    return { ok: true, message: message ?? undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: friendly(msg) };
  }
}

function friendly(msg: string): string {
  if (msg.includes("duplicate key") && msg.includes("teams_name_key")) return "A team with that name already exists.";
  if (msg.includes("duplicate key") && msg.includes("players_bgmi_uid_key")) return "Another player already has that BGMI UID.";
  if (msg.includes("duplicate key") && msg.includes("seasons_number_key")) return "That season number already exists.";
  if (msg.includes("roster_one_active_team")) return "That player is already on an active roster this season.";
  if (msg.includes("violates foreign key constraint")) return "This is still used elsewhere (games, rosters or stats), so it can't be deleted.";
  return msg;
}

/**
 * Throws on a Supabase error, otherwise returns data. Selects return rows (never null without an
 * error); plain inserts/updates/deletes return null, which callers ignore.
 */
export function must<R extends { data: unknown; error: { message: string } | null }>(res: R): NonNullable<R["data"]> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<R["data"]>;
}

// ---------------------------------------------------------------------------
// FormData helpers
// ---------------------------------------------------------------------------

export function text(fd: FormData, key: string, opts: { required?: string } = {}): string {
  const v = String(fd.get(key) ?? "").trim();
  if (!v && opts.required) throw new UserError(opts.required);
  return v;
}

export function optionalText(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  return v || null;
}

export function int(fd: FormData, key: string, opts: { min?: number; max?: number; label?: string } = {}): number {
  const raw = String(fd.get(key) ?? "").trim();
  const n = Number(raw);
  const label = opts.label ?? key;
  if (raw === "" || !Number.isInteger(n)) throw new UserError(`${label} must be a whole number.`);
  if (opts.min != null && n < opts.min) throw new UserError(`${label} must be at least ${opts.min}.`);
  if (opts.max != null && n > opts.max) throw new UserError(`${label} must be at most ${opts.max}.`);
  return n;
}

// ---------------------------------------------------------------------------
// Playoffs: keep bracket in sync after every result change
// ---------------------------------------------------------------------------

export async function syncPlayoffs(db: SupabaseClient, seasonId: string): Promise<void> {
  const data = await fetchLeagueData();
  const plan = planPlayoffs(buildIndex(data), seasonId);
  for (const ft of plan.fixtureTeams) {
    must(await db.from("fixtures").update({ team_a_id: ft.team_a_id, team_b_id: ft.team_b_id }).eq("id", ft.fixture_id));
  }
  for (const cg of plan.createGames) {
    const g2 = data.games.find((g) => g.fixture_id === cg.fixture_id && g.game_no === 2);
    const scheduled = g2?.scheduled_at ? new Date(new Date(g2.scheduled_at).getTime() + 45 * 60_000).toISOString() : null;
    must(await db.from("games").insert({ ...cg, scheduled_at: scheduled }));
  }
}
