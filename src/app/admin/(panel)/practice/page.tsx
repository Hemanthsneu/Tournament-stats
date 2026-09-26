import Link from "next/link";
import { ActionButton, ActionForm } from "@/components/admin/action-form";
import { Field, NativeSelect, Panel, TextField } from "@/components/admin/fields";
import { TeamLogo } from "@/components/team";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { loadLeague } from "@/lib/data";
import { currentSeason, filterGames, seasonMaps, seasonTeams, sortedSeasons } from "@/lib/engine/league";
import { fmtDateTime, tzLabel } from "@/lib/time";
import { createPractice, deletePracticeFixture } from "../../actions";

export const metadata = { title: "Practice · Admin" };

export default async function PracticeAdmin({ searchParams }: PageProps<"/admin/practice">) {
  const { season: seasonParam } = await searchParams;
  const { idx } = await loadLeague(true);
  const seasons = sortedSeasons(idx.data);
  const season = seasons.find((s) => s.id === seasonParam) ?? currentSeason(idx.data) ?? seasons[0];
  if (!season) return <p className="text-sm text-muted-foreground">Create a season first.</p>;

  const teams = seasonTeams(idx, season.id);
  const allTeams = teams.length ? teams : idx.data.teams;
  const maps = seasonMaps(idx, season.id);
  const games = filterGames(idx, { seasonId: season.id, type: "practice" });
  const fixtures = [...new Map(games.map((g) => [g.fixture.id, g.fixture])).values()].reverse();

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Panel title="Add a practice game" description="Practice never affects the official table, playoffs or awards. It has its own table and stats." className="h-fit">
        <form className="mb-4 flex gap-2">
          <NativeSelect name="season" defaultValue={season.id}>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" variant="outline">
            Switch
          </Button>
        </form>
        <ActionForm action={createPractice} className="grid gap-3">
          <input type="hidden" name="season_id" value={season.id} />
          <div className="grid grid-cols-2 gap-2">
            {(["team_a_id", "team_b_id"] as const).map((name, i) => (
              <Field key={name} label={i === 0 ? "Team A" : "Team B"}>
                <NativeSelect name={name} defaultValue="" required>
                  <option value="" disabled>
                    Pick…
                  </option>
                  {allTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ))}
          </div>
          <TextField label={`Start time (${tzLabel()})`} name="scheduled_at" type="datetime-local" />
          <Field label="Maps (one game per ticked map)">
            {maps.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add maps to {season.name} first.</p>
            ) : (
              <div className="grid gap-2">
                {maps.map((m) => (
                  <Label key={m.id} className="flex items-center gap-2 text-sm font-normal">
                    <Checkbox name="map_id" value={m.id} defaultChecked /> {m.name} ({m.total_rounds}R)
                  </Label>
                ))}
              </div>
            )}
          </Field>
          <Button type="submit">Add practice</Button>
        </ActionForm>
      </Panel>
      <Panel title={`${season.name} practice (${games.length} games)`} className="lg:col-span-2">
        {fixtures.length === 0 ? (
          <p className="text-sm text-muted-foreground">No practice games yet.</p>
        ) : (
          <ul className="divide-y">
            {fixtures.map((f) => {
              const list = games.filter((g) => g.fixture.id === f.id);
              const first = list[0];
              return (
                <li key={f.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <TeamLogo team={first.teamA} size="xs" /> {first.teamA?.tag}
                    <span className="text-muted-foreground">vs</span>
                    <TeamLogo team={first.teamB} size="xs" /> {first.teamB?.tag}
                  </div>
                  <span className="text-xs text-muted-foreground">{first.game.scheduled_at ? fmtDateTime(first.game.scheduled_at) : "No time"}</span>
                  <div className="ml-auto flex flex-wrap gap-2">
                    {list.map((g) => (
                      <Button key={g.game.id} asChild size="sm" variant={g.completed ? "outline" : "default"}>
                        <Link href={`/admin/games/${g.game.id}`}>
                          {g.map?.name ?? `Game ${g.game.game_no}`}
                          {g.completed ? ` · ${g.game.team_a_rounds}–${g.game.team_b_rounds}` : " · enter"}
                        </Link>
                      </Button>
                    ))}
                    <ActionButton action={deletePracticeFixture.bind(null, f.id)} confirm="Delete this practice session and its results?" variant="ghost" className="text-loss">
                      Delete
                    </ActionButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
