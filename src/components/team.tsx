import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Team } from "@/lib/types";

// Stable, well-spread colour per team (FNV-1a over the name, golden-angle spacing).
function hueFor(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 0x01000193) >>> 0;
  return Math.round((h % 1000) * 137.508) % 360;
}

const SIZES = {
  xs: "size-5 text-[8px]",
  sm: "size-7 text-[10px]",
  md: "size-9 text-xs",
  lg: "size-14 text-base",
  xl: "size-20 text-xl",
} as const;

export function TeamLogo({ team, size = "sm", className }: { team: Team | null; size?: keyof typeof SIZES; className?: string }) {
  const base = cn("shrink-0 rounded-md grid place-items-center font-heading font-bold overflow-hidden", SIZES[size], className);
  if (!team) return <div className={cn(base, "bg-muted text-muted-foreground")}>?</div>;
  if (team.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={team.logo_url} alt="" className={cn(base, "object-cover bg-muted")} />;
  }
  const hue = hueFor(team.name);
  return (
    <div
      className={cn(base, "text-white ring-1 ring-white/10")}
      style={{ background: `linear-gradient(135deg, oklch(0.52 0.14 ${hue}), oklch(0.36 0.1 ${hue}))` }}
    >
      {team.tag.slice(0, 4)}
    </div>
  );
}

export function TeamLink({
  team,
  size = "sm",
  short = false,
  className,
  placeholder = "TBD",
}: {
  team: Team | null;
  size?: keyof typeof SIZES;
  short?: boolean;
  className?: string;
  placeholder?: string;
}) {
  if (!team) {
    return (
      <span className={cn("inline-flex items-center gap-2 text-muted-foreground", className)}>
        <TeamLogo team={null} size={size} />
        <span className="italic">{placeholder}</span>
      </span>
    );
  }
  return (
    <Link href={`/teams/${team.id}`} className={cn("inline-flex min-w-0 items-center gap-2 hover:text-primary", className)}>
      <TeamLogo team={team} size={size} />
      <span className="truncate font-medium">{short ? team.tag : team.name}</span>
    </Link>
  );
}
