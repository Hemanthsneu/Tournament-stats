import type { ChampionsShowcaseProps, ShowTeam } from "@/components/champions";
import type { SeasonHonours, SquadMember } from "@/lib/engine/honours";
import { onColor, teamColor } from "@/lib/team-colors";
import type { Team } from "@/lib/types";

const showTeam = (t: Team): ShowTeam => {
  const color = teamColor(t);
  return { id: t.id, name: t.name, tag: t.tag, color, ink: onColor(color) };
};

/** Plain, serialisable props for the client-side champions showcase. */
export function showcaseProps(h: SeasonHonours, photoOf: (playerId: string) => string | null): ChampionsShowcaseProps {
  const squad = (rows: SquadMember[]) => rows.map((m) => ({ id: m.player.id, ign: m.player.ign, photo: photoOf(m.player.id), kills: m.kills, games: m.games }));
  const rival = h.runnerUp?.name;
  const how = h.final
    ? rival
      ? `Beat ${rival} ${h.final.won}–${h.final.lost} in the Final`
      : `Won the Final ${h.final.won}–${h.final.lost}`
    : rival
      ? `Top of the league table, ahead of ${rival}`
      : "Top of the league table";
  return {
    seasonName: h.season.name,
    seasonNumber: h.season.number,
    champion: showTeam(h.champion),
    runnerUp: h.runnerUp ? showTeam(h.runnerUp) : null,
    championSquad: squad(h.championSquad),
    runnerUpSquad: squad(h.runnerUpSquad),
    how,
    finalHref: h.final ? `/s/${h.season.number}/playoffs` : null,
    finalStar: h.finalStar ? { id: h.finalStar.player.id, ign: h.finalStar.player.ign, kills: h.finalStar.kills } : null,
  };
}
