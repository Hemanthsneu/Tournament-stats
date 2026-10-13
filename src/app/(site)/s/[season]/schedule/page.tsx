import { GameCard } from "@/components/game-card";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loadSeason } from "@/lib/data";
import { filterGames, isCalendarSeason, upNext, type GameView } from "@/lib/engine/league";
import { dateKey, fmtLongDate, tzLabel } from "@/lib/time";
import { PLAYOFF_STAGES, STAGE_LABELS } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/s/[season]/schedule">) {
  return { title: `Season ${(await params).season} schedule` };
}

function groupBy<K>(views: GameView[], key: (v: GameView) => K): [K, GameView[]][] {
  const map = new Map<K, GameView[]>();
  for (const v of views) map.set(key(v), [...(map.get(key(v)) ?? []), v]);
  return [...map.entries()];
}

export default async function SchedulePage({ params }: PageProps<"/s/[season]/schedule">) {
  const { season: param } = await params;
  const { idx, season } = await loadSeason(param);
  const official = filterGames(idx, { seasonId: season.id, type: "official" });
  const nextId = upNext(official)[0]?.game.id;
  // Calendar-planned seasons group league games by date; matchday seasons (Season 1) by matchday.
  const byDate = isCalendarSeason(idx, season.id);

  const rrNumbers = [...new Set(official.filter((v) => v.fixture.stage === "league").map((v) => v.fixture.round_robin ?? 1))];
  const tabs = [
    ...rrNumbers.map((rr) => ({
      value: `rr${rr}`,
      label: rrNumbers.length > 1 ? `Round Robin ${rr}` : "League",
      games: official.filter((v) => v.fixture.stage === "league" && (v.fixture.round_robin ?? 1) === rr),
    })),
    { value: "playoffs", label: "Playoffs", games: official.filter((v) => v.fixture.stage !== "league") },
  ].filter((t) => t.games.length > 0);

  const defaultTab = tabs.find((t) => t.games.some((g) => g.game.id === nextId))?.value ?? tabs.at(-1)?.value ?? "rr1";
  const done = official.filter((v) => v.completed).length;

  return (
    <div>
      <PageHeader
        title="Schedule & Results"
        subtitle={`${season.name} · ${done} of ${official.length} games played · times in ${tzLabel()}`}
      />
      {tabs.length === 0 ? (
        <EmptyState title="Schedule not published yet" />
      ) : (
        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-4">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t) => (
            <TabsContent key={t.value} value={t.value} className="space-y-8">
              {t.value === "playoffs"
                ? PLAYOFF_STAGES.map((stage) => {
                    const games = t.games.filter((g) => g.fixture.stage === stage);
                    if (!games.length) return null;
                    return (
                      <section key={stage}>
                        <h2 className="mb-3 font-heading text-xl font-bold tracking-wide uppercase">
                          {STAGE_LABELS[stage]} <span className="text-sm font-normal text-muted-foreground">· best of 3</span>
                        </h2>
                        <div className="grid gap-3 md:grid-cols-2">
                          {games.map((v) => (
                            <GameCard key={v.game.id} view={v} idx={idx} highlight={v.game.id === nextId} showDate />
                          ))}
                        </div>
                      </section>
                    );
                  })
                : groupBy(t.games, (v) => (byDate ? (v.game.scheduled_at ? dateKey(v.game.scheduled_at) : "tbd") : v.fixture.matchday ?? 0)).map(([day, games]) => {
                    const date = games.find((g) => g.game.scheduled_at)?.game.scheduled_at;
                    const resting = restingTeams(idx.data.seasonTeams.filter((s) => s.season_id === season.id).map((s) => s.team_id), games);
                    return (
                      <section key={day}>
                        <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
                          {byDate ? (
                            <h2 className="font-heading text-xl font-bold tracking-wide uppercase">{date ? fmtLongDate(date) : "Date to be announced"}</h2>
                          ) : (
                            <>
                              <h2 className="font-heading text-xl font-bold tracking-wide uppercase">Matchday {day}</h2>
                              {date && <span className="text-sm text-muted-foreground">{fmtLongDate(date)}</span>}
                            </>
                          )}
                          {resting.length > 0 && day !== "tbd" && (
                            <span className="text-xs text-muted-foreground">
                              Rest: {resting.map((id) => idx.teamById.get(id)?.name).join(", ")}
                            </span>
                          )}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          {games.map((v) => (
                            <GameCard key={v.game.id} view={v} idx={idx} highlight={v.game.id === nextId} />
                          ))}
                        </div>
                      </section>
                    );
                  })}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

function restingTeams(teamIds: string[], games: GameView[]): string[] {
  const playing = new Set(games.flatMap((g) => [g.teamA?.id, g.teamB?.id]));
  return teamIds.filter((id) => !playing.has(id));
}
