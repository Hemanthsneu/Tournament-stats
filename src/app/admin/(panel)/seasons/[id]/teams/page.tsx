import { ActionButton, ActionForm } from "@/components/admin/action-form";
import { NativeSelect, Panel, TextField } from "@/components/admin/fields";
import { TeamLogo } from "@/components/team";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadLeague } from "@/lib/data";
import { seasonTeams } from "@/lib/engine/league";
import { teamRoster } from "@/lib/engine/players";
import {
  addRosterPlayer,
  addSeasonTeam,
  createTeam,
  deleteRosterEntry,
  releaseRosterEntry,
  removeSeasonTeam,
  transferPlayer,
} from "../../../../actions";

export default async function SeasonTeamsAdmin({ params }: PageProps<"/admin/seasons/[id]/teams">) {
  const { id } = await params;
  const { idx } = await loadLeague(true);
  const teams = seasonTeams(idx, id);
  const inSeason = new Set(teams.map((t) => t.id));
  const otherTeams = idx.data.teams.filter((t) => !inSeason.has(t.id)).sort((a, b) => a.name.localeCompare(b.name));
  const activeIds = new Set(idx.data.rosters.filter((r) => r.season_id === id && !r.left_on).map((r) => r.player_id));
  const freeAgents = idx.data.players.filter((p) => !activeIds.has(p.id)).sort((a, b) => a.ign.localeCompare(b.ign));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Add an existing team" description="Teams keep their history across seasons.">
          {otherTeams.length === 0 ? (
            <p className="text-sm text-muted-foreground">Every existing team is already in this season.</p>
          ) : (
            <ActionForm action={addSeasonTeam.bind(null, id)} className="flex gap-2">
              <NativeSelect name="team_id" required defaultValue="">
                <option value="" disabled>
                  Pick a team…
                </option>
                {otherTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.tag})
                  </option>
                ))}
              </NativeSelect>
              <Button type="submit">Add</Button>
            </ActionForm>
          )}
        </Panel>
        <Panel title="Create a new team" description="Added to this season straight away.">
          <ActionForm action={createTeam} resetOnSuccess className="grid grid-cols-[1fr_6rem_auto] items-end gap-2">
            <input type="hidden" name="season_id" value={id} />
            <TextField label="Team name" name="name" placeholder="e.g. Crimson Vipers" required />
            <TextField label="Tag" name="tag" placeholder="CV" maxLength={5} required />
            <Button type="submit">Create</Button>
            <TextField label="Logo URL (optional)" name="logo_url" placeholder="https://…/logo.png" className="col-span-3" />
          </ActionForm>
        </Panel>
      </div>

      {teams.length === 0 && <p className="text-sm text-muted-foreground">No teams in this season yet.</p>}

      <div className="grid gap-6 xl:grid-cols-2">
        {teams.map((team) => {
          const roster = teamRoster(idx, id, team.id);
          const active = roster.filter((r) => !r.entry.left_on);
          return (
            <section key={team.id} className="rounded-xl border bg-card">
              <div className="flex items-center gap-3 border-b p-4">
                <TeamLogo team={team} size="md" />
                <div className="flex-1">
                  <div className="font-semibold">{team.name}</div>
                  <div className="text-xs text-muted-foreground">{active.length} active players</div>
                </div>
                <ActionButton
                  action={removeSeasonTeam.bind(null, id, team.id)}
                  confirm={`Remove ${team.name} from this season?`}
                  variant="ghost"
                  className="text-loss"
                >
                  Remove team
                </ActionButton>
              </div>
              <ul className="divide-y">
                {roster.map(({ entry, player }) => (
                  <li key={entry.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm sm:flex-nowrap">
                    <span
                      className={`min-w-0 flex-1 truncate ${entry.left_on ? "text-muted-foreground line-through" : "font-medium"}`}
                      title={`Joined ${entry.joined_on}${entry.left_on ? `, left ${entry.left_on}` : ""}`}
                    >
                      {player.ign}
                    </span>
                    {entry.left_on && (
                      <Badge variant="outline" className="text-[10px]">
                        left {entry.left_on}
                      </Badge>
                    )}
                    {!entry.left_on && (
                      <div className="flex shrink-0 items-center gap-1">
                        {teams.length > 1 && (
                          <ActionForm action={transferPlayer.bind(null, entry.id)} className="flex items-center gap-1" confirm={`Transfer ${player.ign}?`}>
                            <NativeSelect name="to_team_id" className="h-8 w-24 text-xs" defaultValue="" required>
                              <option value="" disabled>
                                Move to…
                              </option>
                              {teams
                                .filter((t) => t.id !== team.id)
                                .map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.tag}
                                  </option>
                                ))}
                            </NativeSelect>
                            <Input type="date" name="date" className="h-8 w-32 px-1.5 text-xs" title="Transfer date (default today)" />
                            <Button type="submit" size="sm" variant="secondary">
                              Transfer
                            </Button>
                          </ActionForm>
                        )}
                        <ActionButton action={releaseRosterEntry.bind(null, entry.id)} confirm={`Release ${player.ign} from ${team.name}?`} variant="ghost">
                          Release
                        </ActionButton>
                        <ActionButton
                          action={deleteRosterEntry.bind(null, entry.id)}
                          confirm={`Remove ${player.ign} from this roster entirely? (Only for mistakes. Use Release if they played.)`}
                          variant="ghost"
                          className="text-loss"
                        >
                          ✕
                        </ActionButton>
                      </div>
                    )}
                  </li>
                ))}
                {roster.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No players yet.</li>}
              </ul>
              <ActionForm action={addRosterPlayer.bind(null, id, team.id)} resetOnSuccess className="grid gap-2 border-t p-4 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
                <NativeSelect name="player_id" defaultValue="">
                  <option value="">Existing player…</option>
                  {freeAgents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.ign}
                      {p.bgmi_uid ? ` (${p.bgmi_uid})` : ""}
                    </option>
                  ))}
                </NativeSelect>
                <span className="self-center text-center text-xs text-muted-foreground">or</span>
                <Input name="new_ign" placeholder="New player IGN" />
                <Button type="submit">Add player</Button>
              </ActionForm>
            </section>
          );
        })}
      </div>
    </div>
  );
}
