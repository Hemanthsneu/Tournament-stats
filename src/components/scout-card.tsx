import Link from "next/link";
import { ArrowDown, ArrowUp, Crosshair, MapPin, Swords, TrendingUp, Trophy, UserPlus } from "@/components/icons";
import { PanIcon } from "@/components/pubg-icons";
import { SectionTitle } from "@/components/page-header";
import { RATED_GAMES, type ScoutReport } from "@/lib/engine/profile";
import { onColor } from "@/lib/team-colors";
import { cn } from "@/lib/utils";

const SHORT: Record<string, string> = { fragging: "FRG", contribution: "CON", winner: "WIN", consistency: "CST", carry: "CRY", experience: "EXP" };

const tier = (v: number) => (v >= 85 ? "text-gold" : v >= 70 ? "text-win" : v >= 55 ? "text-white" : "text-white/60");

/** Six ratings as a hexagon; the outer ring is 99. */
function Radar({ ratings, color }: { ratings: ScoutReport["ratings"]; color: string }) {
  const R = 100;
  const pt = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / ratings.length - Math.PI / 2;
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  };
  const ring = (f: number) => ratings.map((_, i) => pt(i, R * f).join(",")).join(" ");
  const shape = ratings.map((r, i) => pt(i, R * Math.max(0.12, (r.value - 30) / 69)).join(",")).join(" ");
  return (
    <svg viewBox="-168 -142 336 286" className="w-full max-w-[340px]" role="img" aria-label={ratings.map((r) => `${r.label} ${r.value}`).join(", ")}>
      {[1, 0.75, 0.5, 0.25].map((f) => (
        <polygon key={f} points={ring(f)} fill={f === 1 ? "var(--muted)" : "none"} stroke="var(--border)" strokeWidth={1} />
      ))}
      {ratings.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={0} y1={0} x2={x} y2={y} stroke="var(--border)" strokeWidth={1} />;
      })}
      <polygon points={shape} fill={color} fillOpacity={0.28} stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
      {ratings.map((r, i) => {
        const [x, y] = pt(i, R * Math.max(0.12, (r.value - 30) / 69));
        return <circle key={r.key} cx={x} cy={y} r={3.5} fill={color} />;
      })}
      {ratings.map((r, i) => {
        const [x, y] = pt(i, R + 22);
        return (
          <g key={r.key} transform={`translate(${x},${y})`}>
            <text textAnchor="middle" y={-3} className="fill-muted-foreground font-heading text-[11px] font-bold tracking-wider uppercase">
              {r.label}
            </text>
            <text textAnchor="middle" y={13} className="fill-foreground font-heading text-[15px] font-extrabold">
              {r.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Tile({ icon, label, value, sub, href }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode; href?: string }) {
  const body = (
    <>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        <span className="text-hot">{icon}</span> {label}
      </div>
      <div className="mt-1 truncate font-heading text-xl leading-tight font-bold uppercase">{value}</div>
      {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-lg border bg-card p-3 transition-colors hover:border-hot/50">
      {body}
    </Link>
  ) : (
    <div className="rounded-lg border bg-card p-3">{body}</div>
  );
}

export function ScoutCard({ report, ign, photo, role, color, teamTag }: { report: ScoutReport; ign: string; photo: string | null; role: string | null; color: string; teamTag: string | null }) {
  const { overall, ratings, form } = report;
  if (!form.length) return null;
  const ink = onColor(color);
  const max = Math.max(...form.map((f) => f.kills), 1);
  const delta = report.formAvg - report.careerAvg;

  return (
    <section>
      <SectionTitle>Scouting report</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Collectible card */}
        <div className="dark relative isolate overflow-hidden rounded-2xl bg-brand p-5 text-white shadow-[0_10px_30px_rgb(12_26_58/0.25)]">
          <div aria-hidden className="absolute inset-0 -z-10" style={{ background: `linear-gradient(160deg, ${color} 0%, color-mix(in oklab, ${color} 35%, #0c1a3a) 55%, #0c1a3a 100%)` }} />
          <div aria-hidden className="honour-gold absolute inset-x-0 top-0 h-1 opacity-90" />
          <div className="flex items-start justify-between">
            <div>
              <div className={cn("font-heading text-6xl leading-none font-extrabold", overall != null ? tier(overall) : "text-white/40")}>{overall ?? "–"}</div>
              <div className="mt-1 font-heading text-xs font-bold tracking-widest text-white/70 uppercase">{overall != null ? "Overall" : `Rated after ${RATED_GAMES} games`}</div>
              {role && <div className="mt-2 inline-block rounded-sm bg-white/15 px-1.5 py-0.5 font-heading text-[11px] font-bold tracking-wider uppercase">{role}</div>}
            </div>
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="size-24 rounded-xl object-cover ring-2 ring-white/30" />
            ) : (
              <span className="grid size-24 place-items-center rounded-xl bg-black/20 font-heading text-4xl font-extrabold italic ring-2 ring-white/20">{ign.slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2 border-y border-white/15 py-2">
            <span className="truncate font-heading text-2xl leading-none font-extrabold uppercase">{ign}</span>
            {teamTag && (
              <span className="ml-auto rounded-[4px] px-1.5 font-heading text-xs leading-5 font-bold" style={{ background: color, color: ink, boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.3)" }}>
                {teamTag}
              </span>
            )}
          </div>
          {ratings.length > 0 ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1.5">
              {ratings.map((r) => (
                <div key={r.key} className="flex items-baseline justify-between" title={`${r.label}: ${r.detail}`}>
                  <dt className="font-heading text-sm font-bold tracking-wider text-white/65">{SHORT[r.key]}</dt>
                  <dd className={cn("font-heading text-xl font-extrabold tabular", tier(r.value))}>{r.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-white/70">Ratings appear once they have played {RATED_GAMES} official games.</p>
          )}
        </div>

        {/* Radar + rating details */}
        <div className="rounded-xl border bg-card p-4">
          {ratings.length > 0 ? (
            <>
              <div className="flex justify-center">
                <Radar ratings={ratings} color={color} />
              </div>
              <ul className="mt-2 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                {ratings.map((r) => (
                  <li key={r.key} className="truncate">
                    <b className="text-foreground">{r.label}:</b> {r.detail}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground">Ratings run 40–99 against every player with {RATED_GAMES}+ official games.</p>
            </>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Not enough official games for ratings yet.</p>
          )}
        </div>

        {/* Form + highlights */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-heading text-base font-bold tracking-wide uppercase">Form · last {form.length}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {report.formAvg.toFixed(1)} K/G
                <span className={cn("inline-flex items-center font-semibold", delta >= 0 ? "text-win" : "text-loss")}>
                  {delta >= 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                  {Math.abs(delta).toFixed(1)}
                </span>
                vs career {report.careerAvg.toFixed(1)}
              </span>
            </div>
            <ol className="mt-3 flex h-28 items-end gap-1.5">
              {form.map((f) => (
                <li key={f.gameId} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                  <Link href={`/games/${f.gameId}`} title={`${f.label}${f.opponent ? ` vs ${f.opponent.tag}` : ""}: ${f.kills} kills, ${f.won ? "won" : "lost"}`} className="group flex h-full flex-col justify-end">
                    <span className="text-center font-heading text-xs font-bold tabular">{f.kills}</span>
                    <span
                      className={cn("block w-full rounded-t-[4px] transition-opacity group-hover:opacity-80", f.won ? "bg-win" : "bg-loss/70")}
                      style={{ height: `${Math.max(6, (f.kills / max) * 80)}%` }}
                    />
                    <span className={cn("mt-1 text-center font-heading text-[10px] font-bold", f.won ? "text-win" : "text-loss")}>{f.won ? "W" : "L"}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {report.bestGame && (
              <Tile icon={<Crosshair className="size-3.5" />} label="Best game" value={`${report.bestGame.kills} kills`} sub={`${report.bestGame.label}${report.bestGame.opponent ? ` vs ${report.bestGame.opponent.tag}` : ""}`} href={`/games/${report.bestGame.gameId}`} />
            )}
            {report.bestMap && <Tile icon={<MapPin className="size-3.5" />} label="Best map" value={report.bestMap.map.name} sub={`${report.bestMap.avg.toFixed(1)} K/G in ${report.bestMap.games}`} />}
            {report.favouriteOpponent && (
              <Tile
                icon={<Swords className="size-3.5" />}
                label="Loves facing"
                value={report.favouriteOpponent.team.name}
                sub={`${report.favouriteOpponent.avg.toFixed(1)} K/G in ${report.favouriteOpponent.games}`}
                href={`/teams/${report.favouriteOpponent.team.id}`}
              />
            )}
            {report.bestPartner && (
              <Tile
                icon={<UserPlus className="size-3.5" />}
                label="Best duo"
                value={report.bestPartner.player.ign}
                sub={`${report.bestPartner.wins}–${report.bestPartner.games - report.bestPartner.wins} together`}
                href={`/players/${report.bestPartner.player.id}`}
              />
            )}
            <Tile icon={<TrendingUp className="size-3.5" />} label="Win streak" value={`${report.longestWinStreak} in a row`} sub="Longest run of wins" />
            <Tile icon={<PanIcon className="size-3.5" />} label="Carry games" value={report.carries} sub="40%+ of team kills" />
          </div>
          {report.overall != null && report.overall >= 85 && (
            <p className="flex items-center gap-1.5 text-xs text-gold">
              <Trophy weight="fill" className="size-3.5" /> Elite rating: top tier of the league.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
