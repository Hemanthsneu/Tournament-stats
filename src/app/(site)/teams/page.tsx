import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { TeamLogo } from "@/components/team";
import { loadLeague } from "@/lib/data";
import { teamColor } from "@/lib/team-colors";
import { filterGames, sortedSeasons, teamFinish } from "@/lib/engine/league";

export const metadata = { title: "Teams" };

export default async function TeamsPage() {
  const { idx } = await loadLeague();
  const seasons = sortedSeasons(idx.data);
  const official = filterGames(idx, { type: "official" }).filter((g) => g.completed);
  const teams = [...idx.data.teams].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <PageHeader title="Teams" subtitle="Every team that has played in the league" />
      {teams.length === 0 ? (
        <EmptyState title="No teams yet" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => {
            const games = official.filter((g) => g.teamA?.id === team.id || g.teamB?.id === team.id);
            const wins = games.filter((g) => g.winnerId === team.id).length;
            const inSeasons = seasons.filter((s) => idx.data.seasonTeams.some((st) => st.season_id === s.id && st.team_id === team.id));
            const titles = inSeasons.filter((s) => teamFinish(idx, s.id, team.id) === "Champion").length;
            return (
              <Link
                key={team.id}
                href={`/teams/${team.id}`}
                className="flex items-center gap-4 overflow-hidden rounded-lg border border-l-[6px] bg-card p-4 transition-shadow hover:shadow-[0_6px_20px_rgb(12_26_58/0.08)]"
                style={{ borderLeftColor: teamColor(team) }}
              >
                <TeamLogo team={team} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-heading text-2xl font-bold uppercase">{team.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {inSeasons.map((s) => `S${s.number}`).join(" · ") || "No seasons yet"}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground tabular">
                    {wins}W – {games.length - wins}L{titles > 0 && <span className="ml-2 text-primary">{titles}× champion</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
