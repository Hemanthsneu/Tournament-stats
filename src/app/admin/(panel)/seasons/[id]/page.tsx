import { ArrowDown, ArrowUp, Trash2 } from "@/components/icons";
import { ActionButton, ActionForm } from "@/components/admin/action-form";
import { Field, NativeSelect, Panel, TextField } from "@/components/admin/fields";
import { Button } from "@/components/ui/button";
import { loadLeague } from "@/lib/data";
import { seasonMaps } from "@/lib/engine/league";
import { TIEBREAK_LABELS, type TiebreakKey } from "@/lib/types";
import { addSeasonMap, deleteSeason, moveSeasonMap, removeSeasonMap, updateMap, updateSeason } from "../../../actions";

export default async function SeasonSettings({ params }: PageProps<"/admin/seasons/[id]">) {
  const { id } = await params;
  const { idx } = await loadLeague(true);
  const season = idx.seasonById.get(id)!;
  const maps = seasonMaps(idx, id);
  const tiebreaks = Object.keys(TIEBREAK_LABELS) as TiebreakKey[];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Season settings">
        <ActionForm action={updateSeason.bind(null, id)} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Name" name="name" defaultValue={season.name} required />
            <Field label="Status" hint="Draft seasons are hidden from the public site.">
              <NativeSelect name="status" defaultValue={season.status}>
                <option value="draft">Draft (hidden)</option>
                <option value="active">Active (current season)</option>
                <option value="completed">Completed</option>
              </NativeSelect>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Points per map win" name="points_win" type="number" min={0} defaultValue={season.points_win} />
            <TextField label="Points per map loss" name="points_loss" type="number" min={0} defaultValue={season.points_loss} />
          </div>
          <Field label="Tie-breakers (after points, in order)">
            <div className="grid gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <NativeSelect key={i} name={`tb${i}`} defaultValue={season.tiebreak_order[i - 1] ?? ""}>
                  <option value="">{i}. —</option>
                  {tiebreaks.map((k) => (
                    <option key={k} value={k}>
                      {i}. {TIEBREAK_LABELS[k]}
                    </option>
                  ))}
                </NativeSelect>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="MVP points per kill" name="mvp_kill_weight" type="number" step="0.1" min={0} defaultValue={season.mvp_kill_weight} />
            <TextField label="MVP points per revive" name="mvp_revive_weight" type="number" step="0.1" min={0} defaultValue={season.mvp_revive_weight} />
          </div>
          <Button type="submit">Save settings</Button>
        </ActionForm>
      </Panel>

      <div className="space-y-6">
        <Panel
          title="Map pool"
          description="Every pair of teams plays each of these maps once per round robin. The first two maps are also used for the playoff series."
        >
          {maps.length === 0 && <p className="mb-4 text-sm text-muted-foreground">No maps yet.</p>}
          <div className="space-y-3">
            {maps.map((m, i) => (
              <div key={m.id} className="rounded-lg border p-3">
                <ActionForm action={updateMap.bind(null, m.id)} className="grid grid-cols-[1fr_1fr_5rem_auto] items-end gap-2">
                  <TextField label="Map name" name="name" defaultValue={m.name} />
                  <TextField label="WOW map ID" name="wow_map_id" defaultValue={m.wow_map_id ?? ""} />
                  <TextField label="Rounds" name="total_rounds" type="number" min={1} defaultValue={m.total_rounds} />
                  <Button type="submit" size="sm" variant="secondary">
                    Save
                  </Button>
                </ActionForm>
                <div className="mt-2 flex gap-1">
                  <ActionButton action={moveSeasonMap.bind(null, id, m.id, -1)} size="icon-xs" variant="ghost" title="Move up">
                    <ArrowUp />
                  </ActionButton>
                  <ActionButton action={moveSeasonMap.bind(null, id, m.id, 1)} size="icon-xs" variant="ghost" title="Move down">
                    <ArrowDown />
                  </ActionButton>
                  <span className="ml-1 self-center text-xs text-muted-foreground">Map {i + 1}</span>
                  <ActionButton
                    action={removeSeasonMap.bind(null, id, m.id)}
                    confirm={`Remove ${m.name} from this season? Existing games keep it.`}
                    size="icon-xs"
                    variant="ghost"
                    className="ml-auto text-loss"
                    title="Remove"
                  >
                    <Trash2 />
                  </ActionButton>
                </div>
              </div>
            ))}
          </div>
          <ActionForm action={addSeasonMap.bind(null, id)} resetOnSuccess className="mt-4 grid grid-cols-[1fr_1fr_5rem_auto] items-end gap-2 border-t pt-4">
            <TextField label="New map name" name="name" placeholder="e.g. Neon Rooftops" required />
            <TextField label="WOW map ID" name="wow_map_id" placeholder="e.g. 21990412" />
            <TextField label="Rounds" name="total_rounds" type="number" min={1} defaultValue={21} />
            <Button type="submit" size="sm">
              Add
            </Button>
          </ActionForm>
        </Panel>

        <Panel title="Danger zone">
          <ActionButton
            action={deleteSeason.bind(null, id)}
            confirm={`Delete ${season.name} with ALL its fixtures, results and rosters? This cannot be undone.`}
            variant="destructive"
          >
            Delete season
          </ActionButton>
        </Panel>
      </div>
    </div>
  );
}
