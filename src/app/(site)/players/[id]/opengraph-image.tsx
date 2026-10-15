import { CrosshairIcon, MedkitIcon, PanIcon, ParachuteIcon } from "@/components/pubg-icons";
import { loadCommunity, profileMap } from "@/lib/community";
import { loadLeague } from "@/lib/data";
import { playerCareer } from "@/lib/engine/players";
import { num } from "@/lib/format";
import { display, label, OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";
import { onColor, teamColor } from "@/lib/team-colors";

export const alt = "Player card: career kills, games and MVP points";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const revalidate = 300;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ idx }, community] = await Promise.all([loadLeague(), loadCommunity()]);
  const career = playerCareer(idx, id, "official");
  if (!career) return ogImage({ eyebrow: "Player card", children: <div style={display(110)}>Player not found</div> });
  const { player, totals, currentTeam } = career;
  const photo = profileMap(community).get(id)?.photo_url ?? player.photo_url;
  const color = teamColor(currentTeam);
  const stats = [
    { Icon: CrosshairIcon, value: totals.kills, text: "Kills", tint: "#ff2d4b" },
    { Icon: ParachuteIcon, value: totals.games, text: "Games", tint: "#7aa2ff" },
    { Icon: PanIcon, value: num(totals.mvp, Number.isInteger(totals.mvp) ? 0 : 1), text: "MVP pts", tint: "#f2b705" },
    { Icon: MedkitIcon, value: totals.revives, text: "Revives", tint: "#34d399" },
  ];
  return ogImage({
    eyebrow: "Player card",
    accent: color,
    children: (
      <div style={{ display: "flex", alignItems: "center", gap: 46 }}>
        <div style={{ display: "flex", width: 250, height: 250, borderRadius: 28, overflow: "hidden", background: color, color: onColor(color), alignItems: "center", justifyContent: "center", border: "6px solid rgba(255,255,255,0.18)" }}>
          {photo ? (
            <img src={photo} alt="" width={250} height={250} style={{ objectFit: "cover" }} />
          ) : (
            <span style={display(120)}>{player.ign.slice(0, 2)}</span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={display(player.ign.length > 12 ? 92 : 118)}>{player.ign}</span>
            <span style={label(28, { color: "rgba(255,255,255,0.7)" })}>{currentTeam?.name ?? "Free agent"}</span>
          </div>
          <div style={{ display: "flex", gap: 30 }}>
            {stats.map(({ Icon, value, text, tint }) => (
              <div key={text} style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon width={30} height={30} style={{ color: tint }} />
                  <span style={display(58)}>{String(value)}</span>
                </div>
                <span style={label(18, { color: "rgba(255,255,255,0.55)" })}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  });
}
