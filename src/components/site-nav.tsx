"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Crosshair } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SEASON_LINKS = [
  { href: "", label: "Home" },
  { href: "/table", label: "Points Table" },
  { href: "/schedule", label: "Schedule" },
  { href: "/playoffs", label: "Playoffs" },
  { href: "/practice", label: "Practice" },
  { href: "/stats", label: "Stats & Awards" },
];

const GLOBAL_LINKS = [
  { href: "/teams", label: "Teams" },
  { href: "/players", label: "Players" },
];

export function SiteNav({ seasons, current }: { seasons: { number: number; name: string }[]; current: number | null }) {
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
    ...GLOBAL_LINKS,
  ];

  const isActive = (href: string) =>
    href.split("/").length === 3 ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-heading text-lg font-extrabold tracking-tight">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Crosshair className="size-5" />
          </span>
          <span>
            WOW <span className="text-primary">League</span>
          </span>
        </Link>
        {seasons.length > 0 && selected && (
          <div className="ml-auto">
            <Select value={selected} onValueChange={onSeasonChange}>
              <SelectTrigger size="sm" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {seasons.map((s) => (
                  <SelectItem key={s.number} value={String(s.number)}>
                    {s.name}
                  </SelectItem>
                ))}
                {section === "/stats" && <SelectItem value="all">All-time</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 pb-2 text-sm [scrollbar-width:none]">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground",
              isActive(l.href) && "bg-accent text-foreground",
            )}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
