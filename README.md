# WOW League

This is the stats site for our BGMI / PUBG Mobile **WOW mode** league. It has:

- An IPL-style points table with **NRR** and **NKR**
- An auto-generated round-robin schedule
- IPL playoffs: best of 3, planned automatically
- A separate practice section
- Awards
- A career profile for every player, across all seasons and teams

Organizers add teams and players and enter results in the admin panel (`/admin`). Everything else is calculated from those results.

Built with Next.js 16, Tailwind CSS, shadcn/ui and Supabase, and deployed on Vercel.

---

## 1. Run it locally

```bash
npm install
npm run dev          # http://localhost:3000
```

Until Supabase is connected, the site shows **demo data**: two seasons, with players changing teams and a finished playoff bracket.

## 2. Connect Supabase (CLI)

```bash
npx supabase login                                            # once per machine
npx supabase link --project-ref <ref>                         # no DB password needed (CLI uses a temporary login role)
npx supabase db push                                          # creates tables, security rules, functions
npx supabase projects api-keys --project-ref <ref> --reveal   # copy the publishable + secret keys into .env.local
npm run admin:add                                             # create an organizer login (prompts for email + password)
```

`.env.local` needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the app. It also needs `SUPABASE_SERVICE_ROLE_KEY` (the secret key) for `admin:add` (see `.env.example`).

Schema changes go in a new file in `supabase/migrations/`, then run `npx supabase db push`. More organizers: `npm run admin:add` (list with `admin:list`, remove with `admin:remove -- email`).

**Without the CLI:** put `DATABASE_URL` (Supabase → Connect → Session pooler) in `.env.local` and run `npm run db:setup`. To try the admin panel with fake data, run `npm run db:demo`. Run `npm run db:wipe` before real data; it deletes every season, team, player and game and keeps the tables.

## 3. Deploy to Vercel (CLI)

```bash
npx vercel link --yes --project wow-league
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production        # repeat for NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_LEAGUE_TZ
npx vercel git connect                                        # auto-deploy on every push to main
npx vercel --prod
```

The three `NEXT_PUBLIC_*` variables go to Vercel. Add `SUPABASE_SERVICE_ROLE_KEY` as a **sensitive, server-only** variable too; it powers organizer-only tasks like player password resets. Never prefix it with `NEXT_PUBLIC_`.

---

## Running a season (organizers)

1. **Seasons → Start a new season.** Optionally copy the previous season's teams and rosters.
2. **Settings & maps:**
   - Add the season's maps: name, WOW map ID, and rounds (21 or 23).
   - Points per win, the tie-breaker order and MVP weights can also be changed here.
3. **Teams & rosters:**
   - Add teams and players.
   - Use *Transfer* to move a player between teams. Past games stay with their old team.
   - Use *Release* when a player leaves.
4. **Schedule:**
   - Pick 1, 2 or 3 round robins and click **Generate**. In each round robin, every pair plays every map once, grouped into matchdays.
   - Then **Apply times**: start date, match days of the week, and time slots.
   - Set the season **status to Active** to publish it. Draft seasons are hidden from the public site.
