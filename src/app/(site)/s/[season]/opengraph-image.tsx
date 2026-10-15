import { ChickenIcon } from "@/components/pubg-icons";
import { loadLeague } from "@/lib/data";
import { filterGames, leagueStandings, seasonByNumber, seasonPhase, seasonPodium, upNext } from "@/lib/engine/league";
import { display, GOLD, label, OG_SIZE, OG_TYPE, ogImage, TeamTile } from "@/lib/og";
import { teamColor } from "@/lib/team-colors";
import { fmtDateTime } from "@/lib/time";

export const alt = "Season standings and next match";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const revalidate = 300;

export default async function Image({ params }: { params: Promise<{ season: string }> }) {
  const { season: param } = await params;
  const { idx } = await loadLeague();
  const season = seasonByNumber(idx.data, Number(param));
  if (!season) return ogImage({ eyebrow: "WOW League", children: <div style={display(110)}>Season not found</div> });

  const { champion } = seasonPodium(idx, season.id);
  const table = leagueStandings(idx, season).slice(0, 3);
  const next = upNext(filterGames(idx, { seasonId: season.id, type: "official" }), 1)[0];
  const phase = seasonPhase(idx, season);

  return ogImage({
    eyebrow: `Season ${season.number} · ${phase}`,
    accent: champion ? GOLD : undefined,
    children: (
      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        <div style={{ display: "flex", ...display(season.name.length > 18 ? 84 : 104), maxWidth: 1000 }}>{season.name}</div>
        {champion ? (
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <ChickenIcon width={74} height={74} style={{ color: GOLD }} />
            <TeamTile tag={champion.tag} color={teamColor(champion)} size={70} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={label(26, { color: GOLD })}>Champions</span>
              <span style={display(58)}>{champion.name}</span>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 46, alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {table.map((r) => (
                <div key={r.team.id} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={display(40, { width: 34, color: r.position === 1 ? "#ff2d4b" : "rgba(255,255,255,0.6)" })}>{r.position}</span>
                  <TeamTile tag={r.team.tag} color={teamColor(r.team)} size={46} />
                  <span style={display(40, { width: 360 })}>{r.team.name}</span>
                  <span style={display(44)}>{r.points}</span>
                  <span style={label(20, { color: "rgba(255,255,255,0.55)", marginLeft: -6 })}>pts</span>
                </div>
              ))}
            </div>
            {next && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "16px 22px", borderRadius: 14, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)" }}>
                <span style={label(22, { color: "#ff2d4b" })}>Up next</span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <TeamTile tag={next.teamA?.tag ?? "TBD"} color={teamColor(next.teamA)} size={44} />
                  <span style={display(34, { color: "rgba(255,255,255,0.6)" })}>vs</span>
                  <TeamTile tag={next.teamB?.tag ?? "TBD"} color={teamColor(next.teamB)} size={44} />
                </div>
                <span style={label(20, { letterSpacing: 1, color: "rgba(255,255,255,0.7)" })}>{next.game.scheduled_at ? fmtDateTime(next.game.scheduled_at) : next.label}</span>
              </div>
            )}
          </div>
        )}
      </div>
    ),
  });
}
