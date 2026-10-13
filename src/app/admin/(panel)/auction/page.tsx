import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { Field, NativeSelect, Panel, TextField } from "@/components/admin/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { loadCommunity } from "@/lib/community";
import { loadLeague } from "@/lib/data";
import { sortedSeasons } from "@/lib/engine/league";
import { createAuction } from "../../auction-actions";

export const metadata = { title: "Auction · Admin" };

export default async function AuctionsAdmin() {
  const [{ idx }, community] = await Promise.all([loadLeague(true), loadCommunity()]);
  const seasons = sortedSeasons(idx.data);
  const auctions = [...community.auctions].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Panel title="Auctions" className="lg:col-span-3">
        {auctions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No auctions yet. Create the Season 2 auction on the right.</p>
        ) : (
          <ul className="divide-y">
            {auctions.map((a) => {
              const lots = community.auctionLots.filter((l) => l.auction_id === a.id);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Link href={`/admin/auction/${a.id}`} className="font-semibold hover:text-primary">
                    {a.name}
                  </Link>
                  <Badge variant="outline">{a.status}</Badge>
                  {a.is_practice && <Badge className="bg-info-soft text-info">practice</Badge>}
                  <span className="text-sm text-muted-foreground">
                    {idx.seasonById.get(a.season_id ?? "")?.name ?? "No season"} · {community.auctionTeams.filter((t) => t.auction_id === a.id).length} teams ·{" "}
                    {lots.filter((l) => l.status === "sold").length}/{lots.length} sold
                  </span>
                  <Button asChild size="sm" variant="outline" className="ml-auto">
                    <Link href={`/auction?id=${a.id}`}>Live room</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <Panel
        title="New auction"
        description="Create Season 2 under Seasons first (it can stay a draft). Finishing the auction fills that season's teams and rosters."
        className="lg:col-span-2"
      >
        <ActionForm action={createAuction} className="grid gap-3">
          <TextField label="Name" name="name" defaultValue={`Season ${(seasons[0]?.number ?? 0) + 1} Player Auction`} required />
          <Field label="For season">
            <NativeSelect name="season_id" defaultValue="">
              <option value="">Pick later</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status})
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Label className="flex items-start gap-2 text-sm font-normal">
            <Checkbox name="is_practice" className="mt-0.5" />
            <span>
              Practice auction: labelled PRACTICE, never creates rosters, and you can restart it as often as you like. (Tip: on a real
              auction&apos;s page, &quot;Duplicate as practice&quot; copies its teams, captains and pool.)
            </span>
          </Label>
          <Button type="submit">Create auction</Button>
        </ActionForm>
      </Panel>
    </div>
  );
}
