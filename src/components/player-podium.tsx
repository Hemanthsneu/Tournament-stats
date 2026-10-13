import Link from "next/link";
import { onColor, teamColor } from "@/lib/team-colors";
import { cn } from "@/lib/utils";
import type { Player, Team } from "@/lib/types";

export const MEDALS = ["#f2b705", "#b8c2d1", "#cd7f32"] as const;

/** Player photo, or initials on the team colour when there isn't one. */
export function PlayerAvatar({ ign, photo, team, className, style }: { ign: string; photo: string | null; team: Team | null; className?: string; style?: React.CSSProperties }) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt={ign} className={cn("shrink-0 object-cover", className)} style={style} />;
  }
  const color = teamColor(team);
  return (
    <span className={cn("grid shrink-0 place-items-center font-heading leading-none font-extrabold italic", className)} style={{ background: color, color: onColor(color), ...style }} aria-hidden>
      {ign.slice(0, 2).toUpperCase()}
    </span>
  );
}

export interface PodiumEntry {
  player: Player;
  team: Team | null;
  photo: string | null;
  value: string;
}

/** Top three as a podium: 2nd, 1st (raised), 3rd. Listed in rank order; laid out with CSS order. */
export function Podium({ title, stat, icon, entries }: { title: string; stat: string; icon: React.ReactNode; entries: PodiumEntry[] }) {
  return (
    <section className="dark overflow-hidden rounded-xl bg-brand text-white">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-3">
        <span className="text-hot">{icon}</span>
        <h2 className="font-heading text-lg font-bold tracking-wide uppercase">{title}</h2>
        <span className="ml-auto text-xs text-white/50">Career · official games</span>
      </div>
      <ol className="grid grid-cols-3 items-end gap-2 px-3 pt-6 pb-5 sm:gap-4 sm:px-5">
        {entries.slice(0, 3).map((e, i) => {
          const first = i === 0;
          return (
            <li key={e.player.id} className={cn("flex flex-col items-center text-center", first ? "order-2" : i === 1 ? "order-1" : "order-3")}>
              <Link href={`/players/${e.player.id}`} className="group flex flex-col items-center">
                <span className="relative">
                  <PlayerAvatar
                    ign={e.player.ign}
                    photo={e.photo}
                    team={e.team}
                    style={{ "--tw-ring-color": MEDALS[i] } as React.CSSProperties}
                    className={cn("rounded-2xl ring-4 ring-offset-4 ring-offset-brand transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-105", first ? "size-24 text-4xl sm:size-28" : "size-16 text-2xl sm:size-20")}
                  />
                  <span
                    className="absolute -right-2 -bottom-2 grid size-7 place-items-center rounded-full font-heading text-sm font-extrabold text-brand ring-2 ring-brand"
                    style={{ background: MEDALS[i] }}
                  >
                    {i + 1}
                  </span>
                </span>
                <span className={cn("mt-3 line-clamp-1 font-heading font-bold uppercase transition-colors group-hover:text-hot", first ? "text-xl" : "text-base")}>{e.player.ign}</span>
              </Link>
              <span className="line-clamp-1 text-[11px] text-white/55 uppercase">{e.team?.name ?? "Free agent"}</span>
              <span className={cn("mt-2 font-heading leading-none font-bold tabular", first ? "text-4xl" : "text-3xl")}>{e.value}</span>
              <span className="text-[10px] font-medium tracking-widest text-white/50 uppercase">{stat}</span>
              <span className={cn("mt-3 w-full rounded-t-md", first ? "h-10" : i === 1 ? "h-6" : "h-3")} style={{ background: `color-mix(in srgb, ${MEDALS[i]} 30%, transparent)` }} aria-hidden />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
