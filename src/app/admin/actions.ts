"use server";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { int, must, optionalText, run, syncPlayoffs, text, UserError, type ActionResult } from "@/lib/admin";
import { fetchLeagueData } from "@/lib/data";
import { buildIndex, seasonMaps as poolMaps, seasonTeams as teamsOf } from "@/lib/engine/league";
import { generateSchedule } from "@/lib/engine/schedule";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSessionClient } from "@/lib/supabase/server";
import { fromZonedInput } from "@/lib/time";
import type { TiebreakKey } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function signIn(fd: FormData): Promise<ActionResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Supabase is not configured yet." };
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(fd.get("email") ?? "").trim(),
    password: String(fd.get("password") ?? ""),
  });
  if (error) return { ok: false, error: error.message };
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    await supabase.auth.signOut();
    return { ok: false, error: "Signed in, but this email is not on the organizer list." };
  }
  redirect("/admin");
}

export async function signOut(): Promise<void> {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

async function insertPlayer(db: SupabaseClient, fd: FormData, ignKey = "ign"): Promise<string> {
  const row = must(
    await db
      .from("players")
      .insert({
        ign: text(fd, ignKey, { required: "Enter the player's IGN." }),
        bgmi_uid: optionalText(fd, "bgmi_uid"),
        real_name: optionalText(fd, "real_name"),
        photo_url: optionalText(fd, "photo_url"),
      })
      .select("id")
      .single(),
  );
  return row.id as string;
}

export async function createPlayer(fd: FormData) {
  return run(async (db) => {
    await insertPlayer(db, fd);
    return `Added ${text(fd, "ign")}`;
  });
}

export async function updatePlayer(playerId: string, fd: FormData) {
  return run(async (db) => {
    const current = must(await db.from("players").select("ign").eq("id", playerId).single());
    const ign = text(fd, "ign", { required: "IGN can't be empty." });
    must(
      await db
        .from("players")
        .update({
          ign,
          bgmi_uid: optionalText(fd, "bgmi_uid"),
          real_name: optionalText(fd, "real_name"),
          photo_url: optionalText(fd, "photo_url"),
        })
        .eq("id", playerId),
    );
    if (current.ign !== ign) {
      must(await db.from("player_aliases").insert({ player_id: playerId, ign: current.ign }));
      return `Renamed ${current.ign} → ${ign} (old IGN kept as an alias)`;
    }
    return "Player updated";
  });
}

export async function deletePlayer(playerId: string) {
  return run(async (db) => {
    must(await db.from("players").delete().eq("id", playerId));
    return "Player deleted";
  });
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export async function createTeam(fd: FormData) {
  return run(async (db) => {
    const name = text(fd, "name", { required: "Enter a team name." });
    const team = must(
      await db
        .from("teams")
        .insert({ name, tag: text(fd, "tag", { required: "Enter a short tag (e.g. CV)." }).toUpperCase(), logo_url: optionalText(fd, "logo_url") })
        .select("id")
        .single(),
    );
    const seasonId = optionalText(fd, "season_id");
    if (seasonId) must(await db.from("season_teams").insert({ season_id: seasonId, team_id: team.id }));
    return `Added ${name}`;
  });
}

export async function updateTeam(teamId: string, fd: FormData) {
  return run(async (db) => {
    must(
      await db
        .from("teams")
        .update({
          name: text(fd, "name", { required: "Enter a team name." }),
          tag: text(fd, "tag", { required: "Enter a tag." }).toUpperCase(),
          logo_url: optionalText(fd, "logo_url"),
        })
        .eq("id", teamId),
    );
    return "Team updated";
  });
}

export async function deleteTeam(teamId: string) {
  return run(async (db) => {
    must(await db.from("teams").delete().eq("id", teamId));
    return "Team deleted";
  });
}

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

export async function createSeason(fd: FormData) {
  let newId: string | null = null;
  const res = await run(async (db) => {
    const number = int(fd, "number", { min: 1, label: "Season number" });
    const season = must(
      await db
        .from("seasons")
        .insert({
          number,
          name: text(fd, "name") || `Season ${number}`,
          status: "draft",
          round_robins: int(fd, "round_robins", { min: 1, max: 3, label: "Round robins" }),
        })
        .select("id")
        .single(),
    );
    newId = season.id;
    const copyFrom = optionalText(fd, "copy_from");
    if (copyFrom) {
      const teams = must(await db.from("season_teams").select("team_id").eq("season_id", copyFrom));
      if (teams.length) {
        must(await db.from("season_teams").insert(teams.map((t) => ({ season_id: season.id, team_id: t.team_id }))));
      }
      const roster = must(await db.from("roster_entries").select("team_id, player_id").eq("season_id", copyFrom).is("left_on", null));
      if (roster.length) {
        must(
          await db
            .from("roster_entries")
            .insert(roster.map((r) => ({ season_id: season.id, team_id: r.team_id, player_id: r.player_id, joined_on: today() }))),
        );
      }
      if (fd.get("copy_maps") === "on") {
        const maps = must(await db.from("season_maps").select("map_id, sort_order").eq("season_id", copyFrom));
        if (maps.length) must(await db.from("season_maps").insert(maps.map((m) => ({ ...m, season_id: season.id }))));
      }
    }
  });
  if (res.ok && newId) redirect(`/admin/seasons/${newId}/teams`);
  return res;
}

const TIEBREAKS: TiebreakKey[] = ["nrr", "nkr", "h2h", "kills", "round_win_pct", "revives"];

export async function updateSeason(seasonId: string, fd: FormData) {
  return run(async (db) => {
    const order = [1, 2, 3, 4, 5]
      .map((i) => String(fd.get(`tb${i}`) ?? ""))
      .filter((k): k is TiebreakKey => TIEBREAKS.includes(k as TiebreakKey));
    const status = text(fd, "status");
    if (!["draft", "active", "completed"].includes(status)) throw new UserError("Pick a status.");
    must(
      await db
        .from("seasons")
        .update({
          name: text(fd, "name", { required: "Enter a season name." }),
          status,
          points_win: int(fd, "points_win", { min: 0, label: "Points per win" }),
          points_loss: int(fd, "points_loss", { min: 0, label: "Points per loss" }),
          tiebreak_order: [...new Set(order)],
          mvp_kill_weight: Number(fd.get("mvp_kill_weight") ?? 1),
          mvp_revive_weight: Number(fd.get("mvp_revive_weight") ?? 1),
        })
        .eq("id", seasonId),
    );
    return "Season settings saved";
  });
}

export async function deleteSeason(seasonId: string) {
  const res = await run(async (db) => {
    must(await db.from("seasons").delete().eq("id", seasonId));
  });
  if (res.ok) redirect("/admin/seasons");
  return res;
}

// ---------------------------------------------------------------------------
// Season teams & rosters
// ---------------------------------------------------------------------------

export async function addSeasonTeam(seasonId: string, fd: FormData) {
  return run(async (db) => {
    const teamId = text(fd, "team_id", { required: "Pick a team." });
    must(await db.from("season_teams").insert({ season_id: seasonId, team_id: teamId }));
    return "Team added to the season";
  });
}

export async function removeSeasonTeam(seasonId: string, teamId: string) {
  return run(async (db) => {
    const fixtures = must(
      await db.from("fixtures").select("id").eq("season_id", seasonId).or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`),
    );
    if (fixtures.length) throw new UserError("This team already has games this season. Regenerate the schedule without it first.");
    must(await db.from("roster_entries").delete().eq("season_id", seasonId).eq("team_id", teamId));
    must(await db.from("season_teams").delete().eq("season_id", seasonId).eq("team_id", teamId));
    return "Team removed from the season";
  });
}

export async function addRosterPlayer(seasonId: string, teamId: string, fd: FormData) {
  return run(async (db) => {
    let playerId = optionalText(fd, "player_id");
    if (!playerId) {
      if (!optionalText(fd, "new_ign")) throw new UserError("Pick an existing player or type a new IGN.");
      playerId = await insertPlayer(db, fd, "new_ign");
    }
    must(
      await db.from("roster_entries").insert({
        season_id: seasonId,
        team_id: teamId,
        player_id: playerId,
        joined_on: optionalText(fd, "joined_on") ?? today(),
      }),
    );
    return "Player added to the roster";
  });
}

export async function releaseRosterEntry(entryId: string) {
  return run(async (db) => {
    must(await db.from("roster_entries").update({ left_on: today() }).eq("id", entryId));
    return "Player released. Their past games stay with this team.";
  });
}

export async function deleteRosterEntry(entryId: string) {
  return run(async (db) => {
    const entry = must(await db.from("roster_entries").select("season_id, team_id, player_id").eq("id", entryId).single());
    const idx = buildIndex(await fetchLeagueData());
    const hasGames = (idx.statsByPlayer.get(entry.player_id) ?? []).some(
      (s) => s.team_id === entry.team_id && idx.viewById.get(s.game_id)?.season.id === entry.season_id,
    );
    if (hasGames) throw new UserError("This player has games for the team this season. Use Release instead.");
    must(await db.from("roster_entries").delete().eq("id", entryId));
    return "Removed from roster";
  });
}

export async function transferPlayer(entryId: string, fd: FormData) {
  return run(async (db) => {
    const toTeam = text(fd, "to_team_id", { required: "Pick the new team." });
    const date = optionalText(fd, "date") ?? today();
    const entry = must(await db.from("roster_entries").select("season_id, team_id, player_id").eq("id", entryId).single());
    if (entry.team_id === toTeam) throw new UserError("The player is already on that team.");
    must(await db.from("roster_entries").update({ left_on: date }).eq("id", entryId));
    must(
      await db.from("roster_entries").insert({ season_id: entry.season_id, team_id: toTeam, player_id: entry.player_id, joined_on: date }),
    );
    return "Transfer done. Earlier games stay with the old team.";
  });
}

// ---------------------------------------------------------------------------
// Maps
// ---------------------------------------------------------------------------

function roundsFrom(fd: FormData): number {
  const rounds = int(fd, "total_rounds", { min: 1, max: 99, label: "Rounds" });
  if (rounds % 2 === 0) throw new UserError("Use an odd number of rounds (e.g. 21 or 23) so there are no draws.");
  return rounds;
}

export async function addSeasonMap(seasonId: string, fd: FormData) {
  return run(async (db) => {
    const map = must(
      await db
        .from("maps")
        .insert({ name: text(fd, "name", { required: "Enter the map name." }), wow_map_id: optionalText(fd, "wow_map_id"), total_rounds: roundsFrom(fd) })
        .select("id")
        .single(),
    );
    const existing = must(await db.from("season_maps").select("sort_order").eq("season_id", seasonId));
    const next = existing.reduce((m, r) => Math.max(m, r.sort_order + 1), 0);
    must(await db.from("season_maps").insert({ season_id: seasonId, map_id: map.id, sort_order: next }));
    return "Map added";
  });
}

export async function updateMap(mapId: string, fd: FormData) {
  return run(async (db) => {
    must(
      await db
        .from("maps")
        .update({ name: text(fd, "name", { required: "Enter the map name." }), wow_map_id: optionalText(fd, "wow_map_id"), total_rounds: roundsFrom(fd) })
        .eq("id", mapId),
    );
    return "Map updated";
  });
}

export async function removeSeasonMap(seasonId: string, mapId: string) {
  return run(async (db) => {
    must(await db.from("season_maps").delete().eq("season_id", seasonId).eq("map_id", mapId));
    return "Map removed from this season (existing games keep it)";
  });
}

export async function moveSeasonMap(seasonId: string, mapId: string, direction: -1 | 1) {
  return run(async (db) => {
    const rows = must(await db.from("season_maps").select("map_id, sort_order").eq("season_id", seasonId).order("sort_order"));
    const i = rows.findIndex((r) => r.map_id === mapId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= rows.length) return;
    const reordered = [...rows];
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
    for (const [k, r] of reordered.entries()) {
      must(await db.from("season_maps").update({ sort_order: k }).eq("season_id", seasonId).eq("map_id", r.map_id));
    }
  });
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export async function generateOfficialSchedule(seasonId: string, fd: FormData) {
  return run(async (db) => {
    const roundRobins = int(fd, "round_robins", { min: 1, max: 3, label: "Round robins" });
    const idx = buildIndex(await fetchLeagueData());
    const teams = teamsOf(idx, seasonId);
    const maps = poolMaps(idx, seasonId);
    const fixtures = generateSchedule({ teamIds: teams.map((t) => t.id), mapIds: maps.map((m) => m.id), roundRobins });
    must(await db.from("seasons").update({ round_robins: roundRobins }).eq("id", seasonId));
    must(await db.rpc("replace_official_schedule", { p_season_id: seasonId, p_fixtures: fixtures }));
    const leagueGames = fixtures.filter((f) => f.stage === "league").reduce((a, f) => a + f.games.length, 0);
    const matchdays = new Set(fixtures.map((f) => f.matchday).filter(Boolean)).size;
    return `Schedule created: ${leagueGames} league games over ${matchdays} matchdays${teams.length >= 4 ? " + playoffs" : ""}. Now set the dates.`;
  });
}

export async function assignTimes(seasonId: string, fd: FormData) {
  return run(async (db) => {
    const start = text(fd, "start_date", { required: "Pick a start date." });
    const weekdays = fd.getAll("weekday").map(Number);
    if (weekdays.length === 0) throw new UserError("Tick at least one match day of the week.");
    const slots = text(fd, "slots", { required: "Enter at least one time slot." })
      .split(/[,\s]+/)
      .filter(Boolean);
    for (const s of slots) if (!/^\d{1,2}:\d{2}$/.test(s)) throw new UserError(`"${s}" is not a time like 19:00.`);
    const newDayPerMatchday = fd.get("new_day") === "on";
    const onlyUnplayed = fd.get("only_unplayed") === "on";
    const includePlayoffs = fd.get("playoffs") === "on";

    const idx = buildIndex(await fetchLeagueData());
    const games = idx.views.filter((v) => v.season.id === seasonId && v.fixture.type === "official" && (!onlyUnplayed || !v.completed));

    let date = start;
    const isMatchDay = (d: string) => weekdays.includes(new Date(`${d}T12:00:00Z`).getUTCDay());
    const nextDay = (d: string) => {
      const x = new Date(`${d}T12:00:00Z`);
      x.setUTCDate(x.getUTCDate() + 1);
      return x.toISOString().slice(0, 10);
    };
    const advance = () => {
      do date = nextDay(date);
      while (!isMatchDay(date));
    };
    if (!isMatchDay(date)) advance();

    const updates: { id: string; scheduled_at: string }[] = [];
    let slot = 0;
    let groupKey: string | null = null;
    for (const v of games) {
      if (v.fixture.stage !== "league" && !includePlayoffs) continue;
      const key = v.fixture.stage === "league" ? `md${v.fixture.matchday}` : v.fixture.id;
      const newGroup = key !== groupKey;
      if ((newGroup && groupKey !== null && (newDayPerMatchday || v.fixture.stage !== "league")) || slot >= slots.length) {
        advance();
        slot = 0;
      }
      groupKey = key;
      const [h, m] = slots[slot++].split(":");
      updates.push({ id: v.game.id, scheduled_at: fromZonedInput(`${date}T${h.padStart(2, "0")}:${m}`)! });
    }
    for (let i = 0; i < updates.length; i += 10) {
      await Promise.all(
        updates.slice(i, i + 10).map(async (u) => must(await db.from("games").update({ scheduled_at: u.scheduled_at }).eq("id", u.id))),
      );
    }
    return `Scheduled ${updates.length} games (last one on ${date}).`;
  });
}

export async function updateGame(gameId: string, fd: FormData) {
  return run(async (db) => {
    const when = optionalText(fd, "scheduled_at");
    must(
      await db
        .from("games")
        .update({ scheduled_at: when ? fromZonedInput(when) : null, map_id: optionalText(fd, "map_id") })
        .eq("id", gameId),
    );
    return "Game updated";
  });
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface ResultPayload {
  map_id: string;
  squad_size: number;
  team_a_rounds: number;
  team_b_rounds: number;
  potm_player_id: string | null;
  stats: { player_id: string; team_id: string; kills: number; revives: number }[];
}

export async function saveResult(gameId: string, payload: ResultPayload) {
  return run(async (db) => {
    const idx = buildIndex(await fetchLeagueData());
    const view = idx.viewById.get(gameId);
    if (!view) throw new UserError("Game not found.");
    const { fixture } = view;
    if (!fixture.team_a_id || !fixture.team_b_id) throw new UserError("Both teams must be known before entering a result.");
    const map = idx.mapById.get(payload.map_id);
    if (!map) throw new UserError("Pick the map that was played.");

    const { squad_size: squad, team_a_rounds: a, team_b_rounds: b } = payload;
    if (!Number.isInteger(squad) || squad < 1 || squad > 16) throw new UserError("Pick the squad size.");
    if (![a, b].every((n) => Number.isInteger(n) && n >= 0)) throw new UserError("Rounds must be whole numbers.");
    if (a === b) throw new UserError("Rounds can't be equal. Every map has a winner.");
    if (a + b > map.total_rounds) throw new UserError(`${a + b} rounds entered, but ${map.name} only has ${map.total_rounds}.`);

    const seen = new Set<string>();
    for (const s of payload.stats) {
      if (seen.has(s.player_id)) throw new UserError("A player is listed twice.");
      seen.add(s.player_id);
      if (s.team_id !== fixture.team_a_id && s.team_id !== fixture.team_b_id) throw new UserError("Stats for a team not in this game.");
      if (![s.kills, s.revives].every((n) => Number.isInteger(n) && n >= 0)) throw new UserError("Kills and revives must be 0 or more.");
    }
    for (const [teamId, team] of [
      [fixture.team_a_id, view.teamA],
      [fixture.team_b_id, view.teamB],
    ] as const) {
      const count = payload.stats.filter((s) => s.team_id === teamId).length;
      if (count !== squad) throw new UserError(`${team?.name}: ${count} players ticked, but this is ${squad}v${squad}.`);
    }
    if (payload.potm_player_id && !seen.has(payload.potm_player_id)) throw new UserError("Player of the Match must be someone who played.");

    must(
      await db.rpc("save_game_result", {
        p_game_id: gameId,
        p_map_id: map.id,
        p_squad_size: squad,
        p_team_a_rounds: a,
        p_team_b_rounds: b,
        p_potm_player_id: fixture.type === "official" ? payload.potm_player_id : null,
        p_stats: payload.stats,
      }),
    );
    if (fixture.type === "official") await syncPlayoffs(db, fixture.season_id);
    return "Result published. Table, stats and bracket are updated.";
  });
}

export async function clearResult(gameId: string) {
  return run(async (db) => {
    const game = must(await db.from("games").select("fixture_id, fixtures!inner(season_id, type)").eq("id", gameId).single());
    must(await db.from("player_game_stats").delete().eq("game_id", gameId));
    must(
      await db
        .from("games")
        .update({ status: "scheduled", team_a_rounds: null, team_b_rounds: null, squad_size: null, potm_player_id: null })
        .eq("id", gameId),
    );
    const fx = game.fixtures as unknown as { season_id: string; type: string };
    if (fx.type === "official") await syncPlayoffs(db, fx.season_id);
    return "Result cleared";
  });
}

// ---------------------------------------------------------------------------
// Practice
// ---------------------------------------------------------------------------

export async function createPractice(fd: FormData) {
  return run(async (db) => {
    const seasonId = text(fd, "season_id", { required: "Pick a season." });
    const a = text(fd, "team_a_id", { required: "Pick team A." });
    const b = text(fd, "team_b_id", { required: "Pick team B." });
    if (a === b) throw new UserError("Pick two different teams.");
    const mapIds = fd.getAll("map_id").map(String).filter(Boolean);
    if (!mapIds.length) throw new UserError("Tick at least one map (one game per map).");
    const when = optionalText(fd, "scheduled_at");
    const start = when ? fromZonedInput(when) : null;
    const count = must(await db.from("fixtures").select("id").eq("season_id", seasonId).eq("type", "practice")).length;
    const fixture = must(
      await db
        .from("fixtures")
        .insert({ season_id: seasonId, type: "practice", stage: "practice", sort_order: count, team_a_id: a, team_b_id: b })
        .select("id")
        .single(),
    );
    must(
      await db.from("games").insert(
        mapIds.map((mapId, i) => ({
          fixture_id: fixture.id,
          game_no: i + 1,
          map_id: mapId,
          scheduled_at: start ? new Date(new Date(start).getTime() + i * 45 * 60_000).toISOString() : null,
        })),
      ),
    );
    return `Practice added (${mapIds.length} game${mapIds.length > 1 ? "s" : ""})`;
  });
}

export async function deletePracticeFixture(fixtureId: string) {
  return run(async (db) => {
    must(await db.from("fixtures").delete().eq("id", fixtureId).eq("type", "practice"));
    return "Practice deleted";
  });
}
