import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { featuredAuction, loadCommunity } from "@/lib/community";
import { currentSeason, sortedSeasons } from "@/lib/engine/league";
import { loadLeague } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const { idx, demo } = await loadLeague();
  const seasons = sortedSeasons(idx.data).filter((s) => s.status !== "draft");
  const current = currentSeason(idx.data);
  const auction = featuredAuction(await loadCommunity());
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm">
        Skip to content
      </a>
      {demo && (
        <div className="border-b bg-gold-soft px-4 py-1.5 text-center text-xs text-gold">Demo data. Connect Supabase to show your real league.</div>
      )}
      <SiteNav
        seasons={seasons.map((s) => ({ number: s.number, name: s.name }))}
        current={current?.number ?? null}
        auction={auction ? { live: auction.status === "live" || auction.status === "paused" } : null}
      />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-10 pb-24 sm:px-6 sm:pt-14">
        <div className="rise">{children}</div>
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:px-6">
          <span>WOW League · BGMI WOW mode</span>
          <Link href="/admin" className="transition-colors hover:text-foreground">
            Organizers
          </Link>
        </div>
      </footer>
    </>
  );
}