5. **After each game:**
   - Go to **Dashboard → Enter result**.
   - Pick the squad size (4v4 to 8v8), enter rounds won, tick who played, and type each player's kills and revives.
   - Confirm Player of the Match (it's pre-filled) and **Publish**.
6. **Playoffs** fill themselves in:
   - Q1 (1st vs 2nd) and the Eliminator (3rd vs 4th) appear when the last league game is published.
   - A decider is added only when a series is 1–1.
   - Q2 and the Final fill in as series finish.
7. **Practice:** add games any time under **Practice**. They have their own table and stats and never affect the official table, playoffs or awards.

Editing or clearing any result recalculates everything, including the playoff bracket.

## Season 2 features

### Player accounts
1. Players tap **Sign in → Create account** with an email and password. There are no confirmation emails.
2. Organizers open **Admin → Claims**, click **Generate codes**, then **Copy codes for WhatsApp** and send each player their code.
3. On **My profile**, a player enters their code. Their profile becomes ✓ Verified, and they can add a photo, bio, role and socials. Stats always stay organizer-only.
4. Forgot password? Organizers reset it in **Admin → Claims**.

### Live auction
1. In **Admin → Seasons**, create Season 2 as an empty draft.
2. In **Admin → Auction**, create the auction for Season 2, then set:
   - The **rules**: purse, base price, bid steps, time per player, time added after each bid, the 3-2-1 countdown, auto-next, and the voice announcer.
   - The **teams and captains**. Captains need a claimed profile so they can log in and bid.
   - The **player pool**: "Add everyone with a claimed profile" (players can also register themselves on My profile), plus optional sets by career MVP.
3. **Do a dry run first.** On the auction's page, **Duplicate as practice** makes a copy with the same rules, teams, captains and pool, labelled **PRACTICE**. A practice copy never creates rosters or counts in stats. Run it, then **Restart from scratch** as often as you like, or delete it.
   - **Live-room controls:** **Stop auction** ends the session (the player on the block goes back to the pool, and results so far are kept). **Restart from scratch** puts everyone back in the pool.
4. On the day, everyone opens **/auction**:
   - The organizer draws players at random and can pause, sell now, mark unsold, undo, and run an unsold round.
   - Captains bid from their phones.
   - Put **Big screen** on a TV or stream it, and tap **Turn sound on** for the announcer.
5. **Finish auction & create rosters** fills Season 2's teams and rosters. Set Season 2 to Active when you're ready to show it.

The database enforces every bidding rule: purse, squad size, minimum next bid, timer, one bid at a time.

### Also new
- **Hall of Fame:** champions, award winners, records.
- **Head-to-head compare:** two players side by side, including their games against each other.
- **Auction value stats:** most expensive buy, "steal of the auction" (MVP points per 100 credits) and team spend.

### Environments
- **Staging:** the `wow-league-staging` Supabase project (`.env.staging.local`), used by local dev and the `season-2` Vercel preview. Run against it with:
  ```bash
  set -a; source .env.staging.local; set +a; npm run dev
  ```
- **Production:** the "Pubg tournament" project (`.env.local`).
- **Release order:**
  1. Back up production.
  2. Run `npx supabase link --project-ref <prod ref>`, then `npx supabase db push`.
  3. Enable sign-ups (auto-confirm).
  4. Add `SUPABASE_SERVICE_ROLE_KEY` (sensitive) to Vercel Production.
  5. Merge to `main`.

## How the table is ranked

| | |
|---|---|
| Points | Every map is its own match. Win = 2 pts (configurable) |
| **NRR** (Net Round Rate) | (rounds won − rounds lost) ÷ rounds played. Works like cricket's NRR and is fair across 21- and 23-round maps |
| **NKR** (Net Kill Rate) | (kills − kills conceded) ÷ rounds played |
| Default tie-breaks | Points → NRR → NKR → head-to-head points → total kills (editable per season) |

**Q** / **E** marks appear once a team is mathematically sure to make, or miss, the top 4.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm test` | League engine unit tests: schedule, standings, tie-breaks, playoffs, careers |
| `npm run typecheck` | TypeScript check |
| `npm run admin:add` / `admin:list` / `admin:remove` | Manage organizer logins (bound to the account's user id) |
| `npm run db:setup` / `db:demo` / `db:wipe` | Database setup without the CLI, load demo data, delete all league data |

## Project layout

```
supabase/migrations/      tables, row-level security, save/schedule functions
src/lib/engine/           pure league logic (no I/O): schedule, standings, playoffs, players
src/lib/data.ts           loads the league from Supabase (or demo data)
src/app/(site)/           public pages
src/app/admin/            admin panel + server actions
scripts/db.ts             db:setup / db:demo / db:wipe
scripts/admin.ts          admin:add / admin:list / admin:remove
```

The database stores only raw results (games + per-player kills/revives). Tables, NRR/NKR, awards and careers are computed on every request, so they can never drift out of sync.
