export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** False until .env.local (or Vercel env vars) are filled in; the site then runs on demo data. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);
