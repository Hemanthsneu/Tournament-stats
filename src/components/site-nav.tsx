"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AccountButton } from "@/components/account-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SEASON_LINKS = [
  { href: "", label: "Home" },
  { href: "/table", label: "Standings" },
  { href: "/schedule", label: "Schedule" },
  { href: "/playoffs", label: "Playoffs" },
  { href: "/stats", label: "Stats" },
  { href: "/practice", label: "Practice" },
];

const GLOBAL_LINKS = [
  { href: "/teams", label: "Teams" },
  { href: "/players", label: "Players" },
  { href: "/hall-of-fame", label: "Hall of Fame" },
];

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 leading-none", className)} aria-label="WOW League home">
      <span className="font-heading text-[28px] font-extrabold italic tracking-tight">WOW</span>
      <span className="h-5 w-1 -skew-x-12 bg-hot" aria-hidden />
      <span className="font-heading text-[15px] font-semibold tracking-[0.12em]">LEAGUE</span>
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

  const navLinks = (className: string) =>
    links.map((l) => {
      const active = isActive(l.href);
      return (
        <Link
          key={l.href}
          href={l.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "relative flex shrink-0 items-center gap-1.5 font-heading text-[15px] font-semibold tracking-wide text-white/65 uppercase transition-colors hover:text-white",
            active && "text-white after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-hot",
            className,
          )}
        >
          {l.live && <span className="size-1.5 animate-pulse rounded-full bg-hot" aria-label="live" />}
          {l.label}
        </Link>
      );
    });

  return (
    <header className="sticky top-0 z-40 bg-brand text-brand-foreground shadow-[0_1px_0_rgb(255_255_255/0.06)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:gap-8 sm:px-6">
        <Wordmark />
        <nav className="hidden h-full items-stretch gap-6 xl:flex" aria-label="Main">
          {navLinks("h-full")}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {seasons.length > 0 && selected && (
            <Select value={selected} onValueChange={onSeasonChange}>
              <SelectTrigger
                size="sm"
                className="w-28 border-white/15 bg-white/5 text-white hover:bg-white/10 data-[placeholder]:text-white/70 sm:w-auto sm:max-w-44 dark:bg-white/5 [&_svg]:text-white/70"
              >
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
      <nav className="mx-auto flex h-11 max-w-7xl items-stretch gap-5 overflow-x-auto border-t border-white/10 px-4 [scrollbar-width:none] sm:px-6 xl:hidden" aria-label="Main">
        {navLinks("")}
      </nav>
    </header>
  );
}
