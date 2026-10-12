# PUBG Mobile / BGMI WOW League — Project Plan

## Goal
A public website for our PUBG Mobile / BGMI **WOW mode** league, covering every season. It shows:
- The points table, with NRR-style metrics
- An auto-generated schedule and live results
- An auto-planned playoff bracket
- A separate **practice** section
- Teams and awards
- A **career profile for every player** across all seasons and teams

The **admin panel** is where organizers add teams and players, generate the schedule, and enter results. Everything else is calculated automatically.

---

## 1. How WOW mode works (and what we record)
- Two teams with an **equal number of players on each side** (anywhere from **4v4 to 8v8**, chosen per game) spawn at custom locations on the map.
- A map has **21 or 23 rounds**. A team wins a round by **eliminating the entire other team**.
- The team that wins **more rounds wins the map**. With an odd number of rounds, there are no draws.

**Recorded for every map game:**
- Map (name + WOW map ID)
- Squad size (e.g. 6v6)
- Rounds won by each team (e.g. 12–9)
- Players who played on each side
- Each player's **kills** and **revives**

## 2. Seasons, teams, players, and maps
- **Seasons** (S1, S2, …): each season has its own teams, rosters, map pool, schedule, table, playoffs, and awards.
- **Each player has one permanent profile.** You add a player once. Each season you place them on a team.
  - Players can change teams **between seasons** or **mid-season** (transfers).
  - Every stat records **the team the player was on in that game**, so history stays correct.
  - **IGN changes:** the profile stays the same, old IGNs are kept as aliases (and are searchable), and an optional BGMI UID prevents duplicates.
- **Rosters can be any size.** A team can have more players than play in a single game.
- **Teams are permanent.** They can join or skip seasons and keep their full history.
- **Maps change every season.** Each season has a **map pool**: map name, **WOW map ID**, and number of rounds (21 or 23). The map ID is shown on the schedule so players can load it.

## 3. Official vs practice

| | **Official** | **Practice** |
|---|---|---|
| Counts toward the points table and playoffs | Yes | No. Practice has its own separate table |
| Awards | Season awards | Separate practice leaderboards |
| Scheduling | Auto-generated round robin | Added any time: any pairing, any number of maps |
| On player and team profiles | **Official / Practice / All** toggle | Same |

Both use the same result-entry form.

## 4. Schedule generator (admin)
1. **Add teams** to the season (player rosters can come later)
2. **Pick the number of round robins:** 1, 2, or 3
3. **Pick the season's maps** (e.g. Map A, 21 rounds, ID `xxxx`; Map B, 23 rounds, ID `yyyy`)
4. **Generate.** In every round robin, **each pair of teams plays every map in the pool once.**
   - Games are grouped into **matchdays** so that no team plays twice on the same matchday.
   - With an odd number of teams, one team rests on each matchday.
   - Map order alternates between round robins, so no team always starts on the same map.
5. **Preview** the full schedule, then set the dates and times. Bulk options: start date, match days of the week, and time slots. Individual games can be swapped or moved afterwards.
6. **Publish.** The schedule can be regenerated until the first result is entered, then it locks. Individual games can still be edited.

**Examples:**
- Season 1 with 5 teams, 2 maps, and 2 round robins:
  - 10 pairings × 2 maps × 2 round robins = **40 league games**
  - Each team plays 16 games
  - 10 matchdays (5 per round robin, one team resting each matchday)
- The generator handles **any number of teams** (minimum 4, because the playoffs need 4). For example, 6 teams, 2 maps, and 3 round robins = 90 league games.

**The schedule updates live as results are published:**
- Completed games show the score (12–9) and the winner, with a link to the match page
- The **Up next** game is highlighted on the Home and Schedule pages
- Every team page shows its remaining schedule

## 5. Points table and ranking metrics

| Pos | Team | P | W | L | Pts | **NRR** | RW | RL | Kills | Kills Conceded | **NKR** | Revives | Form |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Team A | 16 | 12 | 4 | 24 | **+0.125** | 180 | 140 | 412 | 355 | **+0.178** | 96 | W W L W W |

- **P / W / L:** map games played, won, and lost. **Every map is its own match**, and a win = **2 pts**. Beating a team on both maps = 4 pts, and a 1–1 split = 2 pts each.
- **RW / RL:** rounds won and lost

