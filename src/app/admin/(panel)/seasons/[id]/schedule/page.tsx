import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { FixturePlanner, type PlannerGame, type PlannerTeam } from "@/components/admin/fixture-planner";
import { PlayoffFormatChoice } from "@/components/admin/playoff-format-choice";
import { Field, NativeSelect, Panel, TextField } from "@/components/admin/fields";
import { TeamLogo } from "@/components/team";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dateAnswers, loadCommunity, matchDaysFor } from "@/lib/community";
import { loadLeague } from "@/lib/data";
import { filterGames, isCalendarSeason, seasonMaps, seasonTeams, type GameView } from "@/lib/engine/league";
import { playoffFormat } from "@/lib/playoff-formats";
import { teamColor } from "@/lib/team-colors";
import { cn } from "@/lib/utils";
import { dateKey, fmtLongDate, toZonedInput, tzLabel } from "@/lib/time";
import { STAGE_LABELS, type Team } from "@/lib/types";
import { assignTimes, generateOfficialSchedule, saveGamePlan, setPlayoffFormat, updateGame } from "../../../../actions";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function ScheduleAdmin({ params }: PageProps<"/admin/seasons/[id]/schedule">) {
  const { id } = await params;
  const [{ idx }, community] = await Promise.all([loadLeague(true), loadCommunity()]);
  const season = idx.seasonById.get(id)!;
  const calendarDays = matchDaysFor(community, id);
  const teams = seasonTeams(idx, id);
  const maps = seasonMaps(idx, id);
  const games = filterGames(idx, { seasonId: id, type: "official" });
  const locked = games.some((g) => g.completed);
  const n = teams.length;
  const pairings = (n * (n - 1)) / 2;
  const matchdaysPerRR = n % 2 === 0 ? n - 1 : n;

  // Seasons generated without matchdays (Season 2 onwards) are planned on the calendar.
  // Seasons that already have a matchday schedule (Season 1) keep the matchday tools below.
  const calendar = games.length === 0 || isCalendarSeason(idx, id);
  const format = playoffFormat(season);
  const playoffLocked = games.some((g) => g.fixture.stage !== "league" && g.completed);

  const groups = new Map<string, GameView[]>();
  for (const g of games) {
    const key =
      g.fixture.stage !== "league"
        ? STAGE_LABELS[g.fixture.stage]
        : calendar
          ? g.game.scheduled_at
            ? fmtLongDate(g.game.scheduled_at)
            : "Not on the calendar yet"
          : `Round Robin ${g.fixture.round_robin} · Matchday ${g.fixture.matchday}`;
    groups.set(key, [...(groups.get(key) ?? []), g]);
  }

  const rrCount = new Set(games.filter((g) => g.fixture.stage === "league").map((g) => g.fixture.round_robin)).size;
  const lite = (t: Team | null): PlannerTeam | null => (t ? { id: t.id, tag: t.tag, name: t.name, color: teamColor(t) } : null);
  const suggested = [...games].sort(
    (a, b) => Number(a.fixture.stage !== "league") - Number(b.fixture.stage !== "league") || a.fixture.sort_order - b.fixture.sort_order || a.game.game_no - b.game.game_no,
  );
  const plannerGames: PlannerGame[] = suggested.map((v, order) => ({
    id: v.game.id,
    fixtureId: v.fixture.id,
    group: v.fixture.stage === "league" ? (rrCount > 1 ? `Round Robin ${v.fixture.round_robin}` : "League") : "Playoffs",
    title: v.fixture.stage === "league" ? `${v.teamA?.name ?? "TBD"} vs ${v.teamB?.name ?? "TBD"}` : STAGE_LABELS[v.fixture.stage],
    sub: `${v.map?.name ?? "Map TBD"} · G${v.game.game_no}${v.fixture.stage !== "league" && v.game.game_no === 3 ? " (if 1–1)" : ""}`,
    teamA: lite(v.teamA),
    teamB: lite(v.teamB),
    at: v.game.scheduled_at ? toZonedInput(v.game.scheduled_at) : null,
    completed: v.completed,
    score: v.completed ? `${v.game.team_a_rounds}–${v.game.team_b_rounds}` : null,
    order,
  }));
  const available: Record<string, { yes: number; maybe: number }> = {};
  for (const answers of dateAnswers(community, id).values())
    for (const [day, status] of Object.entries(answers)) {
      available[day] ??= { yes: 0, maybe: 0 };
      if (status === "yes") available[day].yes++;
      if (status === "maybe") available[day].maybe++;
    }
  const today = dateKey(new Date().toISOString());

  return (
    <div className="space-y-6">
      <div className={cn("grid gap-6", !calendar && "lg:grid-cols-2")}>
        <Panel
          title={calendar ? "1. Generate fixtures" : "1. Generate the schedule"}
          description={
            calendar ? (
              <>
                {n} teams × {maps.length} map{maps.length === 1 ? "" : "s"}: each pair plays every map once per round robin ({pairings} pairings, {pairings * maps.length}{" "}
                games per round robin). Games are created without dates; you put each one on a date in the calendar below.
              </>
            ) : (
              <>
                {n} teams × {maps.length} map{maps.length === 1 ? "" : "s"}: each pair plays every map once per round robin ({pairings} pairings,{" "}
                {matchdaysPerRR} matchdays per round robin{n % 2 ? ", one team rests each matchday" : ""}).
              </>
            )
          }
        >
          {locked ? (
            <p className="text-sm text-muted-foreground">
              Locked because results have been entered. Clear all official results to regenerate. Individual games can still be edited below.
            </p>
          ) : n < 2 || maps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add at least 2 teams and 1 map first (
              <Link href={`/admin/seasons/${id}/teams`} className="text-primary">
                teams
              </Link>
              ,{" "}
              <Link href={`/admin/seasons/${id}`} className="text-primary">
                maps
              </Link>
              ).
            </p>
          ) : (
            <ActionForm
              action={generateOfficialSchedule.bind(null, id)}
              confirm={games.length ? "Replace the current schedule? All existing fixtures and times will be regenerated." : undefined}
              className="flex flex-wrap items-end gap-3"
            >
              <Field label="Round robins">
                <NativeSelect name="round_robins" defaultValue={String(season.round_robins)} className="w-72">
                  {[1, 2, 3].map((rr) => (
                    <option key={rr} value={rr}>
                      {rr} → {pairings * maps.length * rr} league games{calendar ? "" : `, ${matchdaysPerRR * rr} matchdays`}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              {calendar && games.length === 0 && <PlayoffFormatChoice current={format.id} teamCount={n} />}
              <Button type="submit">{games.length ? "Regenerate" : calendar ? "Generate fixtures" : "Generate schedule"}</Button>
              {calendar ? (
                <p className="w-full text-xs text-muted-foreground">
                  {games.length ? `Playoffs: ${format.label}. ` : ""}Every playoff series is best of 3 and fills in as the league finishes.
                </p>
              ) : n >= 4 ? (
                <p className="w-full text-xs text-muted-foreground">Playoffs (Q1, Eliminator, Q2, Final, best of 3) are added automatically and fill in as the league finishes.</p>
              ) : (
                <p className="w-full text-xs text-muted-foreground">Playoffs need at least 4 teams.</p>
              )}
            </ActionForm>
          )}
          {calendar && games.length > 0 && !playoffLocked && (
            <ActionForm
              action={setPlayoffFormat.bind(null, id)}
              confirm="Rebuild the playoff series in this format? Playoff games are recreated (their dates are cleared); league games and dates stay as they are."
              className="mt-6 grid gap-3 border-t pt-5"
            >
              <div>
                <div className="font-heading text-sm font-bold tracking-wide uppercase">Change the playoff format</div>
                <p className="text-xs text-muted-foreground">Keeps every league game and its date; only the playoff series are rebuilt.</p>
              </div>
              <PlayoffFormatChoice current={format.id} teamCount={n} />
              <Button type="submit" variant="secondary" className="justify-self-start">
                Update playoffs
              </Button>
            </ActionForm>
          )}
        </Panel>

        {!calendar && (
          <Panel title="2. Set dates & times" description={`Fills the games in order into your match days and time slots (${tzLabel()}).`}>
            {games.length === 0 ? (
              <p className="text-sm text-muted-foreground">Generate the schedule first.</p>
            ) : (
              <ActionForm action={assignTimes.bind(null, id)} className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Start date"
                    name="start_date"
                    type="date"
                    required={calendarDays.length === 0}
                    hint={calendarDays.length ? "Optional with match days: starts on the first one" : undefined}
                  />
                  <TextField label="Time slots" name="slots" defaultValue="19:00, 19:40, 20:20, 21:00" hint="Comma-separated, 24h" required />
                </div>
                {calendarDays.length > 0 && (
                  <Label className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm font-normal">
                    <Checkbox name="use_match_days" defaultChecked /> Only on the season&apos;s {calendarDays.length} match days (from the calendar)
                  </Label>
                )}
                <Field label={calendarDays.length ? "Days of the week (when not using match days)" : "Match days"}>
                  <div className="flex flex-wrap gap-3">
                    {WEEKDAYS.map((d, i) => (
                      <Label key={d} className="flex items-center gap-1.5 text-sm font-normal">
                        <Checkbox name="weekday" value={String(i)} defaultChecked /> {d}
                      </Label>
                    ))}
                  </div>
                </Field>
                <div className="grid gap-2 text-sm">
                  <Label className="flex items-center gap-2 font-normal">
                    <Checkbox name="new_day" defaultChecked /> Start each matchday on a new day
                  </Label>
                  <Label className="flex items-center gap-2 font-normal">
                    <Checkbox name="only_unplayed" defaultChecked /> Only games without a result
                  </Label>
                  <Label className="flex items-center gap-2 font-normal">
                    <Checkbox name="playoffs" defaultChecked /> Include playoffs (one series per day after the league)
                  </Label>
                </div>
                <Button type="submit" className="justify-self-start">
                  Apply times
                </Button>
              </ActionForm>
            )}
          </Panel>
        )}
      </div>

      {calendar && games.length > 0 && (
        <Panel
          title="2. Plan the calendar"
          description="Put each game on a date. Red-bordered dates are the season's match days; the green number is how many players said they can play. Nothing changes on the public site until you save."
        >
          <FixturePlanner
            key={`${plannerGames.length}:${plannerGames[0]?.id}`}
            action={saveGamePlan.bind(null, id)}
            games={plannerGames}
            matchDays={calendarDays.map((d) => ({ day: d.day, label: d.label }))}
            available={available}
            today={today}
            tz={tzLabel()}
          />
        </Panel>
      )}

      {[...groups.entries()].map(([title, list]) => (
        <Panel key={title} title={title}>
          <ul className="divide-y">
            {list.map((v) => (
              <li key={v.game.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="w-28 text-sm font-medium">{v.label.replace(/^.*· /, "")}</div>
                <div className="flex min-w-48 flex-1 items-center gap-2 text-sm">
                  <TeamLogo team={v.teamA} size="xs" />
                  {v.teamA?.name ?? <i className="text-muted-foreground">TBD</i>}
                  {v.completed ? (
                    <b className="tabular">
                      {v.game.team_a_rounds}–{v.game.team_b_rounds}
                    </b>
                  ) : (
                    <span className="text-muted-foreground">vs</span>
                  )}
                  <TeamLogo team={v.teamB} size="xs" />
                  {v.teamB?.name ?? <i className="text-muted-foreground">TBD</i>}
                </div>
                <ActionForm action={updateGame.bind(null, v.game.id)} className="flex flex-wrap items-center gap-2">
                  <Input type="datetime-local" name="scheduled_at" defaultValue={toZonedInput(v.game.scheduled_at)} className="h-8 w-52 text-xs" />
                  <NativeSelect name="map_id" defaultValue={v.game.map_id ?? ""} className="h-8 w-40 text-xs">
                    <option value="">Map TBD</option>
                    {v.map && !maps.some((m) => m.id === v.map!.id) && (
                      // Removed from the pool since: keep it selectable so saving the row doesn't clear it.
                      <option value={v.map.id}>
                        {v.map.name} ({v.map.total_rounds}R, not in pool)
                      </option>
                    )}
                    {maps.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.total_rounds}R)
                      </option>
                    ))}
                  </NativeSelect>
                  <Button type="submit" size="sm" variant="secondary">
                    Save
                  </Button>
                </ActionForm>
                {v.completed ? <Badge variant="secondary">Done</Badge> : null}
                <Button asChild size="sm" variant={v.completed ? "outline" : "default"} disabled={!v.teamA || !v.teamB}>
                  <Link href={`/admin/games/${v.game.id}`}>{v.completed ? "Edit result" : "Enter result"}</Link>
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  );
}
