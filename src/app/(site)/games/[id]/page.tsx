import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy } from "lucide-react";
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

      <section className="rounded-2xl border bg-card p-5 sm:p-8">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <ScoreSide team={teamA} won={completed ? winnerId === teamA?.id : null} />
          <div className="text-center">
            {completed ? (
              <div className="font-heading text-4xl font-extrabold tabular sm:text-6xl">
                <span className={winnerId === teamA?.id ? "text-primary" : "text-muted-foreground"}>{game.team_a_rounds}</span>
                <span className="mx-2 text-muted-foreground">–</span>
                <span className={winnerId === teamB?.id ? "text-primary" : "text-muted-foreground"}>{game.team_b_rounds}</span>
              </div>
            ) : (
              <div className="font-heading text-3xl font-bold text-muted-foreground">vs</div>
            )}
            <div className="mt-2 text-xs text-muted-foreground">rounds won</div>
          </div>
          <ScoreSide team={teamB} won={completed ? winnerId === teamB?.id : null} />
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 border-t pt-4 text-sm text-muted-foreground">
          {map && (
            <span>
              Map: <b className="text-foreground">{map.name}</b> · {map.total_rounds} rounds
              {map.wow_map_id && (
                <>
                  {" "}
                  · WOW ID <span className="font-mono text-foreground">{map.wow_map_id}</span>
                </>
              )}
            </span>
          )}
          {game.squad_size && (
            <span>
              Format: <b className="text-foreground">{game.squad_size}v{game.squad_size}</b>
            </span>
          )}
          {completed && (
            <>
              <span>
                Kills <b className="text-foreground">{view.killsA}–{view.killsB}</b>
              </span>
              <span>
                Revives <b className="text-foreground">{view.revivesA}–{view.revivesB}</b>
              </span>
            </>
          )}
          {potm && (
            <span className="inline-flex items-center gap-1 text-primary">
              <Trophy className="size-4" /> Player of the Match:{" "}
              <Link href={`/players/${potm.id}`} className="font-semibold hover:underline">
                {potm.ign}
              </Link>
            </span>
          )}
        </div>
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
        <Link href={`/teams/${team.id}`} className={cn("font-heading text-lg font-bold hover:text-primary sm:text-2xl", won === false && "text-muted-foreground")}>
          {team.name}
        </Link>
      ) : (
        <span className="italic text-muted-foreground">TBD</span>
      )}
      {won && <Badge>Winner</Badge>}
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
          <tr className="border-b text-xs uppercase text-muted-foreground">
            <th className="px-4 py-2 text-left font-medium">Player</th>
            <th className="px-2 py-2 text-center font-medium">Kills</th>
            <th className="px-2 py-2 text-center font-medium">Revives</th>
            <th className="px-4 py-2 text-center font-medium">MVP</th>
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
