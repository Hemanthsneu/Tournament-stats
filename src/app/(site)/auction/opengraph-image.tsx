import { CrateIcon } from "@/components/pubg-icons";
import { featuredAuction, loadCommunity } from "@/lib/community";
import { loadLeague } from "@/lib/data";
import { display, GOLD, label, OG_SIZE, OG_TYPE, ogImage, TeamTile } from "@/lib/og";
import { teamColor } from "@/lib/team-colors";
import { fmtDateTime } from "@/lib/time";

export const alt = "Player auction";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const revalidate = 60;

export default async function Image() {
  const [{ idx }, community] = await Promise.all([loadLeague(), loadCommunity()]);
  const a = featuredAuction({ ...community, auctions: community.auctions.filter((x) => !x.is_practice) }) ?? featuredAuction(community);
  const teams = a ? community.auctionTeams.filter((t) => t.auction_id === a.id).map((t) => idx.teamById.get(t.team_id)).filter((t) => !!t) : [];
  const status = !a
    ? "Coming soon"
    : a.status === "live" || a.status === "paused"
      ? "Live now · watch every bid"
      : a.status === "completed"
        ? "Results are in"
        : a.starts_at
          ? `Starts ${fmtDateTime(a.starts_at)}`
          : "Starting soon";
  return ogImage({
    eyebrow: a?.status === "live" ? "Live auction" : "Player auction",
    accent: a?.status === "completed" ? GOLD : undefined,
    children: (
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <CrateIcon width={120} height={120} style={{ color: "#ff2d4b" }} />
          <span style={display((a?.name.length ?? 0) > 20 ? 84 : 104, { maxWidth: 860 })}>{a?.name ?? "Player auction"}</span>
        </div>
        <span style={label(34, { letterSpacing: 2 })}>{status}</span>
        {teams.length > 0 && (
          <div style={{ display: "flex", gap: 14 }}>
            {teams.map((t) => (
              <TeamTile key={t!.id} tag={t!.tag} color={teamColor(t!)} size={52} />
            ))}
          </div>
        )}
      </div>
    ),
  });
}
