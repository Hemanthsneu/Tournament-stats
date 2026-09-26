// Database helper for when you're not using `supabase db push`. Reads DATABASE_URL from .env.local.
//   npm run db:setup   apply supabase/migrations/*.sql (all idempotent) + ADMIN_EMAILS (optional)
//   npm run db:demo    load the demo league (2 seasons) so you can click around
//   npm run db:wipe    delete ALL league data (seasons, teams, players, games…), keeps the schema
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { buildSampleData } from "../src/lib/sample-data";

const command = process.argv[2];
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing. Add it to .env.local (Supabase → Connect → Session pooler).");
  process.exit(1);
}
const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });

const TABLES = [
  "player_game_stats", "games", "fixtures", "season_maps", "maps", "roster_entries",
  "player_aliases", "players", "season_teams", "teams", "seasons",
];

async function setup() {
  const dir = path.join(process.cwd(), "supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await sql.unsafe(readFileSync(path.join(dir, file), "utf8"));
    console.log(`✓ Applied ${file}`);
  }
  const emails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  for (const email of emails) await sql`insert into admins (email) values (${email}) on conflict do nothing`;
  const admins = await sql<{ email: string }[]>`select email from admins order by email`;
  console.log(`✓ Organizers: ${admins.map((a) => a.email).join(", ") || "(none yet. Run npm run admin:add)"}`);
}

async function demo() {
  const [{ count }] = await sql<{ count: number }[]>`select count(*)::int as count from seasons`;
  if (count > 0 && !process.argv.includes("--force")) {
    console.error(`There are already ${count} season(s). Run "npm run db:wipe" first, or add --force.`);
    process.exit(1);
  }
  const d = buildSampleData();
  await sql.begin(async (tx) => {
    const insert = async (table: string, rows: object[]) => {
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500) as Record<string, unknown>[];
        if (chunk.length) await tx`insert into ${tx(table)} ${tx(chunk as never)}`;
      }
    };
    await insert("seasons", d.seasons);
    await insert("teams", d.teams);
    await insert("season_teams", d.seasonTeams);
    await insert("players", d.players);
    await insert("player_aliases", d.aliases);
    await insert("roster_entries", d.rosters);
    await insert("maps", d.maps);
    await insert("season_maps", d.seasonMaps);
    await insert("fixtures", d.fixtures);
    await insert("games", d.games);
    await insert("player_game_stats", d.stats);
  });
  console.log(`✓ Demo loaded: ${d.seasons.length} seasons, ${d.teams.length} teams, ${d.players.length} players, ${d.games.length} games`);
}

async function wipe() {
  await sql.unsafe(`truncate ${TABLES.join(", ")} cascade`);
  console.log("✓ All league data deleted (schema and organizers kept)");
}

try {
  if (command === "setup") await setup();
  else if (command === "demo") await demo();
  else if (command === "wipe") await wipe();
  else console.log("Usage: tsx scripts/db.ts setup|demo|wipe");
} catch (e) {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
