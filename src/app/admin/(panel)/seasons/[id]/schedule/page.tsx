import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { Field, NativeSelect, Panel, TextField } from "@/components/admin/fields";
import { TeamLogo } from "@/components/team";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadLeague } from "@/lib/data";
import { filterGames, seasonMaps, seasonTeams, type GameView } from "@/lib/engine/league";
import { toZonedInput, tzLabel } from "@/lib/time";
import { STAGE_LABELS } from "@/lib/types";
import { assignTimes, generateOfficialSchedule, updateGame } from "../../../../actions";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function ScheduleAdmin({ params }: PageProps<"/admin/seasons/[id]/schedule">) {
  const { id } = await params;
  const { idx } = await loadLeague(true);
  const season = idx.seasonById.get(id)!;
  const teams = seasonTeams(idx, id);
  const maps = seasonMaps(idx, id);
  const games = filterGames(idx, { seasonId: id, type: "official" });
  const locked = games.some((g) => g.completed);
  const n = teams.length;
  const pairings = (n * (n - 1)) / 2;
  const matchdaysPerRR = n % 2 === 0 ? n - 1 : n;

  const groups = new Map<string, GameView[]>();
  for (const g of games) {
    const key = g.fixture.stage === "league" ? `Round Robin ${g.fixture.round_robin} · Matchday ${g.fixture.matchday}` : STAGE_LABELS[g.fixture.stage];
    groups.set(key, [...(groups.get(key) ?? []), g]);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="1. Generate the schedule"
          description={
            <>
              {n} teams × {maps.length} map{maps.length === 1 ? "" : "s"}: each pair plays every map once per round robin ({pairings} pairings,{" "}
              {matchdaysPerRR} matchdays per round robin{n % 2 ? ", one team rests each matchday" : ""}).
            </>
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
                      {rr} → {pairings * maps.length * rr} league games, {matchdaysPerRR * rr} matchdays
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Button type="submit">{games.length ? "Regenerate" : "Generate schedule"}</Button>
              {n >= 4 ? (
                <p className="w-full text-xs text-muted-foreground">Playoffs (Q1, Eliminator, Q2, Final, best of 3) are added automatically and fill in as the league finishes.</p>
              ) : (
                <p className="w-full text-xs text-muted-foreground">Playoffs need at least 4 teams.</p>
              )}
            </ActionForm>
          )}
        </Panel>

        <Panel title="2. Set dates & times" description={`Fills the games in order into your match days and time slots (${tzLabel()}).`}>
          {games.length === 0 ? (
            <p className="text-sm text-muted-foreground">Generate the schedule first.</p>
          ) : (
            <ActionForm action={assignTimes.bind(null, id)} className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Start date" name="start_date" type="date" required />
                <TextField label="Time slots" name="slots" defaultValue="19:00, 19:40, 20:20, 21:00" hint="Comma-separated, 24h" required />
              </div>
              <Field label="Match days">
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
      </div>

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
