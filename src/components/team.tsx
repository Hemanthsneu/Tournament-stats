import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Team } from "@/lib/types";

// Muted, Notion-like tones. Text uses the tone; the chip background is a faint wash of it,
// so the same palette works on the light site and the dark big screen.
const TONES = ["#9f6b53", "#d9730d", "#b8860b", "#448361", "#337ea9", "#9065b0", "#c14c8a", "#d44c47", "#6f6e69"];

function toneFor(name: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 0x01000193) >>> 0;
  return TONES[h % TONES.length];
}

const SIZES = {
  xs: "size-5 text-[8px] rounded-[5px]",
  sm: "size-7 text-[10px] rounded-md",
  md: "size-9 text-[11px] rounded-md",
  lg: "size-14 text-sm rounded-lg",
  xl: "size-20 text-lg rounded-xl",
} as const;

export function TeamLogo({ team, size = "sm", className }: { team: Team | null; size?: keyof typeof SIZES; className?: string }) {
  const base = cn("grid shrink-0 place-items-center overflow-hidden font-semibold tracking-tight", SIZES[size], className);
  if (!team) return <div className={cn(base, "border border-dashed text-muted-foreground")}>?</div>;
  if (team.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={team.logo_url} alt={`${team.name} logo`} className={cn(base, "border bg-card object-cover")} />;
  }
  const tone = toneFor(team.name);
  return (
    <div className={base} style={{ color: tone, background: `color-mix(in oklab, ${tone} 13%, transparent)` }} aria-hidden>
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
        <span>{placeholder}</span>
      </span>
    );
  }
  return (
    <Link href={`/teams/${team.id}`} className={cn("inline-flex min-w-0 items-center gap-2 transition-colors hover:text-muted-foreground", className)}>
      <TeamLogo team={team} size={size} />
      <span className="truncate font-medium">{short ? team.tag : team.name}</span>
    </Link>
  );
}
