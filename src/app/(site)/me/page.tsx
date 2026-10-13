import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, Gavel, LogOut } from "@/components/icons";
import { ActionButton } from "@/components/admin/action-form";
import { ClaimForm } from "@/components/account/claim-form";
import { ProfileForm } from "@/components/account/profile-form";
import { Panel } from "@/components/admin/fields";
import { TeamLink } from "@/components/team";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getViewer, loadCommunity, profileMap } from "@/lib/community";
import { loadLeague } from "@/lib/data";
import { playerCareer } from "@/lib/engine/players";
import { setAuctionRegistration, signOutPlayer } from "./actions";

export const metadata = { title: "My profile" };

export default async function MePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/me");
  const [{ idx }, community] = await Promise.all([loadLeague(true), loadCommunity()]);

  const signOut = (
    <form action={signOutPlayer}>
      <Button type="submit" variant="ghost" size="sm">
        <LogOut /> Sign out
      </Button>
    </form>
  );

  if (!viewer.playerId) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Claim your player profile</h1>
          {signOut}
        </div>
        <Panel
          title="Enter your claim code"
          description={
            <>
              Your organizer sends each player a one-time code (usually on WhatsApp). Enter it to link{" "}
              <b>{viewer.email}</b> to your player profile, stats and history.
            </>
          }
        >
          <ClaimForm />
        </Panel>
        {viewer.isAdmin && (
          <p className="text-sm text-muted-foreground">
            You&apos;re an organizer.{" "}
            <Link href="/admin" className="text-primary">
              Open the admin panel →
            </Link>
          </p>
        )}
      </div>
    );
  }

  const player = idx.playerById.get(viewer.playerId);
  if (!player) redirect("/");
  const profile = profileMap(community).get(player.id) ?? null;
  const career = playerCareer(idx, player.id, "official");
  // Practice runs only matter to their captains.
  const auctions = community.auctions
    .filter((a) => a.status !== "completed")
    .filter((a) => !a.is_practice || community.auctionTeams.some((t) => t.auction_id === a.id && t.captain_player_id === player.id))
    .sort((a, b) => Number(a.is_practice) - Number(b.is_practice) || b.created_at.localeCompare(a.created_at));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{player.ign}</h1>
        <Badge className="gap-1">
          <BadgeCheck /> Verified
        </Badge>
        {career?.currentTeam && <TeamLink team={career.currentTeam} size="xs" />}
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/players/${player.id}`}>View public profile</Link>
          </Button>
          {signOut}
        </div>
      </div>

      {career && (
        <div className="grid grid-cols-5 gap-3 rounded-xl border bg-card p-4 text-center">
          {[
            ["Games", career.totals.games],
            ["Kills", career.totals.kills],
            ["Revives", career.totals.revives],
            ["POTM", career.totals.potm],
            ["Titles", career.totals.titles],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-2xl font-medium tabular">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      )}

      {auctions.map((a) => {
        const captainOf = community.auctionTeams.find((t) => t.auction_id === a.id && t.captain_player_id === player.id);
        const lot = community.auctionLots.find((l) => l.auction_id === a.id && l.player_id === player.id);
        const team = captainOf ? idx.teamById.get(captainOf.team_id) ?? null : null;
        return (
          <Panel
            key={a.id}
            title={a.name}
            description={
              <span className="inline-flex items-center gap-1">
                <Gavel className="size-4" /> {a.is_practice ? "Practice auction (nothing here counts)" : "Player auction"}
              </span>
            }
          >
            {captainOf ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm">
                  You&apos;re the <b>captain</b> of <TeamLink team={team} size="xs" />. You bid for your squad in the live room.
                </p>
                <Button asChild className="ml-auto">
                  <Link href={`/auction?id=${a.id}`}>Open captain&apos;s room →</Link>
                </Button>
              </div>
            ) : lot ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span>
                  You&apos;re in the auction pool
                  {lot.status === "sold" && lot.sold_team_id && (
                    <>
                      , <b>sold to {idx.teamById.get(lot.sold_team_id)?.name} for {lot.sold_price}</b>
                    </>
                  )}
                  {lot.status === "unsold" && ", unsold so far"}
                  {lot.status === "pool" && (a.status === "setup" ? ". Bidding hasn't started yet." : ". Waiting to be drawn.")}
                </span>
                <div className="ml-auto flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/auction?id=${a.id}`}>Watch the auction</Link>
                  </Button>
                  {lot.status === "pool" && a.registration_open && (
                    <ActionButton action={setAuctionRegistration.bind(null, a.id, false)} confirm="Leave the auction pool?" variant="ghost">
                      Leave pool
                    </ActionButton>
                  )}
                </div>
              </div>
            ) : a.registration_open ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted-foreground">Registration is open. Join the pool to be picked by a captain.</p>
                <ActionButton action={setAuctionRegistration.bind(null, a.id, true)} variant="default" size="default" className="ml-auto">
                  I&apos;m in, register me
                </ActionButton>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Registration is closed for this auction.</p>
            )}
          </Panel>
        );
      })}

      <Panel title="Edit your profile" description="This shows on your public player page and your auction card. Your stats can only be changed by organizers.">
        <ProfileForm playerId={player.id} profile={profile} fallbackInitials={player.ign.slice(0, 2).toUpperCase()} />
      </Panel>
    </div>
  );
}
