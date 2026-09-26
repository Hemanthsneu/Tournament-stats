import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { Field, NativeSelect, Panel, TextField } from "@/components/admin/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { loadLeague } from "@/lib/data";
import { filterGames, seasonTeams, sortedSeasons } from "@/lib/engine/league";
import { createSeason } from "../../actions";

export const metadata = { title: "Seasons · Admin" };

export default async function SeasonsAdmin() {
  const { idx } = await loadLeague(true);
  const seasons = sortedSeasons(idx.data);
  const nextNumber = (seasons[0]?.number ?? 0) + 1;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Panel title="Seasons" className="lg:col-span-3">
        {seasons.length === 0 ? (
          <p className="text-sm text-muted-foreground">No seasons yet.</p>
        ) : (
          <ul className="divide-y">
            {seasons.map((s) => {
              const games = filterGames(idx, { seasonId: s.id, type: "official" });
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Link href={`/admin/seasons/${s.id}`} className="font-semibold hover:text-primary">
                    {s.name}
                  </Link>
                  <Badge variant="outline">{s.status}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {seasonTeams(idx, s.id).length} teams · {games.filter((g) => g.completed).length}/{games.length} games
                  </span>
                  <div className="ml-auto flex gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/seasons/${s.id}/teams`}>Teams & rosters</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/seasons/${s.id}/schedule`}>Schedule</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <Panel
        title="Start a new season"
        description="Copying the previous season brings over its teams and current rosters. You can then move players around."
        className="lg:col-span-2"
      >
        <ActionForm action={createSeason} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Season number" name="number" type="number" min={1} defaultValue={nextNumber} required />
            <TextField label="Name" name="name" placeholder={`Season ${nextNumber}`} />
          </div>
          <Field label="Round robins" hint="You can change this when generating the schedule.">
            <NativeSelect name="round_robins" defaultValue="2">
              <option value="1">1 (every pair meets once per map)</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </NativeSelect>
          </Field>
          <Field label="Copy teams & rosters from">
            <NativeSelect name="copy_from" defaultValue={seasons[0]?.id ?? ""}>
              <option value="">Start empty</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Label className="flex items-center gap-2 text-sm font-normal">
            <Checkbox name="copy_maps" /> Also copy the map pool (maps usually change each season)
          </Label>
          <Button type="submit">Create season</Button>
        </ActionForm>
      </Panel>
    </div>
  );
}
