import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CopyPlus, Monitor, Radio, RotateCcw, Square, Trash2 } from "@/components/icons";
import { ActionButton, ActionForm } from "@/components/admin/action-form";
import { Field, NativeSelect, Panel, TextField } from "@/components/admin/fields";
import { TeamLogo } from "@/components/team";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WeekStrip } from "@/components/availability";
import { timeWindow } from "@/lib/availability";
import { availabilityMap, loadCommunity, verifiedSet } from "@/lib/community";
import { loadLeague } from "@/lib/data";
import { filterGames, sortedSeasons } from "@/lib/engine/league";
import { playerLeaderboard } from "@/lib/engine/players";
import {
  addAllLots,
  addAuctionTeam,
  addLots,
  autoAssignSets,
  deleteAuction,
  duplicateAsPractice,
  finalizeAuction,
  removeAuctionTeam,
  removeLot,
  resetAuction,
  setCaptain,
  stopAuction,
  updateAuctionSettings,
  updateLot,
} from "../../../auction-actions";

export const metadata = { title: "Auction setup · Admin" };

const incrementsText = (inc: { upto: number | null; step: number }[]) =>
  inc.map((i) => `${i.upto ?? "*"}:${i.step}`).join(", ");

export default async function AuctionSetup({ params }: PageProps<"/admin/auction/[id]">) {
  const { id } = await params;
  const [{ idx }, community] = await Promise.all([loadLeague(true), loadCommunity()]);
  const auction = community.auctions.find((a) => a.id === id);
  if (!auction) notFound();

  const verified = verifiedSet(community);
  const teams = community.auctionTeams.filter((t) => t.auction_id === id).sort((a, b) => a.sort_order - b.sort_order);
  const lots = community.auctionLots
    .filter((l) => l.auction_id === id)
    .sort((a, b) => a.set_order - b.set_order || (idx.playerById.get(a.player_id)?.ign ?? "").localeCompare(idx.playerById.get(b.player_id)?.ign ?? ""));
  const inPool = new Set(lots.map((l) => l.player_id));
  const availability = availabilityMap(community);
  const captains = new Set(teams.map((t) => t.captain_player_id).filter(Boolean));
  const players = [...idx.data.players].sort((a, b) => a.ign.localeCompare(b.ign));
  const available = players.filter((p) => !inPool.has(p.id) && !captains.has(p.id));
  const stats = new Map(playerLeaderboard(idx, filterGames(idx, { type: "official" })).map((r) => [r.player.id, r]));
  const seasons = sortedSeasons(idx.data);
  const usedTeams = new Set(teams.map((t) => t.team_id));
  const otherTeams = idx.data.teams.filter((t) => !usedTeams.has(t.id)).sort((a, b) => a.name.localeCompare(b.name));
  const live = auction.status === "live" || auction.status === "paused";
  const done = lots.filter((l) => l.status === "sold" || l.status === "unsold").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/auction" className="text-sm text-muted-foreground hover:text-foreground">
          Auctions /
        </Link>
        <h1 className="text-2xl font-bold">{auction.name}</h1>
        <Badge variant="outline">{auction.status}</Badge>
        {auction.is_practice && <Badge className="bg-info-soft text-info">PRACTICE</Badge>}
        <span className="text-sm text-muted-foreground">
          {teams.length} teams · {lots.length} players in pool · {done} done
        </span>
        <div className="ml-auto flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/auction?id=${id}&screen=1`} target="_blank">
              <Monitor /> Big screen
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/auction?id=${id}`}>
              <Radio /> Open live room
            </Link>
          </Button>
        </div>
      </div>

      <Panel
        title={auction.is_practice ? "Practice auction controls" : "Practice, restart & stop"}
        description={
          auction.is_practice
            ? "This is a practice run. Bid as much as you like, then restart it or delete it. It never creates rosters or counts in any stats."
            : "Want a dry run first? Duplicate this auction as a practice copy with the same teams, captains and pool. The real auction stays untouched."
        }
        className={auction.is_practice ? "border-info/30" : undefined}
      >
        <div className="flex flex-wrap gap-2">
          {!auction.is_practice && (
            <ActionButton action={duplicateAsPractice.bind(null, id)} variant="default" size="default">
              <CopyPlus /> Duplicate as practice
            </ActionButton>
          )}
          {live && (
            <ActionButton
              action={stopAuction.bind(null, id)}
              confirm="Stop the auction now? The player on the block goes back to the pool. Results so far are kept."
              variant="outline"
              size="default"
            >
              <Square /> Stop auction
            </ActionButton>
          )}
          {(auction.status !== "completed" || auction.is_practice) && (
            <ActionButton
              action={resetAuction.bind(null, id)}
              confirm="Restart from scratch? Every player goes back to the pool and all bids are deleted."
              variant="outline"
              size="default"
            >
              <RotateCcw /> Restart from scratch
            </ActionButton>
          )}
          {!live && (auction.is_practice || auction.status !== "completed") && (
            <ActionButton action={deleteAuction.bind(null, id)} confirm={`Delete "${auction.name}" completely?`} variant="ghost" size="default" className="text-loss">
              <Trash2 /> Delete {auction.is_practice ? "practice auction" : "auction"}
            </ActionButton>
          )}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="1. Rules & timer" description="You can change these any time, even during the auction.">
          <ActionForm action={updateAuctionSettings.bind(null, id)} className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Name" name="name" defaultValue={auction.name} required />
              <Field label="Season (rosters are written here when you finish)">
                <NativeSelect name="season_id" defaultValue={auction.season_id ?? ""}>
                  <option value="">Pick later</option>
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.status})
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <TextField label="Purse per team" name="purse" type="number" min={1} defaultValue={auction.purse} />
              <TextField label="Base price" name="base_price" type="number" min={0} defaultValue={auction.base_price} />
              <TextField label="Min players to buy" name="min_buys" type="number" min={0} defaultValue={auction.min_buys} />
              <TextField label="Max players to buy" name="max_buys" type="number" min={1} defaultValue={auction.max_buys} />
            </div>
            <TextField
              label="Bid steps"
              name="increments"
              defaultValue={incrementsText(auction.increments)}
              hint="upto:step. E.g. 200:10, 500:25, *:50 means +10 below 200, +25 below 500, +50 above that."
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <TextField label="Time per player (s)" name="timer_seconds" type="number" min={5} defaultValue={auction.timer_seconds} />
              <TextField label="After each bid, at least (s)" name="bid_extend_seconds" type="number" min={0} defaultValue={auction.bid_extend_seconds} />
              <TextField label="Final countdown (s)" name="countdown_seconds" type="number" min={0} max={10} defaultValue={auction.countdown_seconds} />
              <TextField label="Auto next player after (s, 0 = manual)" name="auto_next_seconds" type="number" min={0} defaultValue={auction.auto_next_seconds} />
            </div>
            <div className="flex flex-wrap gap-5 text-sm">
              <Label className="flex items-center gap-2 font-normal">
                <Checkbox name="voice_enabled" defaultChecked={auction.voice_enabled} /> Voice announcer (bids, 3-2-1, sold)
              </Label>
              <Label className="flex items-center gap-2 font-normal">
                <Checkbox name="registration_open" defaultChecked={auction.registration_open} /> Players can register themselves
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              A captain can never bid more than they can afford while still filling the minimum squad: max bid = purse left − (players still needed − 1) × base price.
            </p>
            <Button type="submit" className="justify-self-start">
              Save rules
            </Button>
          </ActionForm>
        </Panel>

        <Panel title="2. Teams & captains" description="Captains are already on their team (not auctioned) and bid from their own login. They need a claimed profile to bid.">
          <ul className="space-y-3">
            {teams.map((t) => {
              const team = idx.teamById.get(t.team_id);
              const capVerified = t.captain_player_id ? verified.has(t.captain_player_id) : false;
              return (
                <li key={t.team_id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                  <TeamLogo team={team ?? null} size="md" />
                  <div className="min-w-32 flex-1">
                    <div className="font-semibold">{team?.name}</div>
                    <div className="text-xs">
                      {t.captain_player_id ? (
                        capVerified ? (
                          <span className="text-win">Captain can log in and bid</span>
                        ) : (
                          <span className="text-loss">Captain hasn&apos;t claimed their profile yet</span>
                        )
                      ) : (
                        <span className="text-muted-foreground">No captain yet</span>
                      )}
                    </div>
                  </div>
                  <ActionForm action={setCaptain.bind(null, id, t.team_id)} className="flex gap-2">
                    <NativeSelect name="captain_player_id" defaultValue={t.captain_player_id ?? ""} className="h-8 w-44 text-xs">
                      <option value="">No captain</option>
                      {players
                        .filter((p) => p.id === t.captain_player_id || !captains.has(p.id))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.ign}
                            {verified.has(p.id) ? " ✓" : ""}
                          </option>
                        ))}
                    </NativeSelect>
                    <Button type="submit" size="sm" variant="secondary">
                      Set
                    </Button>
                  </ActionForm>
                  {!live && (
                    <ActionButton action={removeAuctionTeam.bind(null, id, t.team_id)} confirm={`Remove ${team?.name} from the auction?`} size="icon-xs" variant="ghost" className="text-loss" title="Remove">
                      <Trash2 />
                    </ActionButton>
                  )}
                </li>
              );
            })}
          </ul>
          {!live && (
            <ActionForm action={addAuctionTeam.bind(null, id)} resetOnSuccess className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-[1fr_auto_1fr_5rem_auto] sm:items-end">
              <Field label="Existing team">
                <NativeSelect name="team_id" defaultValue="">
                  <option value="">New team →</option>
                  {otherTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <span className="pb-2 text-center text-xs text-muted-foreground">or</span>
              <TextField label="New team name" name="name" placeholder="e.g. Desert Hawks" />
              <TextField label="Tag" name="tag" maxLength={5} placeholder="DH" />
              <Button type="submit">Add team</Button>
            </ActionForm>
          )}
          <p className="mt-2 text-xs text-muted-foreground">✓ = has a claimed profile. Add team logos under Admin → Teams.</p>
        </Panel>
      </div>

      <Panel
        title={`3. Player pool (${lots.length})`}
        description="Players come up at random: all of the lowest set first, then the next set. Unsold players can get a second round from the live room."
      >
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <ActionButton action={addAllLots.bind(null, id, "claimed")} variant="secondary" size="default">
            Add everyone with a claimed profile
          </ActionButton>
          <ActionButton action={addAllLots.bind(null, id, "all")} variant="outline" size="default">
            Add all players
          </ActionButton>
          <ActionForm action={autoAssignSets.bind(null, id)} className="flex items-end gap-2">
            <TextField label="Auto sets by career MVP (sizes)" name="sizes" defaultValue="4, 8" className="w-48" />
            <Button type="submit" variant="outline">
              Assign sets
            </Button>
          </ActionForm>
        </div>
        {available.length > 0 && (
          <details className="mb-4 rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-medium">Add specific players ({available.length} not in the pool)</summary>
            <ActionForm action={addLots.bind(null, id)} resetOnSuccess className="mt-3">
              <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4 lg:grid-cols-6">
                {available.map((p) => (
                  <Label key={p.id} className="flex items-center gap-2 text-sm font-normal">
                    <Checkbox name="player_id" value={p.id} /> {p.ign}
                    {verified.has(p.id) && <BadgeCheck className="size-3.5 text-win" />}
                  </Label>
                ))}
              </div>
              <Button type="submit" size="sm" className="mt-3">
                Add ticked players
              </Button>
            </ActionForm>
          </details>
        )}
        {lots.length === 0 ? (
          <p className="text-sm text-muted-foreground">The pool is empty. Players can also join themselves from My profile while registration is open.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b bg-muted/50 font-heading text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
                  <th className="px-2 py-2 text-left font-semibold">Player</th>
                  <th className="px-2 py-2 text-left font-semibold">Career</th>
                  <th className="px-2 py-2 text-left font-semibold">Availability</th>
                  <th className="px-2 py-2 text-left font-semibold">Set / order / base price</th>
                  <th className="px-2 py-2 text-left font-semibold">Status</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {lots.map((l) => {
                  const p = idx.playerById.get(l.player_id);
                  const s = stats.get(l.player_id);
                  return (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="px-2 py-2">
                        <span className="font-medium">{p?.ign}</span>
                        {verified.has(l.player_id) && <BadgeCheck className="ml-1 inline size-3.5 text-win" />}
                        {l.registered_by_player && <span className="ml-2 text-[11px] text-muted-foreground">self-registered</span>}
                      </td>
                      <td className="px-2 py-2 text-xs text-muted-foreground tabular">
                        {s ? `${s.games} G · ${s.kills} K · ${s.revives} R · ${Math.round(s.mvp)} MVP` : "New player"}
                      </td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        <WeekStrip availability={availability.get(l.player_id)} size="xs" />
                        {availability.get(l.player_id)?.days.length ? <div className="mt-0.5">{timeWindow(availability.get(l.player_id)!)}</div> : <div className="mt-0.5">Not shared</div>}
                      </td>
                      <td className="px-2 py-2">
                        <ActionForm action={updateLot.bind(null, l.id)} className="flex gap-1">
                          <Input name="set_name" defaultValue={l.set_name} className="h-8 w-24 text-xs" />
                          <Input name="set_order" type="number" min={0} defaultValue={l.set_order} className="h-8 w-14 text-xs" title="Set order (lower comes first)" />
                          <Input name="base_price" type="number" min={0} defaultValue={l.base_price ?? ""} placeholder={String(auction.base_price)} className="h-8 w-20 text-xs" title="Base price (blank = auction default)" />
                          <Button type="submit" size="sm" variant="ghost">
                            Save
                          </Button>
                        </ActionForm>
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {l.status === "sold" ? (
                          <span className="text-win">
                            Sold to {idx.teamById.get(l.sold_team_id ?? "")?.tag} · {l.sold_price}
                          </span>
                        ) : (
                          <span className={l.status === "unsold" ? "text-loss" : "text-muted-foreground"}>{l.status}</span>
                        )}
                        {l.round > 1 && <span className="ml-1 text-muted-foreground">(round {l.round})</span>}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {l.status === "pool" && (
                          <ActionButton action={removeLot.bind(null, l.id)} size="icon-xs" variant="ghost" className="text-loss" title="Remove from pool">
                            <Trash2 />
                          </ActionButton>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {!auction.is_practice && (
        <Panel title="4. Finish" description="When everyone is sold or unsold, this adds the captains and their bought players to the season's rosters. Season 1 is never touched.">
          <ActionButton
            action={finalizeAuction.bind(null, id)}
            confirm="Write the auction result into the season rosters now? (Do this once, after the real auction.)"
            variant="default"
            size="default"
          >
            Finish auction & create rosters
          </ActionButton>
        </Panel>
      )}
    </div>
  );
}
