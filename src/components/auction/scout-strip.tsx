import { Radar } from "@/components/radar";
import type { RoomPlayer } from "./auction-room";
import { cn } from "@/lib/utils";

/** The player's scouting numbers on the auction stage: rating web, contribution, form. */
export function ScoutStrip({ scout, big }: { scout: RoomPlayer["scout"]; big: boolean }) {
  if (!scout) return null;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const max = Math.max(...scout.form.map((f) => f.kills), 1);
  const tiles = [
    { l: "Contribution", v: pct(scout.share), h: "Share of the team's kills" },
    { l: "Win contrib.", v: scout.winShare ? pct(scout.winShare) : "–", h: "Share of the team's kills in wins" },
    { l: "POTM", v: scout.potm, h: "Player of the Match awards" },
    { l: "Carry games", v: scout.carries, h: "Games with 40%+ of the team's kills" },
    { l: "Best game", v: `${scout.best} K`, h: "Most kills in one game" },
  ];
  return (
    <div className={cn("grid gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/5", scout.ratings.length ? "sm:grid-cols-[minmax(0,210px)_minmax(0,1fr)]" : "")}>
      {scout.ratings.length > 0 && (
        <div className={cn("mx-auto w-full", big ? "max-w-[260px]" : "max-w-[210px]")}>
          <Radar ratings={scout.ratings} color="#fbbf24" />
        </div>
      )}
      <div className="grid content-start gap-2">
        <dl className={cn("grid grid-cols-3 gap-2", big && "xl:grid-cols-5")}>
          {tiles.map((t) => (
            <div key={t.l} className="rounded-lg bg-white/5 px-2 py-2 text-center ring-1 ring-white/5" title={t.h}>
              <dd className="font-heading text-xl leading-none font-bold whitespace-nowrap tabular">{t.v}</dd>
              <dt className="mt-1 truncate text-[10px] tracking-wide text-white/50 uppercase">{t.l}</dt>
            </div>
          ))}
        </dl>
        {scout.form.length > 0 && (
          <div className="rounded-lg bg-white/5 px-3 py-2 ring-1 ring-white/5">
            <div className="mb-1 text-[10px] tracking-wide text-white/50 uppercase">Last {scout.form.length} games · kills</div>
            <ol className="flex h-16 items-end gap-1.5">
              {scout.form.map((f, i) => (
                <li key={i} className="flex h-full flex-1 flex-col justify-end text-center">
                  <span className="font-heading text-xs font-bold tabular">{f.kills}</span>
                  <span className={cn("block w-full rounded-t-[3px]", f.won ? "bg-win" : "bg-loss/70")} style={{ height: `${Math.max(8, (f.kills / max) * 70)}%` }} />
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
