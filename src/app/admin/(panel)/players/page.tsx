import { ActionButton, ActionForm } from "@/components/admin/action-form";
import { Panel, TextField } from "@/components/admin/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadLeague } from "@/lib/data";
import { sortedSeasons } from "@/lib/engine/league";
import { createPlayer, deletePlayer, updatePlayer } from "../../actions";

export const metadata = { title: "Players · Admin" };

export default async function PlayersAdmin({ searchParams }: PageProps<"/admin/players">) {
  const { q: rawQ } = await searchParams;
  const q = (typeof rawQ === "string" ? rawQ : "").trim().toLowerCase();
  const { idx } = await loadLeague(true);
  const seasons = sortedSeasons(idx.data);
  const aliases = new Map<string, string[]>();
  for (const a of idx.data.aliases) aliases.set(a.player_id, [...(aliases.get(a.player_id) ?? []), a.ign]);
  const players = [...idx.data.players]
    .filter((p) => !q || [p.ign, p.bgmi_uid ?? "", p.real_name ?? "", ...(aliases.get(p.id) ?? [])].some((s) => s.toLowerCase().includes(q)))
    .sort((a, b) => a.ign.localeCompare(b.ign));

  const teamsFor = (playerId: string) =>
    seasons
      .map((s) => {
        const entries = idx.data.rosters.filter((r) => r.player_id === playerId && r.season_id === s.id);
        return entries.length ? `S${s.number}: ${entries.map((e) => idx.teamById.get(e.team_id)?.tag).join("→")}` : null;
      })
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Panel
        title="Add a player"
        description="Add each person once. Put them on a team from the season's Teams & rosters page. Their stats follow them everywhere."
        className="h-fit"
      >
        <ActionForm action={createPlayer} resetOnSuccess className="grid gap-3">
          <TextField label="IGN" name="ign" required />
          <TextField label="BGMI UID (optional, prevents duplicates)" name="bgmi_uid" inputMode="numeric" />
          <TextField label="Real name (optional)" name="real_name" />
          <TextField label="Photo URL (optional)" name="photo_url" />
          <Button type="submit">Add player</Button>
        </ActionForm>
      </Panel>
      <Panel title={`Players (${idx.data.players.length})`} className="lg:col-span-2">
        <form className="mb-4">
          <Input name="q" defaultValue={q} placeholder="Search IGN, old IGN, UID…" />
        </form>
        <ul className="divide-y">
          {players.map((p) => (
            <li key={p.id} className="py-2">
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{p.ign}</span>
                  {p.bgmi_uid && <span className="font-mono text-xs text-muted-foreground">{p.bgmi_uid}</span>}
                  {aliases.get(p.id) && <span className="text-xs text-muted-foreground">formerly {aliases.get(p.id)!.join(", ")}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">{teamsFor(p.id) || "No team yet"}</span>
                  <span className="text-xs text-primary">Edit</span>
                </summary>
                <ActionForm action={updatePlayer.bind(null, p.id)} className="mt-3 grid gap-2 rounded-lg border p-3 sm:grid-cols-4 sm:items-end">
                  <TextField label="IGN" name="ign" defaultValue={p.ign} required />
                  <TextField label="BGMI UID" name="bgmi_uid" defaultValue={p.bgmi_uid ?? ""} />
                  <TextField label="Real name" name="real_name" defaultValue={p.real_name ?? ""} />
                  <TextField label="Photo URL" name="photo_url" defaultValue={p.photo_url ?? ""} />
                  <div className="flex gap-2 sm:col-span-4">
                    <Button type="submit" size="sm">
                      Save
                    </Button>
                    <ActionButton action={deletePlayer.bind(null, p.id)} confirm={`Delete ${p.ign}? Only works if they have no games.`} variant="ghost" className="text-loss">
                      Delete
                    </ActionButton>
                  </div>
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
