import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import { GameCard } from "@/components/game-card";
import { HeroCarousel, type HeroSlide, type TeamLite } from "@/components/home/hero-carousel";
import { PromoBanners, type Promo } from "@/components/home/promo-banners";
import { Reveal } from "@/components/home/reveal";
import { TeamMarquee } from "@/components/home/team-marquee";
import { AwardCards } from "@/components/leaderboard";
import { EmptyState, SectionTitle } from "@/components/page-header";
import { StandingsTable } from "@/components/standings-table";
import { featuredAuction, getViewer, loadCommunity, profileMap, realAuctions } from "@/lib/community";
import { loadSeason } from "@/lib/data";
import {
  currentSeason,
  filterGames,
  isLeagueComplete,
  leagueStandings,
  playoffSeries,
  seasonMaps,
  seasonTeams,
  standingsMovement,
  upNext,
  type GameView,
} from "@/lib/engine/league";
import { playerLeaderboard, rankBy } from "@/lib/engine/players";
import { signed } from "@/lib/format";
import { teamColor } from "@/lib/team-colors";
import { fmtDateTime } from "@/lib/time";
import type { Team } from "@/lib/types";

function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 font-heading text-sm font-semibold tracking-wide text-muted-foreground uppercase transition-colors hover:text-hot">
      {children} <ArrowRight className="size-3.5" />
    </Link>
  );
}

const lite = (t: Team | null): TeamLite | null => (t ? { id: t.id, name: t.name, tag: t.tag, color: teamColor(t) } : null);

function matchSlide(v: GameView, eyebrow: string): HeroSlide {
  return {
    kind: "match",
    id: `match-${v.game.id}`,
    eyebrow,
    href: `/games/${v.game.id}`,
    label: v.label,
    a: lite(v.teamA),
    b: lite(v.teamB),
    ra: v.completed ? v.game.team_a_rounds : null,
    rb: v.completed ? v.game.team_b_rounds : null,
    winnerId: v.winnerId,
    scheduledAt: v.completed ? null : v.game.scheduled_at,
    when: v.game.scheduled_at ? fmtDateTime(v.game.scheduled_at) : null,
    map: v.map?.name ?? null,
  };
}

