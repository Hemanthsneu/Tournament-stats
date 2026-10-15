import { loadLeague } from "@/lib/data";
import { filterGames, sortedSeasons, teamFinish } from "@/lib/engine/league";
import { gamesForTeam } from "@/lib/engine/players";
import { display, label, OG_SIZE, OG_TYPE, ogImage, TeamTile } from "@/lib/og";
import { teamColor } from "@/lib/team-colors";

export const alt = "Team card";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const revalidate = 300;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { idx } = await loadLeague();
  const team = idx.teamById.get(id);
  if (!team) return ogImage({ eyebrow: "Team", children: <div style={display(110)}>Team not found</div> });
  const played = gamesForTeam(filterGames(idx, { type: "official" }), id).filter((g) => g.completed);
  const wins = played.filter((g) => g.winnerId === id).length;
  const kills = played.reduce((a, g) => a + (g.teamA?.id === id ? g.killsA : g.killsB), 0);
  const season = sortedSeasons(idx.data).find((s) => s.status !== "draft" && idx.data.seasonTeams.some((x) => x.season_id === s.id && x.team_id === id));
  const finish = season ? teamFinish(idx, season.id, id) : null;
  const color = teamColor(team);
  return ogImage({
    eyebrow: season ? `${season.name}${finish ? ` · ${finish}` : ""}` : "Team",
    accent: color,
    children: (
      <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
        <TeamTile tag={team.tag} color={color} size={190} />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={display(team.name.length > 16 ? 82 : 104)}>{team.name}</span>
          <div style={{ display: "flex", gap: 36 }}>
            {[
              [played.length, "Games"],
              [wins, "Wins"],
              [kills, "Kills"],
            ].map(([v, t]) => (
              <div key={t} style={{ display: "flex", flexDirection: "column" }}>
                <span style={display(58)}>{String(v)}</span>
                <span style={label(18, { color: "rgba(255,255,255,0.55)" })}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  });
}
