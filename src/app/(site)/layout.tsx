import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { currentSeason, sortedSeasons } from "@/lib/engine/league";
import { featuredAuction, loadCommunity } from "@/lib/community";
import { loadLeague } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const { idx, demo } = await loadLeague();
  const seasons = sortedSeasons(idx.data).filter((s) => s.status !== "draft");
  const current = currentSeason(idx.data);
  const auction = featuredAuction(await loadCommunity());
  return (
    <>
      {demo && (
        <div className="bg-primary px-4 py-1.5 text-center text-xs font-medium text-primary-foreground">
          Demo data. Connect Supabase to show your real league.
        </div>
      )}
      <SiteNav
        seasons={seasons.map((s) => ({ number: s.number, name: s.name }))}
        current={current?.number ?? null}
        auction={auction ? { live: auction.status === "live" || auction.status === "paused" } : null}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8">{children}</main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground">
          <span>BGMI · WOW mode league stats</span>
          <Link href="/admin" className="hover:text-foreground">
            Organizer login
          </Link>
        </div>
      </footer>
    </>
  );
}
