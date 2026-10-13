import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { TeamLogo } from "@/components/team";
import { Badge } from "@/components/ui/badge";
import { loadLeague } from "@/lib/data";
import type { GameView, LeagueIndex } from "@/lib/engine/league";
import { mvpScore } from "@/lib/engine/players";
import { num } from "@/lib/format";
import { fmtLongDate, fmtTime, tzLabel } from "@/lib/time";
import { cn } from "@/lib/utils";
import { STAGE_LABELS, type PlayerGameStat, type Team } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/games/[id]">) {
  const { idx } = await loadLeague();
  const v = idx.viewById.get((await params).id);
  return { title: v ? `${v.teamA?.tag ?? "TBD"} vs ${v.teamB?.tag ?? "TBD"} · ${v.label}` : "Match" };
}

export default async function GamePage({ params }: PageProps<"/games/[id]">) {
  const { id } = await params;
  const { idx } = await loadLeague();
  const view = idx.viewById.get(id);
  if (!view) notFound();
  const { game, fixture, season, map, teamA, teamB, completed, winnerId } = view;
  const siblings = idx.views.filter((v) => v.fixture.id === fixture.id && v.game.id !== game.id);
  const potm = game.potm_player_id ? idx.playerById.get(game.potm_player_id) : null;
  const context =
    fixture.stage === "league"
      ? `Round Robin ${fixture.round_robin} · Matchday ${fixture.matchday}`
      : STAGE_LABELS[fixture.stage];
  const back =
    fixture.type === "practice"
      ? `/s/${season.number}/practice`
      : fixture.stage === "league"
        ? `/s/${season.number}/schedule`
        : `/s/${season.number}/playoffs`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={view.label}
        subtitle={
          <>
            <Link href={back} className="hover:text-foreground">
              {season.name}
            </Link>{" "}
            · {context}
            {game.scheduled_at && ` · ${fmtLongDate(game.scheduled_at)}, ${fmtTime(game.scheduled_at)} ${tzLabel()}`}
          </>
        }
      >
        {fixture.type === "practice" && <Badge variant="secondary">Practice</Badge>}
        {completed ? <Badge variant="secondary">Final</Badge> : <Badge variant="outline">Scheduled</Badge>}
      </PageHeader>

      <section className="border-y py-12">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-10">
          <ScoreSide team={teamA} won={completed ? winnerId === teamA?.id : null} />
          <div className="text-center">
            {completed ? (
              <div className="font-heading text-7xl leading-none tabular sm:text-8xl">
                <span className={winnerId === teamA?.id ? "" : "text-muted-foreground/60"}>{game.team_a_rounds}</span>
                <span className="mx-3 text-muted-foreground/40">–</span>
                <span className={winnerId === teamB?.id ? "" : "text-muted-foreground/60"}>{game.team_b_rounds}</span>
              </div>
            ) : (
              <div className="font-heading text-5xl text-muted-foreground italic">vs</div>
            )}
            <div className="mt-3 text-xs text-muted-foreground">rounds won</div>
          </div>
          <ScoreSide team={teamB} won={completed ? winnerId === teamB?.id : null} />
        </div>
        <dl className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-x-10 gap-y-4 text-sm">
          {map && (
            <div className="text-center">
              <dt className="text-xs text-muted-foreground">Map</dt>
              <dd className="mt-1">
                {map.name} · {map.total_rounds} rounds
                {map.wow_map_id && <span className="ml-1 font-mono text-muted-foreground">#{map.wow_map_id}</span>}
              </dd>
            </div>
          )}
          {game.squad_size && (
            <div className="text-center">
              <dt className="text-xs text-muted-foreground">Format</dt>
              <dd className="mt-1">
                {game.squad_size}v{game.squad_size}
              </dd>
            </div>
          )}
          {completed && (
            <>
              <div className="text-center">
                <dt className="text-xs text-muted-foreground">Kills</dt>
                <dd className="mt-1 tabular">
                  {view.killsA}–{view.killsB}
                </dd>
              </div>
              <div className="text-center">
                <dt className="text-xs text-muted-foreground">Revives</dt>
                <dd className="mt-1 tabular">
                  {view.revivesA}–{view.revivesB}
                </dd>
              </div>
            </>
          )}
          {potm && (
            <div className="text-center">
              <dt className="text-xs text-muted-foreground">Player of the Match</dt>
              <dd className="mt-1">
                <Link href={`/players/${potm.id}`} className="inline-flex items-center gap-1 font-medium transition-colors hover:text-muted-foreground">
                  <Trophy className="size-3.5 text-gold" /> {potm.ign}
                </Link>
              </dd>
            </div>
          )}
        </dl>
      </section>

      {completed && (
        <div className="grid gap-4 md:grid-cols-2">
          <Lineup idx={idx} view={view} team={teamA} stats={view.statsA} />
          <Lineup idx={idx} view={view} team={teamB} stats={view.statsB} />
        </div>
      )}

      {siblings.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{fixture.stage === "league" ? "Other map in this pairing" : "Other games in this series"}</h2>
          <div className="flex flex-wrap gap-2">
            {siblings.map((s) => (
              <Link key={s.game.id} href={`/games/${s.game.id}`} className="rounded-lg border bg-card px-3 py-2 text-sm hover:border-primary/50">
                {s.label} · {s.map?.name ?? "Map TBD"}
                {s.completed && ` · ${s.game.team_a_rounds}–${s.game.team_b_rounds}`}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ScoreSide({ team, won }: { team: Team | null; won: boolean | null }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <TeamLogo team={team} size="xl" />
      {team ? (
        <Link href={`/teams/${team.id}`} className={cn("text-base font-medium transition-colors hover:text-muted-foreground sm:text-lg", won === false && "text-muted-foreground")}>
          {team.name}
        </Link>
      ) : (
        <span className="italic text-muted-foreground">TBD</span>
      )}
      {won && <span className="rounded-full bg-win-soft px-2 py-0.5 text-xs font-medium text-win">Winner</span>}
    </div>
  );
}

function Lineup({ idx, view, team, stats }: { idx: LeagueIndex; view: GameView; team: Team | null; stats: PlayerGameStat[] }) {
  const rows = [...stats].sort((a, b) => b.kills - a.kills || b.revives - a.revives);
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <TeamLogo team={team} size="sm" />
        <span className="font-semibold">{team?.name}</span>
        <span className="ml-auto text-xs text-muted-foreground">{stats.length} players</span>
      </div>
      <table className="w-full text-sm tabular">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="px-4 py-2 text-left font-normal">Player</th>
            <th className="px-2 py-2 text-center font-normal">Kills</th>
            <th className="px-2 py-2 text-center font-normal">Revives</th>
            <th className="px-4 py-2 text-center font-normal">MVP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const p = idx.playerById.get(s.player_id);
            const isPotm = view.game.potm_player_id === s.player_id;
            return (
              <tr key={s.player_id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/players/${s.player_id}`} className="font-medium hover:text-primary">
                    {p?.ign ?? "Unknown"}
                  </Link>
                  {isPotm && <Trophy className="ml-1 inline size-3.5 text-primary" />}
                </td>
                <td className="px-2 py-2 text-center">{s.kills}</td>
                <td className="px-2 py-2 text-center">{s.revives}</td>
                <td className="px-4 py-2 text-center text-muted-foreground">{num(mvpScore(s, view.season), 1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
