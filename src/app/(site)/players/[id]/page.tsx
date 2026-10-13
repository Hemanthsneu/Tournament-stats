import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, AtSign, BadgeCheck, CirclePlay, Gavel, Swords, Trophy } from "@/components/icons";
import { FilterPills } from "@/components/filter-pills";
import { EmptyState, SectionTitle } from "@/components/page-header";
import { TeamLink, TeamLogo } from "@/components/team";
import { Button } from "@/components/ui/button";
import { credits } from "@/lib/auction";
import { loadCommunity, profileMap, verifiedSet } from "@/lib/community";
import { loadLeague } from "@/lib/data";
import { playerCareer } from "@/lib/engine/players";
import { num } from "@/lib/format";
import { fmtDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { FixtureType } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/players/[id]">) {
  const { idx } = await loadLeague();
  return { title: idx.playerById.get((await params).id)?.ign ?? "Player" };
}

export default async function PlayerPage({ params, searchParams }: PageProps<"/players/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const type: FixtureType | "all" = sp.type === "practice" || sp.type === "all" ? sp.type : "official";
  const [{ idx }, community] = await Promise.all([loadLeague(), loadCommunity()]);
  const career = playerCareer(idx, id, type);
  if (!career) notFound();
  const { player, totals, seasons, log, history, currentTeam } = career;
  const aliases = idx.data.aliases.filter((a) => a.player_id === id);
  const profile = profileMap(community).get(id);
  const verified = verifiedSet(community).has(id);
  const photo = profile?.photo_url ?? player.photo_url;
  const auctionHistory = community.auctionLots
    .filter((l) => l.player_id === id && (l.status === "sold" || l.status === "unsold"))
    .map((l) => ({ lot: l, auction: community.auctions.find((a) => a.id === l.auction_id && !a.is_practice) }))
    .filter((x) => x.auction);

  return (
    <div className="space-y-16">
      <section className="flex flex-wrap items-end gap-x-10 gap-y-8">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={`${player.ign}`} className="size-24 rounded-2xl object-cover" />
        ) : (
          <TeamLogo team={currentTeam} size="xl" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-win-soft px-2 py-0.5 font-medium text-win" title="This player has claimed their profile">
                <BadgeCheck className="size-3.5" /> Verified
              </span>
            )}
            {profile?.role && <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{profile.role}</span>}
          </div>
          <h1 className="mt-2 text-5xl leading-none sm:text-6xl">{player.ign}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {currentTeam ? <TeamLink team={currentTeam} size="xs" /> : <span>Free agent</span>}
            {player.real_name && <span>{player.real_name}</span>}
            {player.bgmi_uid && <span className="font-mono text-xs">UID {player.bgmi_uid}</span>}
            {aliases.length > 0 && <span>formerly {aliases.map((a) => a.ign).join(", ")}</span>}
            {totals.titles > 0 && <span className="text-gold">{totals.titles}× champion</span>}
            {profile?.instagram && (
              <a href={`https://instagram.com/${profile.instagram}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                <AtSign className="size-3.5" /> {profile.instagram}
              </a>
            )}
            {profile?.youtube && (
              <a href={profile.youtube} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                <CirclePlay className="size-3.5" /> YouTube
              </a>
            )}
          </div>
          {profile?.bio && <p className="mt-3 max-w-xl font-heading text-xl italic text-foreground/80">“{profile.bio}”</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/compare?a=${player.id}`}>
                <Swords /> Compare
              </Link>
            </Button>
            {auctionHistory.map(({ lot, auction }) => (
              <span key={lot.id} className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                <Gavel className="size-3.5" /> {auction!.name}:{" "}
                {lot.status === "sold" ? (
                  <span className="font-medium text-foreground">
                    {idx.teamById.get(lot.sold_team_id ?? "")?.name ?? "?"} · {credits(lot.sold_price ?? 0)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">unsold</span>
                )}
              </span>
            ))}
          </div>
        </div>
        <dl className="grid grid-cols-5 gap-6 sm:gap-8">
          {[
            ["Games", totals.games],
            ["Kills", totals.kills],
            ["Revives", totals.revives],
            ["MVP", num(totals.mvp, 0)],
            ["POTM", totals.potm],
          ].map(([label, value]) => (
            <div key={label}>
              <dd className="text-2xl font-medium tabular">{value}</dd>
              <dt className="mt-0.5 text-xs text-muted-foreground">{label}</dt>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {history.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Team history:</span>
            {history.map((h, i) => (
              <span key={`${h.season.id}-${h.team.id}`} className="inline-flex items-center gap-2">
                {i > 0 && <ArrowRight className="size-3 text-muted-foreground" />}
                <span className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1">
                  <span className="text-xs text-muted-foreground">S{h.season.number}</span>
                  <TeamLink team={h.team} size="xs" short />
                </span>
              </span>
            ))}
          </div>
        ) : (
          <span />
        )}
        <FilterPills
          value={type}
          options={[
            { value: "official", label: "Official", href: `/players/${id}` },
            { value: "practice", label: "Practice", href: `/players/${id}?type=practice` },
            { value: "all", label: "All", href: `/players/${id}?type=all` },
          ]}
        />
      </div>

      <section>
        <SectionTitle>Season by season</SectionTitle>
        {seasons.length === 0 ? (
          <EmptyState title="No seasons yet" />
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-max text-sm tabular">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  {["Season", "Team", "Games", "Kills", "Revives", "Avg kills", "MVP", "POTM", "Team finish"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {seasons.map((s) => (
                  <tr key={s.season.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium">{s.season.name}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-2">
                        {s.teams.map((t) => <TeamLink key={t.id} team={t} size="xs" short />)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">{s.games}</td>
                    <td className="px-4 py-2.5 font-semibold">{s.kills}</td>
                    <td className="px-4 py-2.5">{s.revives}</td>
                    <td className="px-4 py-2.5">{s.avgKills.toFixed(2)}</td>
                    <td className="px-4 py-2.5">{num(s.mvp, 0)}</td>
                    <td className="px-4 py-2.5">{s.potm}</td>
                    <td className="px-4 py-2.5">{s.finish === "Champion" ? <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-medium text-gold">Champion</span> : s.finish ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Game log</SectionTitle>
        {log.length === 0 ? (
          <EmptyState title="No games for this filter" />
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-max text-sm tabular">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  {["Date", "Game", "Team", "Opponent", "Map", "Result", "Kills", "Revives"].map((h) => (
                    <th key={h} className="px-3 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {log.map((r) => {
                  const ownRounds = r.stat.team_id === r.view.fixture.team_a_id ? r.view.game.team_a_rounds : r.view.game.team_b_rounds;
                  const oppRounds = r.stat.team_id === r.view.fixture.team_a_id ? r.view.game.team_b_rounds : r.view.game.team_a_rounds;
                  return (
                    <tr key={r.view.game.id} className="border-b last:border-0 hover:bg-accent/40">
                      <td className="px-3 py-2 text-muted-foreground">{r.view.game.scheduled_at ? fmtDate(r.view.game.scheduled_at) : "–"}</td>
                      <td className="px-3 py-2">
                        <Link href={`/games/${r.view.game.id}`} className="hover:text-primary">
                          S{r.view.season.number} · {r.view.label}
                        </Link>
                      </td>
                      <td className="px-3 py-2"><TeamLink team={r.team} size="xs" short /></td>
                      <td className="px-3 py-2"><TeamLink team={r.opponent} size="xs" short /></td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.view.map?.name ?? "–"} {r.view.game.squad_size && <span className="text-xs">({r.view.game.squad_size}v{r.view.game.squad_size})</span>}
                      </td>
                      <td className={cn("px-3 py-2 font-medium", r.won ? "text-win" : "text-loss")}>
                        {r.won ? "W" : "L"} {ownRounds}–{oppRounds}
                      </td>
                      <td className="px-3 py-2 font-semibold">
                        {r.stat.kills}
                        {r.isPotm && <Trophy className="ml-1 inline size-3.5 text-primary" />}
                      </td>
                      <td className="px-3 py-2">{r.stat.revives}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
