"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { DateStrip, WeekStrip } from "@/components/availability";
import { CrosshairIcon, PanIcon } from "@/components/pubg-icons";
import { Input } from "@/components/ui/input";
import { DAYS, dateScore, dateSummary, fmtDayMonth, fmtWeekday, timeWindow } from "@/lib/availability";
import { browserSupabase } from "@/lib/supabase/browser";
import type { AuctionLot } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { RoomPlayer } from "./auction-room";

type Sort = "kills" | "mvp" | "kg" | "days" | "name";
type Tab = "pool" | "unsold" | "shortlist";

/**
 * Captains' scouting view of the pool: availability first, then form. Captains can star players
 * into a private shortlist (only they can see it).
 */
export function ScoutingBoard({
  auctionId,
  lots,
  players,
  matchDays,
  canShortlist,
}: {
  auctionId: string;
  lots: AuctionLot[];
  players: Record<string, RoomPlayer>;
  /** When the season has match days, filters and sorting use them instead of the usual week. */
  matchDays: { day: string; label: string | null }[];
  canShortlist: boolean;
}) {
  const sb = browserSupabase();
  const [tab, setTab] = useState<Tab>("pool");
  const [day, setDay] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const byDate = matchDays.length > 0;
  const dayList = useMemo(() => matchDays.map((d) => d.day), [matchDays]);
  const [sort, setSort] = useState<Sort>("kills");
  const [q, setQ] = useState("");
  const [stars, setStars] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!canShortlist) return;
    let alive = true;
    sb.from("auction_shortlists")
      .select("player_id")
      .eq("auction_id", auctionId)
      .then(({ data }) => alive && data && setStars(new Set(data.map((r) => r.player_id as string))));
    return () => {
      alive = false;
    };
  }, [sb, auctionId, canShortlist]);

  const toggleStar = async (playerId: string) => {
    const on = !stars.has(playerId);
    setStars((s) => {
      const next = new Set(s);
      if (on) next.add(playerId);
      else next.delete(playerId);
      return next;
    });
    const {
      data: { user },
    } = await sb.auth.getUser();
    const res = on
      ? await sb.from("auction_shortlists").insert({ auction_id: auctionId, user_id: user?.id, player_id: playerId })
      : await sb.from("auction_shortlists").delete().eq("auction_id", auctionId).eq("player_id", playerId);
    if (res.error) toast.error(res.error.message);
  };

  const pool = lots.filter((l) => l.status === "pool" || l.status === "live");
  const unsold = lots.filter((l) => l.status === "unsold");
  const source = tab === "pool" ? pool : tab === "unsold" ? unsold : lots.filter((l) => stars.has(l.player_id) && l.status !== "sold");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return source
      .map((l) => ({ lot: l, p: players[l.player_id] }))
      .filter((r) => r.p)
      .filter((r) => !term || r.p.ign.toLowerCase().includes(term))
      .filter((r) => (byDate ? date === null || r.p.dates[date] === "yes" : day === null || r.p.availability?.days.includes(day)))
      .sort((a, b) => {
        const s = (x: typeof a) =>
          sort === "kills" ? x.p.stats?.kills ?? -1 : sort === "mvp" ? x.p.stats?.mvp ?? -1 : sort === "kg" ? x.p.stats?.avgKills ?? -1 : sort === "days" ? (byDate ? dateScore(dateSummary(dayList, x.p.dates)) : x.p.availability?.days.length ?? -1) : 0;
        return sort === "name" ? a.p.ign.localeCompare(b.p.ign) : s(b) - s(a) || a.p.ign.localeCompare(b.p.ign);
      });
  }, [source, players, q, day, date, byDate, dayList, sort]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "pool", label: "In the pool", count: pool.length },
    { id: "unsold", label: "Unsold", count: unsold.length },
    ...(canShortlist ? [{ id: "shortlist" as const, label: "★ My shortlist", count: lots.filter((l) => stars.has(l.player_id) && l.status !== "sold").length }] : []),
  ];

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <h2 className="flex items-center gap-2.5 font-heading text-xl font-bold tracking-wide uppercase">
          <span className="h-5 w-1 bg-hot" aria-hidden /> Scouting board
        </h2>
        <div className="flex gap-1 rounded-md bg-muted p-0.5 text-sm">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn("rounded px-2.5 py-1 font-medium text-muted-foreground transition-colors", tab === t.id && "bg-card text-foreground shadow-xs")}
            >
              {t.label} <span className="text-xs opacity-70">{t.count}</span>
            </button>
          ))}
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search player…" className="ml-auto h-8 w-44" />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 text-xs">
        <span className="font-heading font-bold tracking-wide text-muted-foreground uppercase">{byDate ? "Available on" : "Plays on"}</span>
        <button
          type="button"
          onClick={() => (byDate ? setDate(null) : setDay(null))}
          className={cn("rounded px-2 py-1", (byDate ? date : day) === null ? "bg-brand text-white" : "bg-muted text-muted-foreground hover:text-foreground")}
        >
          {byDate ? "Any date" : "Any day"}
        </button>
        {byDate && matchDays.map((m) => (
          <button
            key={m.day}
            type="button"
            onClick={() => setDate(date === m.day ? null : m.day)}
            title={m.label ?? undefined}
            className={cn("rounded px-2 py-1 font-medium tabular", date === m.day ? "bg-win text-white" : "bg-muted text-muted-foreground hover:text-foreground")}
          >
            {fmtWeekday(m.day)} {fmtDayMonth(m.day)}
          </button>
        ))}
        {!byDate && DAYS.map((d) => (
          <button
            key={d.n}
            type="button"
            onClick={() => setDay(day === d.n ? null : d.n)}
            className={cn("rounded px-2 py-1 font-medium", day === d.n ? "bg-win text-white" : "bg-muted text-muted-foreground hover:text-foreground")}
          >
            {d.short}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-muted-foreground">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-7 rounded border bg-card px-1.5 text-foreground">
            <option value="kills">Kills</option>
            <option value="mvp">MVP points</option>
            <option value="kg">Kills / game</option>
            <option value="days">Most available</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          {tab === "shortlist" ? "Star players in the pool to build your shortlist." : (byDate ? date : day) !== null ? "Nobody here is available then." : "Nobody here."}
        </p>
      ) : (
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full min-w-max text-sm tabular">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr className="font-heading text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
                {canShortlist && <th className="w-10 py-2.5 pl-4" />}
                <th className={cn("py-2.5 text-left font-semibold", !canShortlist && "pl-4")}>Player</th>
                <th className="px-2 py-2.5 text-left font-semibold">Availability</th>
                <th className="px-2 py-2.5 text-right font-semibold">
                  <span className="inline-flex items-center gap-1">
                    <CrosshairIcon className="size-3.5" /> Kills
                  </span>
                </th>
                <th className="px-2 py-2.5 text-right font-semibold">K/G</th>
                <th className="px-2 py-2.5 pr-4 text-right font-semibold">
                  <span className="inline-flex items-center gap-1">
                    <PanIcon className="size-3.5" /> MVP
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ lot, p }) => (
                <tr key={lot.id} className={cn("border-t transition-colors hover:bg-accent/50", lot.status === "live" && "bg-gold-soft")}>
                  {canShortlist && (
                    <td className="py-2 pl-4">
                      <button
                        type="button"
                        onClick={() => toggleStar(p.id)}
                        aria-pressed={stars.has(p.id)}
                        title={stars.has(p.id) ? "Remove from shortlist" : "Add to shortlist"}
                        className={cn("text-lg leading-none transition-transform active:scale-90", stars.has(p.id) ? "text-gold" : "text-muted-foreground/40 hover:text-gold")}
                      >
                        ★
                      </button>
                    </td>
                  )}
                  <td className={cn("py-2", !canShortlist && "pl-4")}>
                    <Link href={`/players/${p.id}`} className="font-heading text-base font-bold uppercase hover:text-hot">
                      {p.ign}
                    </Link>
                    <div className="text-[11px] text-muted-foreground">
                      {[p.role, lot.set_name !== "Pool" ? lot.set_name : null, lot.status === "live" ? "On the block now" : null].filter(Boolean).join(" · ") || " "}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    {byDate ? (
                      <div className="flex items-center gap-2">
                        <DateStrip dates={{ days: matchDays, answers: p.dates }} size="xs" className="max-w-64" />
                        <span className="text-xs whitespace-nowrap text-muted-foreground">
                          {Object.keys(p.dates).length ? `${dateSummary(dayList, p.dates).yes}/${dayList.length} days` : "Not answered"}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <WeekStrip availability={p.availability} size="xs" />
                        <span className="text-xs text-muted-foreground">{p.availability?.days.length ? timeWindow(p.availability) : "Not shared"}</span>
                      </div>
                    )}
                    {p.availability?.note && <div className="max-w-56 truncate text-[11px] text-muted-foreground italic" title={p.availability.note}>“{p.availability.note}”</div>}
                  </td>
                  <td className="px-2 py-2 text-right font-heading text-base font-bold">{p.stats?.kills ?? "–"}</td>
                  <td className="px-2 py-2 text-right text-muted-foreground">{p.stats ? p.stats.avgKills.toFixed(1) : "–"}</td>
                  <td className="px-2 py-2 pr-4 text-right text-muted-foreground">{p.stats ? Math.round(p.stats.mvp) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
