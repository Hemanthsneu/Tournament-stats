import { ActionButton, ActionForm } from "@/components/admin/action-form";
import { Panel, TextField } from "@/components/admin/fields";
import { TeamLogo } from "@/components/team";
import { Button } from "@/components/ui/button";
import { loadLeague } from "@/lib/data";
import { sortedSeasons } from "@/lib/engine/league";
import { createTeam, deleteTeam, updateTeam } from "../../actions";

export const metadata = { title: "Teams · Admin" };

export default async function TeamsAdmin() {
  const { idx } = await loadLeague(true);
  const seasons = sortedSeasons(idx.data);
  const teams = [...idx.data.teams].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Panel title="Create a team" description="To enter a team into a season, use the season's Teams & rosters page." className="h-fit">
        <ActionForm action={createTeam} resetOnSuccess className="grid gap-3">
          <TextField label="Team name" name="name" required />
          <TextField label="Tag (2–5 letters)" name="tag" maxLength={5} required />
          <TextField label="Logo URL (optional)" name="logo_url" placeholder="https://…" hint="Square PNG/JPG works best. Without a logo, a coloured tag badge is shown." />
          <Button type="submit">Create team</Button>
        </ActionForm>
      </Panel>
      <Panel title={`Teams (${teams.length})`} className="lg:col-span-2">
        <ul className="divide-y">
          {teams.map((t) => {
            const inSeasons = seasons.filter((s) => idx.data.seasonTeams.some((st) => st.season_id === s.id && st.team_id === t.id));
            return (
              <li key={t.id} className="py-3">
                <ActionForm action={updateTeam.bind(null, t.id)} className="grid items-end gap-2 sm:grid-cols-[auto_1fr_6rem_1fr_auto_auto]">
                  <TeamLogo team={t} size="md" />
                  <TextField label="Name" name="name" defaultValue={t.name} required />
                  <TextField label="Tag" name="tag" defaultValue={t.tag} maxLength={5} required />
                  <TextField label="Logo URL" name="logo_url" defaultValue={t.logo_url ?? ""} />
                  <Button type="submit" size="sm" variant="secondary">
                    Save
                  </Button>
                  <ActionButton action={deleteTeam.bind(null, t.id)} confirm={`Delete ${t.name}? Only works if it never played in a season.`} variant="ghost" className="text-loss">
                    Delete
                  </ActionButton>
                </ActionForm>
                <p className="mt-1 text-xs text-muted-foreground">{inSeasons.map((s) => s.name).join(", ") || "Not in any season yet"}</p>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
