import { notFound } from "next/navigation";
import { FilterPills } from "@/components/filter-pills";
import { AwardCards, PlayerTable } from "@/components/leaderboard";
import { EmptyState, PageHeader, SectionTitle } from "@/components/page-header";
import { TeamLink } from "@/components/team";
import { loadLeague } from "@/lib/data";
import { filterGames, seasonByNumber } from "@/lib/engine/league";
import { AWARDS, playerLeaderboard, teamTotals, type AwardKey } from "@/lib/engine/players";
import { PLAYOFF_STAGES, type FixtureType, type Stage } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/s/[season]/stats">) {
  const { season } = await params;
  return { title: season === "all" ? "All-time stats" : `Season ${season} stats` };
}

const SORT_KEYS = AWARDS.map((a) => a.key);

export default async function StatsPage({ params, searchParams }: PageProps<"/s/[season]/stats">) {
  const { season: param } = await params;
  const sp = await searchParams;
  const { idx } = await loadLeague();
  const season = param === "all" ? null : seasonByNumber(idx.data, Number(param));
  if (param !== "all" && !season) notFound();

  const type: FixtureType = sp.type === "practice" ? "practice" : "official";
  const stageFilter = type === "official" && (sp.stage === "league" || sp.stage === "playoffs") ? sp.stage : "all";
  const sort: AwardKey = SORT_KEYS.includes(sp.sort as AwardKey) ? (sp.sort as AwardKey) : "kills";
  const stages: Stage[] | undefined =
    stageFilter === "league" ? ["league"] : stageFilter === "playoffs" ? [...PLAYOFF_STAGES] : undefined;

  const games = filterGames(idx, { seasonId: season?.id, type, stages });
  const board = playerLeaderboard(idx, games);
  const teams = teamTotals(idx, games);
  const mostKills = [...teams].sort((a, b) => b.kills - a.kills)[0];
  const mostRevives = [...teams].sort((a, b) => b.revives - a.revives)[0];

  const href = (patch: Record<string, string>) => {
    const q = new URLSearchParams({ type, stage: stageFilter, sort, ...patch });
    if (q.get("type") === "practice") q.delete("stage");
    return `/s/${param}/stats?${q}`;
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Stats & Awards"
        subtitle={`${season ? season.name : "All-time, every season"} · ${type === "official" ? "official games" : "practice games"}`}
      >
        <FilterPills
          value={type}
          options={[
            { value: "official", label: "Official", href: href({ type: "official" }) },
            { value: "practice", label: "Practice", href: href({ type: "practice", sort: sort === "potm" ? "kills" : sort }) },
          ]}
        />
        {type === "official" && (
          <FilterPills
            value={stageFilter}
            options={[
              { value: "all", label: "All stages", href: href({ stage: "all" }) },
              { value: "league", label: "League", href: href({ stage: "league" }) },
              { value: "playoffs", label: "Playoffs", href: href({ stage: "playoffs" }) },
            ]}
          />
        )}
      </PageHeader>

      {board.length === 0 ? (
        <EmptyState title="No games played for this filter yet" />
      ) : (
        <>
          <AwardCards rows={board} keys={type === "practice" ? ["mvp", "kills", "revives", "avgKills"] : undefined} />
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "Team: Most Kills", t: mostKills, v: mostKills?.kills },
              { title: "Team: Most Revives", t: mostRevives, v: mostRevives?.revives },
            ].map(({ title, t, v }) =>
              t ? (
                <div key={title} className="flex items-center justify-between rounded-xl border bg-card p-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-primary">{title}</div>
                    <TeamLink team={t.team} size="md" className="mt-2 text-lg" />
                  </div>
                  <div className="font-heading text-3xl font-bold tabular">{v}</div>
                </div>
              ) : null,
            )}
          </div>
          <section>
            <SectionTitle>All players</SectionTitle>
            <PlayerTable rows={board} sortKey={sort} sortHref={(key) => href({ sort: key })} />
          </section>
        </>
      )}
    </div>
  );
}
