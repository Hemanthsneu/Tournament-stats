import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, AtSign, BadgeCheck, CirclePlay, Gavel, Swords, Trophy } from "@/components/icons";
import { FilterPills } from "@/components/filter-pills";
import { EmptyState, SectionTitle } from "@/components/page-header";
import { TeamLink } from "@/components/team";
import { Button } from "@/components/ui/button";
import { credits } from "@/lib/auction";
import { AvailabilityBlock } from "@/components/availability";
import { availabilityMap, availabilitySeasonId, dateAnswers, loadCommunity, matchDaysFor, profileMap, verifiedSet } from "@/lib/community";
import { loadLeague } from "@/lib/data";
import { playerCareer } from "@/lib/engine/players";
import { num } from "@/lib/format";
import { dateKey, fmtDate } from "@/lib/time";
import { onColor, teamColor } from "@/lib/team-colors";
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
  const availability = availabilityMap(community).get(id);
  // The season being answered may still be a draft (hidden here), so it's found from match days.
  const availSeasonId = availabilitySeasonId(community, dateKey(new Date().toISOString()));
  const availSeasonName = idx.seasonById.get(availSeasonId ?? "")?.name ?? "Next season";
  const myDates = dateAnswers(community, availSeasonId).get(id);
  const dates = availSeasonId && myDates ? { days: matchDaysFor(community, availSeasonId).map((d) => ({ day: d.day, label: d.label })), answers: myDates } : undefined;
  const verified = verifiedSet(community).has(id);
  const photo = profile?.photo_url ?? player.photo_url;
  const band = teamColor(currentTeam ?? log[0]?.team ?? null);
  const auctionHistory = community.auctionLots
    .filter((l) => l.player_id === id && (l.status === "sold" || l.status === "unsold"))
    .map((l) => ({ lot: l, auction: community.auctions.find((a) => a.id === l.auction_id && !a.is_practice) }))
    .filter((x) => x.auction);

  return (
    <div className="space-y-16">
      <section className="full-bleed -mt-8 sm:-mt-10" style={{ background: band, color: onColor(band) }}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-end gap-6 px-4 pt-10 pb-8 sm:gap-8 sm:px-6 sm:pt-14">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={player.ign} className="size-28 rounded-xl object-cover ring-4 ring-white/20 sm:size-36" />
          ) : (
            <div className="grid size-28 place-items-center rounded-xl bg-black/15 font-heading text-5xl font-extrabold italic sm:size-36 sm:text-6xl">
              {player.ign.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 font-heading text-sm font-semibold tracking-wide uppercase opacity-90">
              {currentTeam ? (
                <Link href={`/teams/${currentTeam.id}`} className="hover:underline">
                  {currentTeam.name}
                </Link>
              ) : (
                <span>Free agent</span>
              )}
              {profile?.role && <span>· {profile.role}</span>}
              {verified && (
                <span className="inline-flex items-center gap-1 rounded-sm bg-white/90 px-1.5 py-0.5 text-[11px] font-bold tracking-widest text-brand" title="This player has claimed their profile">
                  <BadgeCheck className="size-3.5" /> VERIFIED
                </span>
              )}
            </div>
            <h1 className="mt-2 text-6xl leading-[0.9] sm:text-8xl">{player.ign}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm opacity-85">
              {player.real_name && <span>{player.real_name}</span>}
              {player.bgmi_uid && <span className="font-mono text-xs">UID {player.bgmi_uid}</span>}
              {aliases.length > 0 && <span>formerly {aliases.map((a) => a.ign).join(", ")}</span>}
              {totals.titles > 0 && <span className="font-semibold">{totals.titles}× champion</span>}
              {profile?.instagram && (
                <a href={`https://instagram.com/${profile.instagram}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                  <AtSign className="size-3.5" /> {profile.instagram}
                </a>
              )}
              {profile?.youtube && (
                <a href={profile.youtube} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                  <CirclePlay className="size-3.5" /> YouTube
                </a>
              )}
            </div>
            {profile?.bio && <p className="mt-3 max-w-xl text-base italic opacity-90">“{profile.bio}”</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="bg-white font-semibold text-brand hover:bg-white/90">
              <Link href={`/compare?a=${player.id}`}>
                <Swords /> Compare
              </Link>
            </Button>
          </div>
        </div>
        <div className="bg-black/20">
          <dl className="mx-auto flex max-w-7xl flex-wrap gap-x-10 gap-y-4 px-4 py-5 sm:px-6">
            {[
              ["Games", totals.games],
              ["Kills", totals.kills],
              ["Revives", totals.revives],
              ["MVP pts", num(totals.mvp, 0)],
              ["POTM", totals.potm],
              ["Kills / game", totals.games ? (totals.kills / totals.games).toFixed(1) : "–"],
            ].map(([label, value]) => (
              <div key={label}>
                <dd className="font-heading text-4xl leading-none font-bold tabular">{value}</dd>
                <dt className="mt-1 text-xs font-medium tracking-wide uppercase opacity-75">{label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {((availability && availability.days.length > 0) || dates) && (
        <div className="flex flex-wrap items-start gap-x-8 gap-y-3 rounded-lg border bg-card px-5 py-4">
          <div>
            <div className="font-heading text-sm font-bold tracking-wide uppercase">When they play</div>
            <p className="mt-0.5 text-xs text-muted-foreground">{dates ? `${availSeasonName} match days, shared by the player.` : "Shared by the player for captains and organizers."}</p>
          </div>
          <AvailabilityBlock availability={availability} dates={dates} />
        </div>
      )}

      {auctionHistory.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {auctionHistory.map(({ lot, auction }) => (
            <span key={lot.id} className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs text-muted-foreground">
              <Gavel className="size-3.5" /> {auction!.name}:{" "}
              {lot.status === "sold" ? (
                <span className="font-semibold text-foreground">
                  {idx.teamById.get(lot.sold_team_id ?? "")?.name ?? "?"} · {credits(lot.sold_price ?? 0)}
                </span>
              ) : (
                <span>unsold</span>
              )}
            </span>
          ))}
        </div>
      )}

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
                <tr className="border-b bg-muted/50 font-heading text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
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
                <tr className="border-b bg-muted/50 font-heading text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
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
