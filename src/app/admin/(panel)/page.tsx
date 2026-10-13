import Link from "next/link";
import { CheckCircle2, Circle } from "@/components/icons";
import { Panel } from "@/components/admin/fields";
import { TeamLogo } from "@/components/team";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loadLeague } from "@/lib/data";
import { currentSeason, filterGames, seasonMaps, seasonTeams, sortedSeasons, upNext } from "@/lib/engine/league";
import { fmtDateTime } from "@/lib/time";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  const { idx } = await loadLeague(true);
  const season = currentSeason(idx.data) ?? sortedSeasons(idx.data)[0] ?? null;

  if (!season) {
    return (
      <Panel title="Welcome! Let's set up Season 1" description="Create the season, add teams, players and maps, then generate the schedule.">
        <Button asChild>
          <Link href="/admin/seasons">Create Season 1</Link>
        </Button>
      </Panel>
    );
  }

  const teams = seasonTeams(idx, season.id);
  const maps = seasonMaps(idx, season.id);
  const rosterCount = idx.data.rosters.filter((r) => r.season_id === season.id && !r.left_on).length;
  const official = filterGames(idx, { seasonId: season.id, type: "official" });
  const league = official.filter((g) => g.fixture.stage === "league");
  const dated = league.filter((g) => g.game.scheduled_at).length;
  const pending = upNext(filterGames(idx, { seasonId: season.id }), 8);
  const recent = filterGames(idx, { seasonId: season.id })
    .filter((g) => g.completed)
    .sort((a, b) => (b.game.scheduled_at ?? "").localeCompare(a.game.scheduled_at ?? ""))
    .slice(0, 6);
  const base = `/admin/seasons/${season.id}`;

  const steps = [
    { done: teams.length >= 2, label: `Teams in the season (${teams.length})`, href: `${base}/teams` },
    { done: rosterCount > 0, label: `Players on rosters (${rosterCount})`, href: `${base}/teams` },
    { done: maps.length > 0, label: `Maps with WOW IDs (${maps.length})`, href: base },
    { done: league.length > 0, label: `Schedule generated (${league.length} league games)`, href: `${base}/schedule` },
    { done: league.length > 0 && dated === league.length, label: `Dates & times set (${dated}/${league.length})`, href: `${base}/schedule` },
    { done: season.status !== "draft", label: `Season published (status: ${season.status})`, href: base },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{season.name}</h1>
        <Badge variant="outline">{season.status}</Badge>
        <Button asChild variant="outline" size="sm" className="ml-auto">
          <Link href={base}>Season settings</Link>
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Setup checklist" className="lg:col-span-1">
          <ul className="space-y-2 text-sm">
            {steps.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="flex items-center gap-2 hover:text-primary">
                  {s.done ? <CheckCircle2 className="size-4 text-win" /> : <Circle className="size-4 text-muted-foreground" />}
                  <span className={s.done ? "text-muted-foreground" : ""}>{s.label}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            A season stays hidden from the public site while its status is <b>draft</b>.
          </p>
        </Panel>
        <Panel title="Enter results" description="Next games waiting for a result (official and practice)." className="lg:col-span-2">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing waiting. Generate the schedule or add a practice game.</p>
          ) : (
            <ul className="divide-y">
              {pending.map((v) => (
                <li key={v.game.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="w-40 text-xs text-muted-foreground">
                    <div className="font-medium text-foreground">{v.label}</div>
                    {v.game.scheduled_at ? fmtDateTime(v.game.scheduled_at) : "No time set"}
                  </div>
                  <div className="flex flex-1 items-center gap-2 text-sm">
                    <TeamLogo team={v.teamA} size="xs" /> {v.teamA?.tag}
                    <span className="text-muted-foreground">vs</span>
                    <TeamLogo team={v.teamB} size="xs" /> {v.teamB?.tag}
                    <span className="text-xs text-muted-foreground">· {v.map?.name ?? "map TBD"}</span>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/admin/games/${v.game.id}`}>Enter result</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      {recent.length > 0 && (
        <Panel title="Recently entered" description="Click to correct a result. Everything recalculates.">
          <div className="flex flex-wrap gap-2">
            {recent.map((v) => (
              <Link key={v.game.id} href={`/admin/games/${v.game.id}`} className="rounded-lg border px-3 py-2 text-sm hover:border-primary/50">
                {v.label}: {v.teamA?.tag} {v.game.team_a_rounds}–{v.game.team_b_rounds} {v.teamB?.tag}
              </Link>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
