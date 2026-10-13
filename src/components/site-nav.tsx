"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AccountButton } from "@/components/account-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SEASON_LINKS = [
  { href: "", label: "Home" },
  { href: "/table", label: "Table" },
  { href: "/schedule", label: "Schedule" },
  { href: "/playoffs", label: "Playoffs" },
  { href: "/practice", label: "Practice" },
  { href: "/stats", label: "Stats" },
];

const GLOBAL_LINKS = [
  { href: "/teams", label: "Teams" },
  { href: "/players", label: "Players" },
  { href: "/hall-of-fame", label: "Hall of Fame" },
];

export function Wordmark() {
  return (
    <Link href="/" className="flex items-baseline gap-1.5 leading-none">
      <span className="font-heading text-[26px] italic">WOW</span>
      <span className="text-sm font-medium text-muted-foreground">League</span>
    </Link>
  );
}

export function SiteNav({
  seasons,
  current,
  auction,
}: {
  seasons: { number: number; name: string }[];
  current: number | null;
  /** Shown as an "Auction" link (with a live dot while bidding is on). */
  auction?: { live: boolean } | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const match = /^\/s\/(\d+|all)(\/[^/]+)?/.exec(pathname);
  const selected = match?.[1] ?? (current != null ? String(current) : null);
  const seasonForLinks = selected === "all" ? current : selected;
  const section = match?.[2] ?? "";

  // Stay on the same section when switching seasons ("All-time" is only offered on Stats).
  const onSeasonChange = (value: string) => router.push(`/s/${value}${match ? section : ""}`);

  const links = [
    ...(seasonForLinks != null ? SEASON_LINKS.map((l) => ({ ...l, href: `/s/${seasonForLinks}${l.href}` })) : []),
    ...(auction ? [{ href: "/auction", label: "Auction", live: auction.live }] : []),
    ...GLOBAL_LINKS,
  ] as { href: string; label: string; live?: boolean }[];

  const isActive = (href: string) =>
    href.split("/").length === 3 ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Wordmark />
        <div className="ml-auto flex items-center gap-1.5">
          {seasons.length > 0 && selected && (
            <Select value={selected} onValueChange={onSeasonChange}>
              <SelectTrigger size="sm" className="max-w-44 border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-accent hover:text-foreground dark:bg-transparent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {seasons.map((s) => (
                  <SelectItem key={s.number} value={String(s.number)}>
                    {s.name}
                  </SelectItem>
                ))}
                {section === "/stats" && <SelectItem value="all">All-time</SelectItem>}
              </SelectContent>
            </Select>
          )}
          <AccountButton />
        </div>
      </div>
      <nav className="mx-auto flex max-w-6xl gap-5 overflow-x-auto px-4 text-sm [scrollbar-width:none] sm:px-6" aria-label="Main">
        {links.map((l) => {
          const active = isActive(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 pt-1 pb-3 text-muted-foreground transition-colors hover:text-foreground",
                active && "text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-foreground",
              )}
            >
              {l.live && <span className="size-1.5 animate-pulse rounded-full bg-loss" aria-label="live" />}
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
