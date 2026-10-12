import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

/**
 * Service-role client for organizer-only tasks that need the Auth admin API (seeing which email
 * claimed a profile, resetting a player's password). Only ever call after adminClient() succeeded.
 */
export function serviceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set on the server.");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const hasServiceKey = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
