import Link from "next/link";
import { ScoreTicker } from "@/components/score-ticker";
import { SiteNav, Wordmark } from "@/components/site-nav";
import { featuredAuction, loadCommunity } from "@/lib/community";
import { activeSeasons, compareGames, filterGames, seasonPhase, sortedSeasons, upNext } from "@/lib/engine/league";
import { loadLeague, preferredSeason } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const { idx, demo } = await loadLeague();
  const seasons = sortedSeasons(idx.data).filter((s) => s.status !== "draft");
  const current = await preferredSeason(idx);
  const auction = featuredAuction(await loadCommunity());
  // Ticker: the next games, then the latest results, across every active season (or the current one).
  const live = activeSeasons(idx.data);
  const tickerSeasons = live.length ? live : current ? [current] : [];
  const official = tickerSeasons.flatMap((s) => filterGames(idx, { seasonId: s.id, type: "official" }));
  const recent = official
    .filter((g) => g.completed)
    .sort((a, b) => (b.game.scheduled_at ?? "").localeCompare(a.game.scheduled_at ?? "") || compareGames(b, a))
    .slice(0, 8);
  const ticker = [...upNext(official, tickerSeasons.length > 1 ? 6 : 4), ...recent];
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm">
        Skip to content
      </a>
      {demo && (
        <div className="bg-hot px-4 py-1.5 text-center text-xs font-medium text-white">Demo data. Connect Supabase to show your real league.</div>
      )}
      <SiteNav
        seasons={seasons.map((s) => ({ number: s.number, name: s.name, active: s.status === "active", phase: seasonPhase(idx, s) }))}
        current={current?.number ?? null}
        auction={auction ? { live: auction.status === "live" || auction.status === "paused" } : null}
      />
      <ScoreTicker games={ticker} showSeason={tickerSeasons.length > 1} />
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pt-8 pb-24 sm:px-6 sm:pt-10">
        <div className="rise">{children}</div>
      </main>
      <footer className="bg-brand text-brand-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm sm:px-6">
          <Wordmark />
          <div className="flex items-center gap-6 text-white/60">
            <span>BGMI · WOW mode league</span>
            <Link href="/admin" className="transition-colors hover:text-white">
              Organizers
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
