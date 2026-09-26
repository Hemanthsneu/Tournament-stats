import Link from "next/link";
import { notFound } from "next/navigation";
import { ResultForm, type SideData } from "@/components/admin/result-form";
import { Badge } from "@/components/ui/badge";
import { loadLeague } from "@/lib/data";
import { seasonMaps, upNext, type LeagueIndex } from "@/lib/engine/league";
import { fmtDateTime } from "@/lib/time";
import type { GameMap, PlayerGameStat } from "@/lib/types";

export const metadata = { title: "Enter result · Admin" };

function side(idx: LeagueIndex, seasonId: string, teamId: string, gameDate: string | null, stats: PlayerGameStat[]): SideData {
  const team = idx.teamById.get(teamId)!;
  const date = (gameDate ?? new Date().toISOString()).slice(0, 10);
  const entries = idx.data.rosters.filter((r) => r.season_id === seasonId && r.team_id === teamId);
  const seen = new Set<string>();
  const players = entries
    .map((r) => {
      const p = idx.playerById.get(r.player_id);
      if (!p || seen.has(p.id)) return null;
      seen.add(p.id);
      const activeThen = r.joined_on <= date && (!r.left_on || r.left_on > date);
      return { id: p.id, ign: p.ign, note: activeThen ? undefined : r.left_on ? `left ${r.left_on}` : `joins ${r.joined_on}`, activeThen };
    })
    .filter((p): p is NonNullable<typeof p> => !!p)
    .sort((a, b) => Number(b.activeThen) - Number(a.activeThen) || a.ign.localeCompare(b.ign))
    .map(({ id, ign, note }) => ({ id, ign, note }));
  for (const s of stats) {
    if (!seen.has(s.player_id)) {
      const p = idx.playerById.get(s.player_id);
      if (p) players.push({ id: p.id, ign: p.ign, note: "stand-in" });
      seen.add(s.player_id);
    }
  }
  return {
    teamId,
    name: team.name,
    tag: team.tag,
    players,
    stats: Object.fromEntries(stats.map((s) => [s.player_id, { kills: s.kills, revives: s.revives }])),
  };
}

export default async function EnterResultPage({ params }: PageProps<"/admin/games/[id]">) {
  const { id } = await params;
  const { idx } = await loadLeague(true);
  const view = idx.viewById.get(id);
  if (!view) notFound();
  const { game, fixture, season } = view;
  const back = fixture.type === "practice" ? "/admin/practice" : `/admin/seasons/${season.id}/schedule`;

  if (!fixture.team_a_id || !fixture.team_b_id) {
    return (
      <div className="rounded-xl border p-8 text-center">
        <p className="font-medium">Teams for this playoff game aren&apos;t decided yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">They fill in automatically once the earlier results are published.</p>
        <Link href={back} className="mt-4 inline-block text-primary">
          ← Back
        </Link>
      </div>
    );
  }

  const pool = seasonMaps(idx, season.id);
  const maps: GameMap[] = [...pool];
  if (view.map && !maps.some((m) => m.id === view.map!.id)) maps.push(view.map);
  const next = upNext(idx.views.filter((v) => v.season.id === season.id && v.fixture.type === fixture.type && v.game.id !== id))[0];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href={back} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">
          {view.teamA?.name} vs {view.teamB?.name}
        </h1>
        <Badge variant="outline">{view.label}</Badge>
        {fixture.type === "practice" && <Badge variant="secondary">Practice</Badge>}
        {view.completed && <Badge>Result published</Badge>}
        <span className="text-sm text-muted-foreground">
          {season.name}
          {game.scheduled_at && ` · ${fmtDateTime(game.scheduled_at)}`}
        </span>
      </div>
      <ResultForm
        key={`${game.id}-${game.status}-${view.statsA.length + view.statsB.length}`}
        gameId={game.id}
        isOfficial={fixture.type === "official"}
        weights={{ kill: Number(season.mvp_kill_weight), revive: Number(season.mvp_revive_weight) }}
        maps={maps.map((m) => ({ id: m.id, name: m.name, total_rounds: m.total_rounds }))}
        initial={{
          map_id: game.map_id,
          squad_size: game.squad_size,
          team_a_rounds: game.team_a_rounds,
          team_b_rounds: game.team_b_rounds,
          potm_player_id: game.potm_player_id,
          completed: view.completed,
        }}
        sides={[
          side(idx, season.id, fixture.team_a_id, game.scheduled_at, view.statsA),
          side(idx, season.id, fixture.team_b_id, game.scheduled_at, view.statsB),
        ]}
        allPlayers={[...idx.data.players].sort((a, b) => a.ign.localeCompare(b.ign)).map((p) => ({ id: p.id, ign: p.ign }))}
        nextHref={next ? `/admin/games/${next.game.id}` : null}
      />
    </div>
  );
}