export default async function SeasonHome({ params }: PageProps<"/s/[season]">) {
  const { season: param } = await params;
  const [{ idx, season }, community, viewer] = await Promise.all([loadSeason(param), loadCommunity(), getViewer()]);
  const official = filterGames(idx, { seasonId: season.id, type: "official" });
  const played = official.filter((g) => g.completed);
  const next = upNext(official, 3);
  const latest = [...played].sort((a, b) => (b.game.scheduled_at ?? "").localeCompare(a.game.scheduled_at ?? "")).slice(0, 6);
  const table = leagueStandings(idx, season);
  const champion = idx.teamById.get(playoffSeries(idx, season.id).get("final")?.winnerId ?? "") ?? null;
  const stage = champion ? "Champions crowned" : isLeagueComplete(idx, season.id) ? "Playoffs" : played.length ? "League stage" : "Coming soon";
  const board = playerLeaderboard(idx, official);
  const teams = seasonTeams(idx, season.id);
  const maps = seasonMaps(idx, season.id);
  const base = `/s/${season.number}`;
  const isCurrent = currentSeason(idx.data)?.id === season.id;
  const totalKills = played.reduce((n, g) => n + g.killsA + g.killsB, 0);

  const auctions = realAuctions(community);
  const auction = featuredAuction({ ...community, auctions });
  const showAuction = auction && (auction.season_id === season.id || (isCurrent && auction.status !== "completed"));
  const auctionLive = auction?.status === "live" || auction?.status === "paused";
  const budgets = auction ? community.auctionTeams.filter((t) => t.auction_id === auction.id).map((t) => t.purse ?? auction.purse) : [];
  const budgetText =
    auction && new Set(budgets).size > 1
      ? `budgets from ${Math.min(...budgets).toLocaleString("en-IN")} to ${Math.max(...budgets).toLocaleString("en-IN")}`
      : `a ${(budgets[0] ?? auction?.purse ?? 0).toLocaleString("en-IN")} purse`;

  // Hero carousel
  const slides: HeroSlide[] = [
    {
      kind: "season",
      id: "season",
      eyebrow: stage,
      live: stage === "League stage",
      title: season.name,
      meta: `${teams.length} teams · ${season.round_robins} round robin${season.round_robins > 1 ? "s" : ""} · ${maps.map((m) => m.name).join(", ") || "maps TBA"} · top 4 to IPL-style playoffs`,
      stats: [
        { label: "Games played", value: played.length },
        { label: "Still to play", value: official.length - played.length },
        { label: "Total kills", value: totalKills },
      ],
      ctas: [
        { label: "Standings", href: `${base}/table`, primary: true },
        { label: "Schedule", href: `${base}/schedule` },
      ],
    },
  ];
  if (champion) {
    slides.push({
      kind: "banner",
      id: "champion",
      tone: "gold",
      eyebrow: `${season.name} champions`,
      title: champion.name,
      text: "Through the league stage and the playoffs. Winner winner, chicken dinner.",
      href: `/teams/${champion.id}`,
      cta: "Champions' page",
      team: lite(champion)!,
    });
  }
  if (showAuction && auctionLive) {
    slides.push({ kind: "banner", id: "auction", live: true, eyebrow: "Auction live", title: auction.name, text: "Captains are bidding right now. Watch every bid, every sold call and every purse in real time.", href: "/auction", cta: "Enter the auction room" });
  }
  if (next[0]) slides.push(matchSlide(next[0], next[0].game.scheduled_at ? "Up next" : "Next match"));
  if (latest[0]) slides.push(matchSlide(latest[0], "Latest result"));
  const fragger = rankBy(board, "kills").find((r) => r.kills > 0);
  if (fragger) {
    slides.push({
      kind: "player",
      id: "fragger",
      eyebrow: "Top fragger",
      ign: fragger.player.ign,
      team: lite(fragger.team),
      photo: profileMap(community).get(fragger.player.id)?.photo_url ?? null,
      href: `/players/${fragger.player.id}`,
      stats: [
        { label: "Kills", value: fragger.kills },
        { label: "Games", value: fragger.games },
        { label: "Kills / game", value: Number(fragger.avgKills.toFixed(1)) },
      ],
    });
  }
  const leader = played.length ? table[0] : null;
  if (leader && !champion) {
    slides.push({
      kind: "banner",
      id: "leader",
      eyebrow: "Top of the table",
      title: leader.team.name,
      text: `${leader.points} points from ${leader.played} games · ${leader.won} won, ${leader.lost} lost · NRR ${signed(leader.nrr)} · ${leader.kills} kills`,
      href: `/teams/${leader.team.id}`,
      cta: "Team page",
      team: lite(leader.team)!,
    });
  }
  if (showAuction && !auctionLive && auction.status === "setup") {
    slides.push({
      kind: "banner",
      id: "auction",
      eyebrow: auction.registration_open ? "Registration open" : "Coming soon",
      title: auction.name,
      text: `${auction.starts_at ? `Starts ${fmtDateTime(auction.starts_at)}. ` : ""}${auction.registration_open ? "Sign in, register for the pool and share when you can play so captains know before they bid." : "Captains bid live for every player. Watch it here."}`,
      href: auction.registration_open ? "/me" : "/auction",
      cta: auction.registration_open ? "Register now" : "Auction room",
      countdownTo: auction.starts_at ?? null,
    });
  }

  // Promo banners
  const promos: Promo[] = [];
  if (showAuction) {
    promos.push(
      auctionLive
        ? { id: "auction", tone: "navy", icon: "crate", live: true, eyebrow: "Live now", title: "The auction is on", text: "Every bid, sold call and purse updates live. Captains bid from their own logins.", href: "/auction", cta: "Enter the room" }
        : auction.status === "completed"
          ? { id: "auction", tone: "navy", icon: "crate", eyebrow: "Auction results", title: "Squads are set", text: "See who went where, for how much, and the steals of the night.", href: "/auction", cta: "See results" }
          : {
              id: "auction",
              tone: "navy",
              icon: "crate",
              eyebrow: auction.registration_open ? "Registration open" : "Coming soon",
              title: auction.name,
              text: `${auction.starts_at ? `Starts ${fmtDateTime(auction.starts_at)}. ` : ""}Captains bid live with ${budgetText}. Register, share your availability, then watch it live.`,
              href: "/auction",
              cta: "Auction room",
            },
    );
  }
  promos.push(
    viewer?.playerId
      ? { id: "availability", tone: "hot", icon: "parachute", eyebrow: "For players", title: "When can you play?", text: "Set your days and hours. Captains see them on the auction screen before they bid.", href: "/me", cta: "Set availability" }
      : { id: "availability", tone: "hot", icon: "parachute", eyebrow: "For players", title: "Claim your profile", text: "Use your claim code to link your stats, add a photo and tell captains when you can play.", href: viewer ? "/me" : "/login", cta: viewer ? "Claim profile" : "Sign in" },
    { id: "hof", tone: "gold", icon: "pan", eyebrow: "All seasons", title: "Hall of Fame", text: "Champions, career leaders and single-game records from every season.", href: "/hall-of-fame", cta: "Explore" },
  );

  const words = [season.name, "WOW mode", "Winner winner chicken dinner"];

  return (
    <div className="space-y-14">
      <div>
        <HeroCarousel slides={slides} />
        <TeamMarquee teams={teams.map((t) => lite(t)!)} words={words} />
      </div>

      <Reveal>
        <PromoBanners promos={promos} />
      </Reveal>

      <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
        <div className="space-y-12">
          {next.length > 0 && (
            <Reveal>
              <SectionTitle action={<MoreLink href={`${base}/schedule`}>Full schedule</MoreLink>}>Upcoming</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                {next.map((v) => (
                  <GameCard key={v.game.id} view={v} idx={idx} showDate />
                ))}
              </div>
            </Reveal>
          )}
          <Reveal>
            <SectionTitle action={<MoreLink href={`${base}/schedule`}>All results</MoreLink>}>Latest results</SectionTitle>
            {latest.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {latest.map((v) => (
                  <GameCard key={v.game.id} view={v} idx={idx} showDate />
                ))}
              </div>
            ) : (
              <EmptyState title="No results yet" />
            )}
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <aside>
            <SectionTitle action={<MoreLink href={`${base}/table`}>Full table</MoreLink>}>Standings</SectionTitle>
            {table.length ? <StandingsTable rows={table} compact playoffLines movement={standingsMovement(idx, season)} /> : <EmptyState title="No teams yet" />}
          </aside>
        </Reveal>
      </div>

      <Reveal>
        <SectionTitle action={<MoreLink href={`${base}/stats`}>All stats</MoreLink>}>Stat leaders</SectionTitle>
        <AwardCards rows={board} keys={["mvp", "kills", "revives"]} interactive />
      </Reveal>
    </div>
  );
}
