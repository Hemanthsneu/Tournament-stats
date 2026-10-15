import Link from "next/link";
import { TeamLogo } from "@/components/team";
import type { GameView } from "@/lib/engine/league";
import { fmtDate, fmtTime } from "@/lib/time";
import { cn } from "@/lib/utils";

/** NBA-style strip of recent results and upcoming games. */
export function ScoreTicker({ games, showSeason }: { games: GameView[]; showSeason?: boolean }) {
  if (games.length === 0) return null;
  return (
    <div className="border-b bg-card">
      <div className="mx-auto flex max-w-7xl overflow-x-auto [scrollbar-width:none]">
        {games.map((g) => {
          const status = g.completed ? "Final" : g.game.status === "live" ? "Live" : g.game.scheduled_at ? `${fmtDate(g.game.scheduled_at)} ${fmtTime(g.game.scheduled_at)}` : "Upcoming";
          return (
            <Link key={g.game.id} href={`/games/${g.game.id}`} className="w-44 shrink-0 border-r px-3.5 py-2.5 transition-colors first:border-l hover:bg-accent/60">
              <div className={cn("mb-1.5 flex items-center gap-1.5 font-heading text-[11px] font-semibold tracking-wide uppercase", g.game.status === "live" ? "text-hot" : "text-muted-foreground")}>
                {showSeason && <span className="rounded-[3px] bg-brand px-1 text-[10px] leading-4 text-white">S{g.season.number}</span>}
                <span className="truncate">{status}</span>
              </div>
              {[
                [g.teamA, g.game.team_a_rounds],
                [g.teamB, g.game.team_b_rounds],
              ].map(([team, rounds], i) => {
                const t = team as GameView["teamA"];
                const won = g.completed && g.winnerId === t?.id;
                return (
                  <div key={i} className="flex items-center gap-2 py-0.5 text-sm">
                    <TeamLogo team={t} size="xs" />
                    <span className={cn("flex-1 truncate font-heading font-semibold tracking-wide uppercase", g.completed && !won && "text-muted-foreground")}>{t?.tag ?? "TBD"}</span>
                    {g.completed && <span className={cn("font-heading text-base font-bold tabular", !won && "text-muted-foreground")}>{rounds as number}</span>}
                  </div>
                );
              })}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
