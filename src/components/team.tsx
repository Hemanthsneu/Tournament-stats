import Link from "next/link";
import { onColor, teamColor } from "@/lib/team-colors";
import { cn } from "@/lib/utils";
import type { Team } from "@/lib/types";

const SIZES = {
  xs: "size-5 text-[9px] rounded-[4px]",
  sm: "size-7 text-[11px] rounded-[5px]",
  md: "size-9 text-[13px] rounded-md",
  lg: "size-14 text-lg rounded-lg",
  xl: "size-20 text-2xl rounded-xl",
} as const;

/** Solid team-colour badge with the tag, like a sports logo tile. */
export function TeamLogo({ team, size = "sm", className }: { team: Team | null; size?: keyof typeof SIZES; className?: string }) {
  const base = cn("grid shrink-0 place-items-center overflow-hidden font-heading leading-none font-bold uppercase", SIZES[size], className);
  // Spans, not divs: logos sit inside links and sentences.
  if (!team) return <span className={cn(base, "border border-dashed bg-card text-muted-foreground")}>?</span>;
  if (team.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={team.logo_url} alt={`${team.name} logo`} className={cn(base, "bg-card object-cover ring-1 ring-border")} />;
  }
  const color = teamColor(team);
  return (
    <span className={base} style={{ background: color, color: onColor(color) }} aria-hidden>
      {team.tag.slice(0, 4)}
    </span>
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
        <span>{placeholder}</span>
      </span>
    );
  }
  return (
    <Link href={`/teams/${team.id}`} className={cn("inline-flex min-w-0 items-center gap-2 transition-colors hover:text-hot", className)}>
      <TeamLogo team={team} size={size} />
      <span className="truncate font-semibold">{short ? team.tag : team.name}</span>
    </Link>
  );
}
