"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SeasonTabs({ seasonId }: { seasonId: string }) {
  const pathname = usePathname();
  const base = `/admin/seasons/${seasonId}`;
  const tabs = [
    { href: base, label: "Settings & maps" },
    { href: `${base}/teams`, label: "Teams & rosters" },
    { href: `${base}/schedule`, label: "Schedule" },
  ];
  return (
    <div className="mb-6 flex gap-1 border-b">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground",
            pathname === t.href && "border-primary text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
