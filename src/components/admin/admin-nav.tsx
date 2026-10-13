"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/seasons", label: "Seasons" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/practice", label: "Practice" },
  { href: "/admin/claims", label: "Claims" },
  { href: "/admin/auction", label: "Auction" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-5 overflow-x-auto text-sm [scrollbar-width:none]">
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn("shrink-0 py-1 font-heading text-[15px] font-semibold tracking-wide text-white/65 uppercase transition-colors hover:text-white", active && "text-white underline decoration-hot decoration-[3px] underline-offset-[10px]")}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
