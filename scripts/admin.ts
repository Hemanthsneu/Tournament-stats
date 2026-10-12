// Organizer accounts. Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
//   npm run admin:add      create an organizer (or reset their password). Prompts, so the password never hits your shell history
//   npm run admin:list     show organizer emails
//   npm run admin:remove -- someone@example.com
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");
  process.exit(1);
}
const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

function ask(question: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    // Echo nothing while the password is typed.
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
      if (s.startsWith(question)) process.stdout.write(question);
    };
  }
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    }),
  );
}

async function findUser(email: string) {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit || data.users.length < 200) return hit ?? null;
  }
}

async function add() {
  const email = (await ask("Organizer email: ")).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("That doesn't look like an email.");
  const password = await ask("Password (min 8 characters, hidden): ", true);
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  if ((await ask("Repeat password: ", true)) !== password) throw new Error("Passwords don't match.");

  const existing = await findUser(email);
  let userId: string;
  if (existing) {
    // With player sign-ups open, make sure this account really is yours before giving it organizer access.
    const created = existing.created_at?.slice(0, 10) ?? "unknown date";
    const confirm = await ask(`An account for ${email} already exists (created ${created}). Make it an organizer and set this password? (y/N) `);
    if (confirm.toLowerCase() !== "y") throw new Error("Cancelled.");
    const { error } = await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    if (error) throw error;
    userId = existing.id;
    console.log(`✓ Updated password for ${email}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
    console.log(`✓ Created login for ${email}`);
  }
  const { error } = await supabase.from("admins").upsert({ email, user_id: userId });
  if (error) throw error;
  console.log(`✓ ${email} is an organizer. Sign in at /admin/login`);
}

async function list() {
  const { data, error } = await supabase.from("admins").select("email").order("email");
  if (error) throw error;
  console.log(data.length ? data.map((a) => `• ${a.email}`).join("\n") : "No organizers yet. Run npm run admin:add");
}

async function remove(email: string | undefined) {
  if (!email) throw new Error("Usage: npm run admin:remove -- someone@example.com");
  const { error } = await supabase.from("admins").delete().eq("email", email.toLowerCase());
  if (error) throw error;
  console.log(`✓ ${email} can no longer edit (their login still exists; delete it in Supabase → Authentication if needed)`);
}

const [command, arg] = process.argv.slice(2);
try {
  if (command === "add") await add();
  else if (command === "list") await list();
  else if (command === "remove") await remove(arg);
  else console.log("Usage: tsx scripts/admin.ts add|list|remove <email>");
} catch (e) {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
