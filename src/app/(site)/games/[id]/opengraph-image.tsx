import { loadLeague } from "@/lib/data";
import { display, label, OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";
import { onColor, teamColor } from "@/lib/team-colors";
import { fmtDateTime } from "@/lib/time";
import type { Team } from "@/lib/types";

export const alt = "Match card";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const revalidate = 120;

function Side({ team, dim }: { team: Team | null; dim: boolean }) {
  const color = teamColor(team);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 330, height: 250, borderRadius: 22, background: color, color: onColor(color), opacity: dim ? 0.55 : 1 }}>
      <span style={display(120)}>{team?.tag ?? "TBD"}</span>
      <span style={label(22, { letterSpacing: 1, maxWidth: 290, textAlign: "center" })}>{team?.name ?? "To be decided"}</span>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { idx } = await loadLeague();
  const v = idx.viewById.get(id);
  if (!v) return ogImage({ eyebrow: "Match", children: <div style={display(110)}>Match not found</div> });
  const done = v.completed;
  return ogImage({
    eyebrow: `${v.season.name} · ${v.label}`,
    children: (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <Side team={v.teamA} dim={done && v.winnerId !== v.teamA?.id} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 200 }}>
            {done ? <span style={display(110, { letterSpacing: 0 })}>{`${v.game.team_a_rounds}-${v.game.team_b_rounds}`}</span> : <span style={display(96, { color: "rgba(255,255,255,0.75)" })}>VS</span>}
            <span style={label(22, { color: done ? "#ff2d4b" : "rgba(255,255,255,0.6)" })}>{done ? "Final" : v.playoffNote === "if_needed" ? "If needed" : "Upcoming"}</span>
          </div>
          <Side team={v.teamB} dim={done && v.winnerId !== v.teamB?.id} />
        </div>
        <span style={label(24, { letterSpacing: 1, color: "rgba(255,255,255,0.7)" })}>
          {[v.map ? `${v.map.name} · ${v.map.total_rounds} rounds` : null, v.game.scheduled_at ? fmtDateTime(v.game.scheduled_at) : null, done ? `Kills ${v.killsA}-${v.killsB}` : null].filter(Boolean).join("  ·  ")}
        </span>
      </div>
    ),
  });
}