**Metrics (our version of cricket's NRR):**

| Metric | Formula | What it tells you |
|---|---|---|
| **NRR (Net Round Rate)** | (RW − RL) ÷ rounds played | How dominant a team is in rounds. The per-round measure is fair across 21- and 23-round maps. E.g. 180 won, 140 lost of 320 = **+0.125** |
| **NKR (Net Kill Rate)** | (Kills − Kills Conceded) ÷ rounds played | Average kill margin per round. Kills conceded = the opponent's kills in those games |
| Round Win % | RW ÷ rounds played | Share of all rounds won |
| Kills / Revives | Team totals | Shown in the table and used in team awards |

- **Default tie-breaker order:** Points → **NRR** → **NKR** → Head-to-head points → Total kills
  - The order is editable in season settings
- **Mobile view:** the main columns (Pos, Team, P, W, L, Pts, NRR) are always shown. Tap a row to see kills, revives, NKR, and form.
- **Highlights:**
  - Top 2 (two chances in the playoffs) and top 4 (qualified) are highlighted
  - Teams that can no longer reach the top 4 are marked "E" (eliminated)
  - Qualified teams are marked "Q" once they're mathematically certain
- **"Playoff picture if the league ended today"** is shown under the table during the league
- The **practice table** uses the same columns and metrics, and only counts practice games

## 6. Playoffs (IPL style, best of 3, planned automatically)

| Series | Teams | Result |
|---|---|---|
| Qualifier 1 | 1st vs 2nd | Winner → Final, loser → Qualifier 2 |
| Eliminator | 3rd vs 4th | Winner → Qualifier 2, loser out |
| Qualifier 2 | Loser Q1 vs Winner Eliminator | Winner → Final |
| **Final** | Winner Q1 vs Winner Q2 | Champion |

- **Every series is best of 3.** Both season maps are played. If it's 1–1, a **decider** is played on a map chosen by the higher seed.
- **Automatic planning:**
  - Q1 and the Eliminator are created from the final league table when the last league game is published
  - The decider game is only added if a series is 1–1
  - Qualifier 2 and the Final fill in as soon as the earlier series finish
- The bracket page shows series scores (2–1), each game's score, and "TBD" slots until they're decided

## 7. Awards and leaderboards

| Award | Based on |
|---|---|
| **Top Fragger** | Most kills |
| **Best Support** | Most revives |
| **Season MVP** | MVP score = kills × 1 + revives × 1 (weights editable) |
| **Player of the Match** | Every official map game. Auto-suggested as the top MVP score on the winning team; admin can override |
| Most POTM awards | Count of POTMs |
| Best Average | Kills per game (must have played in at least half of their team's games) |
| Team: Most Kills / Most Revives | Team totals |

**Filters:**
- Season (S1, S2, …, **All-time**)
- Match type (Official / Practice)
- Stage (League / Playoffs)

## 8. Player career profile
- **Header:** IGN, current team, career totals (games, kills, revives, MVP score, POTM awards, titles)
- **Team history:** a timeline such as S1 · Team A → S2 · Team B
- **Season-by-season table:**

  | Season | Team | Games | Kills | Revives | Avg Kills | POTM | Team finish |
  |---|---|---|---|---|---|---|---|
  | S2 | Team B | 18 | 82 | 24 | 4.6 | 3 | Champion |
  | S1 | Team A | 16 | 61 | 18 | 3.8 | 1 | 3rd |

- **Game log:** every game with season, team, opponent, map, squad size, result, kills, and revives
- **Official / Practice / All** toggle

## 9. Public pages

| Page | What it shows |
|---|---|
| **Season switcher** (in the header) | Defaults to the current season |
| **Home** | Up next, latest results, top 4 of the table, award leaders |
| **Points Table** | The official table with metrics, plus the playoff picture |
| **Schedule & Results** | Grouped by matchday, with tabs for each round robin and the playoffs. Shows each game's map name and ID, time, score, and POTM |
| **Playoffs** | Bracket with series scores |
| **Practice** | Practice table, results, and leaderboards |
| **Match page** | Score, map, squad size, both lineups with kills and revives, POTM |
| **Teams** | Rosters by season, record by season, upcoming games, results, all-time stats |
| **Players** | Search all players (including old IGNs). Links to the career profile |
| **Stats & Awards** | Award cards plus full leaderboards |

## 10. Admin panel (organizers only)
- **Login.** Only organizers can edit.
- **Players:** add each player once (IGN, optional BGMI UID, real name, photo). IGN edits keep the old name as an alias.
- **Teams:** name, tag, logo
- **Seasons: "Start new season" wizard**
  1. Copy last season's teams and rosters as a starting point
  2. Move players between teams, add new players, remove players who left
  3. Add the season's maps (name, WOW map ID, rounds)
  4. Set points per win and the tie-breaker order
  5. Run the **schedule generator** (section 4)
- **Transfers:** move a player mid-season. Past games stay with their old team.
- **Practice:** add practice games any time
- **Result entry** (the same form for official and practice games):
  1. Pick the game from the schedule (the "Up next" game is pre-selected)
  2. Pick the squad size (4v4 to 8v8) and tick who played on each side. Validation: both sides must have exactly that many players.
  3. Enter rounds won by each team. Validation: no tie, and the total can't exceed the map's rounds.
  4. Enter kills and revives for each player
  5. Confirm POTM (official games only)
  6. **Publish.** The schedule, table, metrics, bracket, leaderboards, team pages, and career profiles all update instantly.
- **Corrections:** editing any result recalculates everything, including playoff seeding if it's still in the league stage

## 11. Data model
```
Season          (id, number, name, status, round_robins, points_win, points_loss,
                 tiebreak_order, mvp_weights)
Team            (id, name, tag, logo_url)                                -- permanent
SeasonTeam      (season_id, team_id, seed?)                              -- teams in a season
Player          (id, ign, bgmi_uid?, real_name?, photo_url?)             -- permanent, one per person
PlayerAlias     (player_id, old_ign, changed_on)
RosterEntry     (season_id, team_id, player_id, joined_on, left_on?)
Map             (id, name, wow_map_id, total_rounds)                     -- 21 or 23
SeasonMap       (season_id, map_id, order)                               -- the season's map pool
Fixture         (id, season_id, type: official|practice, stage,
                 round_robin?, matchday?, team_a_id?, team_b_id?,        -- null = TBD (playoffs)
                 format: league | best_of_3 | practice, status)
                 -- stage: league | qualifier_1 | eliminator | qualifier_2 | final | practice
Game            (id, fixture_id, game_no, map_id, scheduled_at, squad_size,
                 team_a_rounds, team_b_rounds, status, potm_player_id?)
PlayerGameStat  (game_id, player_id, team_id, kills, revives)            -- team they played for in that game
```
- **Fixture** = a pairing of two teams (a league pairing within a round robin, a playoff series, or a practice session)
- **Game** = one map played. Points are awarded per game in the league, and playoff series are decided by games won.
- **No totals are stored.** The table, NRR/NKR, bracket, awards, and career stats are all calculated from `Game` + `PlayerGameStat`, so they're always correct and up to date.

## 12. Tech stack
- **Next.js (App Router) + TypeScript:** public site and admin in one app
- **Tailwind CSS + shadcn/ui:** dark esports theme, mobile-first
- **Supabase:** Postgres database, admin login, realtime updates
- **Vercel:** free hosting, deploys on every push

## 13. Build phases

### Phase 1: Core (everything needed to run the league)
1. Scaffold Next.js + Tailwind + shadcn/ui, with sample data:
   - 2 seasons, with players changing teams between them
   - 5 teams, 2 maps, 2 round robins
   - Mixed squad sizes and some practice games
2. **League engine** with unit tests:
   - Schedule generator (any team count, 1–3 round robins, every map per pairing, matchdays with rests)
   - Points, NRR, NKR, and tie-breakers
   - Q/E qualification markers
   - Best-of-3 playoff planning
   - Awards and MVP
   - Career stats
   - Official/practice separation
3. Public pages: all pages in section 9
4. Connect Supabase: schema, admin login
5. Admin: players, teams, new-season wizard, rosters and transfers, maps, schedule generator, practice, result entry
6. Deploy to Vercel

### Phase 2: Polish
- Charts: table position over time, NRR trend, kills per game, career trend by season
- Records page: most kills in a game, biggest win (e.g. 12–0), longest win streak
- Live auto-refresh while results are being published
- Shareable result and points-table images for Instagram and WhatsApp
- OBS overlays for streaming

---

## Assumptions (tell me if any are wrong)
- Default tie-breaker order is Points → NRR → NKR → head-to-head → total kills (editable)
- The playoff decider map is chosen by the higher seed, and the admin records the choice
- Practice games are between league teams (a "guest" team can be added if outsiders play)
- POTM is awarded for every official map game, including playoff games

## Needed from you
- **Before Phase 1, step 4:** a free Supabase account and project (I'll walk you through it)
- **Whenever ready:** team names, logos, player IGNs (and BGMI UIDs if possible), Season 1 map names and WOW map IDs, and the start date and time slots. Sample data is used until then.

---

# Season 2 additions: player accounts, profile claiming, live auction

## 0. Ground rule: nothing existing changes
- **Additive only.** New tables, new pages and new admin sections. No existing table, column, row or page is modified. Season 1 (league, playoffs, stats) keeps running untouched.
- **Separate test environment.** Build on a git branch with its own **staging Supabase project**. Vercel preview deployments point at staging, so production is never touched while we build and test.
- **Backup before release.** Take a full data dump of production before the new migration goes live. The migration only *creates* things, so rolling back is just dropping the new tables.
- **Ships only after you approve.** You click through the preview link, then we merge to `main`.

## 1. Player accounts & claiming profiles
- **Sign-in:** a "Sign in" button in the site header opens a player login, separate from the organizer login.
- **Claiming:**
  1. A member signs in, searches their IGN, and taps **"This is me"**.
  2. The organizer approves the claim in Admin → Claims.
  3. One profile per account, and one account per profile.
- **Claimed profiles:**
  - Get a ✓ **Verified** badge on the public player page.
  - The player can edit their own **photo, bio, preferred role (Fragger / Support / IGL / Sniper) and socials** (Instagram / YouTube).
  - **They can never edit stats.** Stats stay organizer-only.
- **Season 2 registration:** a claimed player can mark **"I'm in for Season 2"**, which adds them to the auction pool.
- **Account help:** organizers can reset a player's password from the admin panel.

## 2. Live auction (IPL-style)
**Setup (Admin → Auction):**
- Season 2 teams, and a **captain** for each. The captain must have a claimed profile so they can log in.
- **Purse** per team (e.g. 1,000 credits), **base price**, **bid increments** (e.g. +10 up to 200, then +25), **bid timer** (e.g. 30 s, resets to 15 s on every bid), **min/max squad size**.
- **Player pool:** Season 2 registrations plus anyone the organizer adds. Captains are not in the pool; they're already on their team.
- **Optional sets:** Marquee / Set A / Set B (e.g. based on Season 1 MVP rank), each with its own base price. Players are drawn **at random within each set**.

**Live room (`/auction`, public, updates in real time):**
- **Current player card:** photo, role, Season 1 stats (kills, revives, MVP, K/G, POTM), career summary.
- **Bidding:** current bid, leading team, a big countdown, and the bid history.
- **Teams:** every team's purse left, slots left, and squad so far.
- **Log:** sold / unsold, with the price for each.

**Captain's room (captain logged in, on the same page):**
- **Bid +10 / +25** buttons.
- **Safety rule:** a captain can't bid more than they can afford while still filling the squad: *max bid = purse − (slots left − 1) × base price*.
- A private **shortlist** of players they want.

**Auctioneer controls (organizer):**
- Start, **draw next player (random)**, pause/resume, mark unsold, **undo last sale**.
- **Unsold round** at a lower base price.
- **Finish auction:** writes the Season 2 teams and rosters automatically.

**Fairness built in:**
- **Bids are checked on the server:** right captain, enough purse, room left in the squad, timer still running.
- **One bid at a time:** bids are processed in order, so two captains can't both win.
- **Same clock for everyone:** the timer runs on the server, so every phone sees the same countdown.

## 3. Suggested extras (pick any)
- **Prediction game:** signed-in members predict each match winner (and POTM). Points leaderboard all season.
- **Hall of Fame:** permanent page with every season's champion, MVP, Top Fragger, Best Support and auction record buy.
- **Head-to-head compare:** pick two players and see their stats side by side, across seasons.
- **Auction value stats:** "Steal of the auction" (MVP points per credit) and "Most expensive buy", plus team spend, updated as Season 2 games are played.
