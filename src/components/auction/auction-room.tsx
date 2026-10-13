"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  BadgeCheck,
  Gavel,
  Maximize,
  Monitor,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  Square,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from "@/components/icons";
import { TeamLogo } from "@/components/team";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bidOptions, credits, lotBase, teamPurse } from "@/lib/auction";
import { browserSupabase } from "@/lib/supabase/browser";
import { teamColor } from "@/lib/team-colors";
import type { AuctionLot, AuctionSnapshot, Team } from "@/lib/types";
import { cn } from "@/lib/utils";
import { countWord, useAnnouncer } from "./announcer";

export interface RoomPlayer {
  id: string;
  ign: string;
  photo: string | null;
  role: string | null;
  bio: string | null;
  verified: boolean;
  lastTeam: string | null;
  stats: { games: number; kills: number; revives: number; mvp: number; potm: number; avgKills: number } | null;
}

interface Props {
  auctionId: string;
  initial: AuctionSnapshot;
  players: Record<string, RoomPlayer>;
  teams: Record<string, Team>;
  viewer: { isAdmin: boolean; captainTeamId: string | null; signedIn: boolean };
  screen: boolean;
}

type Result = { kind: "sold" | "unsold"; lot: AuctionLot; at: number };

export function AuctionRoom({ auctionId, initial, players, teams, viewer, screen }: Props) {
  const sb = browserSupabase();
  const [snap, setSnap] = useState(initial);
  const [now, setNow] = useState(() => Date.parse(initial.now));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [flash, setFlash] = useState(0);
  const [unsoldBase, setUnsoldBase] = useState("");
  const offset = useRef(0);
  const bestRtt = useRef(Infinity);
  const prev = useRef<AuctionSnapshot | null>(null);
  const announcer = useAnnouncer();
  const { speak, sfx } = announcer;

  // ---- data: one consistent snapshot, refreshed on every realtime change (+ slow polling fallback)
  const refresh = useCallback(async () => {
    const t0 = Date.now();
    const { data, error } = await sb.rpc("auction_snapshot", { p_auction_id: auctionId });
    const t1 = Date.now();
    if (error || !data) return;
    const s = data as AuctionSnapshot;
    if (t1 - t0 < bestRtt.current) {
      bestRtt.current = t1 - t0;
      offset.current = Date.parse(s.now) - (t0 + (t1 - t0) / 2);
    }
    setSnap(s);
  }, [sb, auctionId]);

  useEffect(() => {
    const first = setTimeout(refresh, 0); // calibrate the clock right after load
    let live = false;
    let last = Date.now();
    let pending: ReturnType<typeof setTimeout> | null = null;
    const soon = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        void refresh();
      }, 60);
    };
    const channel = sb
      .channel(`auction-${auctionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_lots", filter: `auction_id=eq.${auctionId}` }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_bids", filter: `auction_id=eq.${auctionId}` }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_teams", filter: `auction_id=eq.${auctionId}` }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "auctions", filter: `id=eq.${auctionId}` }, soon)
      .subscribe((status) => {
        live = status === "SUBSCRIBED";
        if (live) soon();
      });
    // Realtime is the main channel; polling is the safety net (fast while realtime is reconnecting).
    const poll = setInterval(() => {
      if (Date.now() - last >= (live ? 6000 : 1500)) {
        last = Date.now();
        void refresh();
      }
    }, 500);
    const tick = setInterval(() => setNow(Date.now() + offset.current), 100);
    return () => {
      void sb.removeChannel(channel);
      clearInterval(poll);
      clearInterval(tick);
      clearTimeout(first);
      if (pending) clearTimeout(pending);
    };
  }, [sb, auctionId, refresh]);

  const a = snap.auction;
  const lot = a?.current_lot_id ? snap.lots.find((l) => l.id === a.current_lot_id) ?? null : null;
  const remainingMs = lot ? (lot.ends_at ? Date.parse(lot.ends_at) - now : a?.paused_remaining_ms ?? 0) : 0;
  const secs = Math.max(0, Math.ceil(remainingMs / 1000));
  const expired = !!lot && a?.status === "live" && !!lot.ends_at && remainingMs <= 0;
  const pool = snap.lots.filter((l) => l.status === "pool");
  const unsold = snap.lots.filter((l) => l.status === "unsold");
  const teamName = (id: string | null) => (id ? teams[id]?.name ?? "?" : "");
  const ign = (pid: string) => players[pid]?.ign ?? "Player";

  // ---- close the player when time runs out (any open screen may do it; the database decides)
  const closing = useRef<string | null>(null);
  useEffect(() => {
    // Keyed per draw: after an undo/restart the same player can come up again.
    const key = lot ? `${lot.id}:${lot.draw_no}` : "";
    if (!expired || !lot || closing.current === key) return;
    closing.current = key;
    const id = lot.id;
    setTimeout(async () => {
      const { data } = await sb.rpc("auction_close_lot", { p_lot_id: id });
      if (data === "running") closing.current = null;
      void refresh();
    }, Math.random() * 400);
  }, [expired, lot, sb, refresh]);

  // ---- announcer: react to what changed between snapshots
  useEffect(() => {
    const p = prev.current;
    prev.current = snap;
    if (!p || !snap.auction) return;
    const before = p.auction?.current_lot_id ?? null;
    const after = snap.auction.current_lot_id;
    if (before && before !== after) {
      const closed = snap.lots.find((l) => l.id === before);
      if (closed?.status === "sold") {
        sfx("sold");
        speak(`Sold! ${ign(closed.player_id)} to ${teamName(closed.sold_team_id)} for ${closed.sold_price}.`, { interrupt: true });
        setResult({ kind: "sold", lot: closed, at: Date.now() });
      } else if (closed?.status === "unsold") {
        sfx("unsold");
        speak(`${ign(closed.player_id)} goes unsold.`, { interrupt: true });
        setResult({ kind: "unsold", lot: closed, at: Date.now() });
      }
    }
    if (after && after !== before) {
      const l = snap.lots.find((x) => x.id === after);
      const pl = l ? players[l.player_id] : null;
      if (l && pl) {
        sfx("next");
        speak(`Next up, ${pl.ign}.${pl.role ? ` ${pl.role}.` : ""} Base price ${lotBase(snap.auction, l)}.`);
      }
    }
    const top = snap.bids[0];
    if (top && top.id !== p.bids[0]?.id && top.lot_id === after) {
      sfx("bid");
      speak(`${teamName(top.team_id)}, ${top.amount}`, { interrupt: true });
      setFlash((f) => f + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap]);

  // ---- final "3, 2, 1" countdown
  const spoken = useRef("");
  useEffect(() => {
    if (!a || !lot || a.status !== "live" || !lot.ends_at) return;
    if (secs < 1 || secs > a.countdown_seconds) return;
    const key = `${lot.id}:${lot.draw_no}:${lot.current_bid}:${secs}`;
    if (spoken.current === key) return;
    spoken.current = key;
    sfx("tick");
    speak(countWord(secs), { interrupt: true });
  }, [a, lot, secs, speak, sfx]);

  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), 5000);
    return () => clearTimeout(t);
  }, [result]);

  // ---- actions
  const call = async (fn: string, args: Record<string, unknown>, ok?: string) => {
    setBusy(true);
    const { data, error } = await sb.rpc(fn, args);
    setBusy(false);
    if (error) {
      // Another captain got in first: show the new price right away.
      const outbid = /Bid must be at least (\d+)/.exec(error.message);
      toast.error(outbid ? `Outbid just now. Tap again for ${credits(Number(outbid[1]))}` : error.message);
      void refresh();
      return null;
    }
    if (ok) toast.success(ok);
    void refresh();
    return data;
  };

  const draw = useCallback(
    async (auto = false) => {
      const { error } = await sb.rpc("auction_draw_next", { p_auction_id: auctionId });
      if (error && !auto) toast.error(error.message);
      void refresh();
    },
    [sb, auctionId, refresh],
  );

  // Auto-advance (only the organizer's screen draws)
  const poolCount = pool.length;
  useEffect(() => {
    if (!viewer.isAdmin || !a || a.status !== "live" || a.current_lot_id || a.auto_next_seconds <= 0 || poolCount === 0) return;
    const t = setTimeout(() => void draw(true), a.auto_next_seconds * 1000);
    return () => clearTimeout(t);
  }, [viewer.isAdmin, a, poolCount, draw]);

  const myTeam = viewer.captainTeamId ? snap.teams.find((t) => t.team_id === viewer.captainTeamId) ?? null : null;
  const myPurse = a && myTeam ? teamPurse(a, myTeam) : null;
  const leader = lot?.current_team_id ?? null;

  const recentClosed = useMemo(
    () =>
      snap.lots
        .filter((l) => (l.status === "sold" || l.status === "unsold") && l.closed_at)
        .sort((x, y) => (y.closed_at ?? "").localeCompare(x.closed_at ?? ""))
        .slice(0, 12),
    [snap.lots],
  );

  if (!a) return <p className="text-muted-foreground">This auction no longer exists.</p>;

  const total = Math.max(a.timer_seconds, a.bid_extend_seconds, 1);
  const inCountdown = !!lot && a.status === "live" && secs > 0 && secs <= a.countdown_seconds;
  const player = lot ? players[lot.player_id] : null;
  const showResult = result && !lot;

  return (
    <div className={cn(screen ? "dark fixed inset-0 z-50 space-y-8 overflow-y-auto bg-background p-6 text-foreground sm:p-10" : "space-y-8", myTeam && !screen && "pb-24 lg:pb-0")}>
      {/* Header */}
      <div className={cn("flex flex-wrap items-center gap-3", screen && "mb-6")}>
        <h1 className={cn("leading-none", screen ? "text-5xl sm:text-6xl" : "text-4xl sm:text-5xl")}>{a.name}</h1>
        <StatusBadge status={a.status} />
        {a.is_practice && <Badge className="bg-info-soft text-info">PRACTICE</Badge>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {a.voice_enabled && a.status !== "completed" && (
            <Button variant={announcer.enabled ? "default" : "outline"} size="sm" onClick={announcer.toggle}>
              {announcer.enabled ? <Volume2 /> : <VolumeX />} {announcer.enabled ? "Sound on" : "Turn sound on"}
            </Button>
          )}
          {screen ? (
            <>
              <Button variant="outline" size="sm" onClick={() => document.documentElement.requestFullscreen?.()}>
                <Maximize /> Fullscreen
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/auction?id=${auctionId}`}>
                  <X /> Exit
                </Link>
              </Button>
            </>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href={`/auction?id=${auctionId}&screen=1`}>
                <Monitor /> Big screen
              </Link>
            </Button>
          )}
        </div>
      </div>

      {a.is_practice && !screen && (
        <div className="rounded-lg border border-info/30 bg-info-soft px-4 py-2.5 text-sm">
          <b>Practice auction.</b> Bid freely: nothing here creates rosters or counts in stats, and organizers can restart it any time.
        </div>
      )}

      <div className={cn("grid gap-6", !screen && "lg:grid-cols-[1fr_340px]", screen && "xl:grid-cols-[1fr_380px]")}>
        {/* Stage */}
        <section
          className={cn(
            "dark relative overflow-hidden rounded-xl bg-brand p-6 text-foreground sm:p-10",
            inCountdown && "border-loss/70",
          )}
        >
          {lot && player ? (
            <div className="grid gap-6 md:grid-cols-[auto_1fr]">
              <PlayerPhoto player={player} big={screen} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">
                    {lot.set_name}
                    {lot.round > 1 ? ` · round ${lot.round}` : ""}
                  </Badge>
                  {player.role && <Badge variant="secondary">{player.role}</Badge>}
                  {player.verified && (
                    <span className="inline-flex items-center gap-1 text-win">
                      <BadgeCheck className="size-3.5" /> Verified
                    </span>
                  )}
                  <span className="text-muted-foreground">Base {credits(lotBase(a, lot))}</span>
                </div>
                <h2 className={cn("mt-2 font-heading leading-[0.9] font-extrabold uppercase", screen ? "text-7xl sm:text-8xl" : "text-5xl sm:text-7xl")}>
                  {player.ign}
                </h2>
                {player.lastTeam && <p className="mt-1 text-sm text-muted-foreground">Last played for {player.lastTeam}</p>}
                {player.bio && <p className="mt-2 max-w-xl text-sm text-muted-foreground">“{player.bio}”</p>}
                <StatChips player={player} />

                <div className="mt-6 flex flex-wrap items-end gap-6">
                  <div>
                    <div className="text-xs text-muted-foreground">{lot.current_bid != null ? "Current bid" : "Opening bid"}</div>
                    <div
                      key={flash}
                      className={cn(
                        "font-heading leading-none tabular animate-in fade-in zoom-in-105 duration-300",
                        screen ? "text-8xl" : "text-6xl sm:text-7xl",
                      )}
                    >
                      {credits(lot.current_bid ?? lotBase(a, lot))}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm">
                      {leader ? (
                        <>
                          <TeamLogo team={teams[leader] ?? null} size="sm" />
                          <span className="font-semibold">{teamName(leader)}</span>
                          <span className="text-muted-foreground">leading</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">No bids yet</span>
                      )}
                    </div>
                  </div>
                  <Countdown secs={secs} total={total} remainingMs={remainingMs} paused={a.status === "paused"} danger={inCountdown} big={screen} />
                </div>
              </div>
            </div>
          ) : showResult ? (
            <ResultBanner result={result} player={players[result.lot.player_id]} team={result.lot.sold_team_id ? teams[result.lot.sold_team_id] ?? null : null} big={screen} />
          ) : (
            <IdleStage status={a.status} poolCount={pool.length} unsoldCount={unsold.length} isAdmin={viewer.isAdmin} />
          )}

          {inCountdown && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/30">
              <span key={secs} className="font-heading text-[10rem] leading-none text-loss animate-in zoom-in-125 fade-in duration-300 sm:text-[14rem]">
                {secs}
              </span>
            </div>
          )}
        </section>

        {/* Side column */}
        <aside className="space-y-4">
          {myTeam && myPurse && (
            <CaptainPanel
              team={teams[myTeam.team_id] ?? null}
              purse={myPurse}
              options={lot && a.status === "live" ? bidOptions(a, lot, 3) : []}
              leading={leader === myTeam.team_id}
              canBid={!!lot && a.status === "live" && !expired}
              busy={busy}
              onBid={(amount) => lot && call("auction_place_bid", { p_lot_id: lot.id, p_amount: amount })}
            />
          )}
          {viewer.isAdmin && (
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-3 text-xs text-muted-foreground">Auctioneer</div>
              <div className="grid grid-cols-2 gap-2">
                {!lot && a.status !== "completed" && pool.length > 0 && (
                  <Button className="col-span-2" size="lg" disabled={busy} onClick={() => void draw()}>
                    <Shuffle /> {a.status === "setup" ? "Start: draw first player" : `Draw next player (${pool.length} left)`}
                  </Button>
                )}
                {lot && a.status === "live" && (
                  <Button variant="outline" disabled={busy} onClick={() => call("auction_set_paused", { p_auction_id: a.id, p_paused: true })}>
                    <Pause /> Pause
                  </Button>
                )}
                {a.status === "paused" && (
                  <Button disabled={busy} onClick={() => call("auction_set_paused", { p_auction_id: a.id, p_paused: false })}>
                    <Play /> Resume
                  </Button>
                )}
                {lot && (
                  <>
                    <Button
                      variant="secondary"
                      disabled={busy || !lot.current_team_id}
                      onClick={() => confirm(`Sell ${player?.ign} now to ${teamName(lot.current_team_id)} for ${lot.current_bid}?`) && call("auction_close_lot", { p_lot_id: lot.id, p_force: "sell" })}
                    >
                      <Gavel /> Sell now
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => confirm(`Mark ${player?.ign} unsold?`) && call("auction_close_lot", { p_lot_id: lot.id, p_force: "unsold" })}
                    >
                      Mark unsold
                    </Button>
                  </>
                )}
                {!lot && recentClosed.length > 0 && a.status !== "completed" && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      confirm(`Undo the last result (${ign(recentClosed[0].player_id)})? They go back into the pool.`) &&
                      call("auction_undo_last", { p_auction_id: a.id }, "Undone: player is back in the pool")
                    }
                  >
                    <Undo2 /> Undo last
                  </Button>
                )}
              </div>
              {!lot && pool.length === 0 && unsold.length > 0 && a.status !== "completed" && (
                <div className="mt-3 flex gap-2 border-t pt-3">
                  <Input value={unsoldBase} onChange={(e) => setUnsoldBase(e.target.value.replace(/\D/g, ""))} placeholder="New base price" className="h-9" />
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      call("auction_restart_unsold", { p_auction_id: a.id, p_base_price: unsoldBase ? Number(unsoldBase) : null }, "Unsold players are back for another round")
                    }
                  >
                    <RotateCcw /> Unsold round
                  </Button>
                </div>
              )}
              {(a.status !== "completed" || a.is_practice) && (
                <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3">
                  {(a.status === "live" || a.status === "paused") && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        confirm("Stop the auction? The player on the block goes back to the pool. Results so far are kept.") &&
                        call("auction_stop", { p_auction_id: a.id }, "Auction stopped")
                      }
                    >
                      <Square /> Stop auction
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-loss"
                    disabled={busy}
                    onClick={() =>
                      confirm(`Restart ${a.is_practice ? "this practice auction" : "the auction"} from scratch? Every player goes back to the pool and all bids are deleted.`) &&
                      call("auction_reset", { p_auction_id: a.id }, "Restarted. Everyone is back in the pool.")
                    }
                  >
                    <RotateCcw /> Restart from scratch
                  </Button>
                </div>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                {a.auto_next_seconds > 0 ? `Next player is drawn automatically ${a.auto_next_seconds}s after each result. ` : ""}
                Settings, captains and the final roster step are in{" "}
                <Link href={`/admin/auction/${a.id}`} className="text-foreground underline underline-offset-2">
                  Admin → Auction
                </Link>
                .
              </p>
            </div>
          )}
          {!viewer.signedIn && a.status !== "completed" && (
            <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
              Captain?{" "}
              <Link href={`/login?next=${encodeURIComponent(`/auction?id=${auctionId}`)}`} className="text-foreground underline underline-offset-2">
                Sign in
              </Link>{" "}
              to bid for your team.
            </p>
          )}
          <BidFeed snap={snap} lotId={lot?.id ?? null} teams={teams} players={players} recentClosed={recentClosed} />
        </aside>
      </div>

      {/* Phones: captains always have the bid button under their thumb */}
      {myTeam && myPurse && lot && a.status === "live" && !screen && (
        <MobileBidBar
          price={lot.current_bid ?? lotBase(a, lot)}
          secs={secs}
          danger={inCountdown}
          next={bidOptions(a, lot, 1)[0]}
          leading={leader === myTeam.team_id}
          disabled={busy || expired || myPurse.slotsLeft === 0 || bidOptions(a, lot, 1)[0] > myPurse.maxBid}
          onBid={(amount) => call("auction_place_bid", { p_lot_id: lot.id, p_amount: amount })}
        />
      )}

      {/* Teams */}
      <section className={cn(screen && "mt-6")}>
        <h2 className="mb-3 font-heading text-xl font-bold tracking-wide uppercase">Teams</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {snap.teams.map((t) => {
            const team = teams[t.team_id] ?? null;
            const purse = teamPurse(a, t);
            const squad = snap.lots.filter((l) => l.status === "sold" && l.sold_team_id === t.team_id).sort((x, y) => (x.closed_at ?? "").localeCompare(y.closed_at ?? ""));
            return (
              <div
                key={t.team_id}
                className={cn("overflow-hidden rounded-lg border border-t-[5px] bg-card p-4 transition", leader === t.team_id && "ring-2 ring-hot")}
                style={{ borderTopColor: teamColor(team) }}
              >
                <div className="flex items-center gap-3">
                  <TeamLogo team={team} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{team?.name}</div>
                    <div className="truncate text-xs text-muted-foreground">Captain: {t.captain_player_id ? ign(t.captain_player_id) : "TBD"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-medium tabular">{credits(purse.left)}</div>
                    <div className="text-[11px] text-muted-foreground">left</div>
                  </div>
                </div>
                <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-foreground/70 transition-[width] duration-500" style={{ width: `${Math.max(0, (purse.left / a.purse) * 100)}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                  <span>
                    {purse.bought}/{a.max_buys} bought
                  </span>
                  <span>Max bid {credits(Math.max(purse.maxBid, 0))}</span>
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {squad.map((l) => (
                    <li key={l.id} className="flex justify-between gap-2">
                      <span className="truncate">{ign(l.player_id)}</span>
                      <span className="tabular text-muted-foreground">{credits(l.sold_price ?? 0)}</span>
                    </li>
                  ))}
                  {squad.length === 0 && <li className="text-xs text-muted-foreground">No players yet</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pool */}
      {!screen && (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 font-heading text-lg font-bold tracking-wide uppercase">Still in the pool ({pool.length})</h2>
            {pool.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody left.</p>
            ) : (
              <div className="space-y-3">
                {[...new Set(pool.map((l) => l.set_name))].map((set) => (
                  <div key={set}>
                    <div className="mb-1 text-xs text-muted-foreground">{set}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {pool
                        .filter((l) => l.set_name === set)
                        .map((l) => (
                          <Link key={l.id} href={`/players/${l.player_id}`} className="rounded-md border px-2 py-0.5 text-sm hover:border-primary/50">
                            {ign(l.player_id)}
                          </Link>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 font-heading text-lg font-bold tracking-wide uppercase">Unsold ({unsold.length})</h2>
            {unsold.length === 0 ? (
              <p className="text-sm text-muted-foreground">None so far.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {unsold.map((l) => (
                  <span key={l.id} className="rounded-md border border-dashed px-2 py-0.5 text-sm text-muted-foreground">
                    {ign(l.player_id)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  if (status === "live")
    return (
      <Badge className="gap-1.5 bg-loss-soft text-loss">
        <span className="size-2 animate-pulse rounded-full bg-white" /> LIVE
      </Badge>
    );
  if (status === "paused") return <Badge variant="secondary">Paused</Badge>;
  if (status === "completed") return <Badge variant="secondary">Completed</Badge>;
  return <Badge variant="outline">Starting soon</Badge>;
}

function PlayerPhoto({ player, big }: { player: RoomPlayer; big: boolean }) {
  const size = big ? "size-56 sm:size-64" : "size-40 sm:size-48";
  return player.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={player.photo} alt={player.ign} className={cn(size, "rounded-2xl object-cover")} />
  ) : (
    <div className={cn(size, "grid place-items-center rounded-2xl bg-muted font-heading text-7xl text-muted-foreground")}>
      {player.ign.slice(0, 2).toUpperCase()}
    </div>
  );
}

function StatChips({ player }: { player: RoomPlayer }) {
  if (!player.stats) return <p className="mt-3 text-sm text-muted-foreground">New to the league: no stats yet.</p>;
  const s = player.stats;
  const chips = [
    ["Games", s.games],
    ["Kills", s.kills],
    ["Revives", s.revives],
    ["K/G", s.avgKills.toFixed(1)],
    ["MVP", Math.round(s.mvp)],
    ["POTM", s.potm],
  ];
  return (
    <dl className="mt-6 grid grid-cols-3 gap-x-6 gap-y-4 sm:grid-cols-6">
      {chips.map(([label, value]) => (
        <div key={label}>
          <dd className="text-lg font-medium tabular">{value}</dd>
          <dt className="text-[11px] text-muted-foreground">{label}</dt>
        </div>
      ))}
    </dl>
  );
}

function Countdown({ secs, total, remainingMs, paused, danger, big }: { secs: number; total: number; remainingMs: number; paused: boolean; danger: boolean; big: boolean }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, remainingMs / (total * 1000)));
  return (
    <div className={cn("relative", big ? "size-40" : "size-28")}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} className="fill-none stroke-muted" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          className={cn("fill-none transition-[stroke-dashoffset] duration-100 ease-linear", danger ? "stroke-loss" : "stroke-foreground")}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className={cn("font-medium tabular", big ? "text-5xl" : "text-3xl", danger && "text-loss")}>{paused ? "II" : secs}</div>
          <div className="text-[11px] text-muted-foreground">{paused ? "paused" : "seconds"}</div>
        </div>
      </div>
    </div>
  );
}

function CaptainPanel({
  team,
  purse,
  options,
  leading,
  canBid,
  busy,
  onBid,
}: {
  team: Team | null;
  purse: ReturnType<typeof teamPurse>;
  options: number[];
  leading: boolean;
  canBid: boolean;
  busy: boolean;
  onBid: (amount: number) => void;
}) {
  const reason = !canBid
    ? "Waiting for the next player"
    : purse.slotsLeft === 0
      ? "Your squad is full"
      : leading
        ? "You have the highest bid"
        : options[0] > purse.maxBid
          ? `Over your max bid (${credits(purse.maxBid)})`
          : null;
  return (
    <div className="rounded-xl border border-foreground/20 bg-card p-5">
      <div className="flex items-center gap-2">
        <TeamLogo team={team} size="sm" />
        <div className="flex-1">
          <div className="text-xs text-muted-foreground">Captain&apos;s room</div>
          <div className="font-semibold">{team?.name}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-xl font-medium tabular">{credits(purse.left)}</div>
          <div className="text-[11px] text-muted-foreground">Purse left</div>
        </div>
        <div>
          <div className="text-xl font-medium tabular">{purse.slotsLeft}</div>
          <div className="text-[11px] text-muted-foreground">Slots left</div>
        </div>
        <div>
          <div className="text-xl font-medium tabular">{credits(Math.max(purse.maxBid, 0))}</div>
          <div className="text-[11px] text-muted-foreground">Max bid</div>
        </div>
      </div>
      {options.length > 0 && (
        <div className="mt-4 grid gap-2">
          <Button size="lg" className="h-14 text-lg" disabled={busy || !!reason} onClick={() => onBid(options[0])}>
            <Gavel /> Bid {credits(options[0])}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            {options.slice(1).map((amt) => (
              <Button key={amt} variant="outline" disabled={busy || !!reason || amt > purse.maxBid} onClick={() => onBid(amt)}>
                {credits(amt)}
              </Button>
            ))}
          </div>
        </div>
      )}
      {reason && <p className="mt-2 text-center text-xs text-muted-foreground">{reason}</p>}
    </div>
  );
}

function MobileBidBar({
  price,
  secs,
  danger,
  next,
  leading,
  disabled,
  onBid,
}: {
  price: number;
  secs: number;
  danger: boolean;
  next: number;
  leading: boolean;
  disabled: boolean;
  onBid: (amount: number) => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground">{leading ? "You lead at" : "Current"}</div>
          <div className="text-2xl font-medium tabular">{credits(price)}</div>
        </div>
        <div className={cn("text-2xl font-medium tabular", danger && "text-loss")}>{secs}s</div>
        <Button size="lg" className="ml-auto h-12 flex-1 text-base" disabled={disabled || leading} onClick={() => onBid(next)}>
          <Gavel /> {leading ? "Leading" : `Bid ${credits(next)}`}
        </Button>
      </div>
    </div>
  );
}

function BidFeed({
  snap,
  lotId,
  teams,
  players,
  recentClosed,
}: {
  snap: AuctionSnapshot;
  lotId: string | null;
  teams: Record<string, Team>;
  players: Record<string, RoomPlayer>;
  recentClosed: AuctionLot[];
}) {
  const bids = lotId ? snap.bids.filter((b) => b.lot_id === lotId).slice(0, 10) : [];
  return (
    <div className="rounded-xl border bg-card p-4">
      {lotId && (
        <>
          <div className="mb-2 text-xs text-muted-foreground">Bids</div>
          {bids.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bids yet.</p>
          ) : (
            <ol className="space-y-1.5">
              {bids.map((b, i) => (
                <li key={b.id} className={cn("flex items-center gap-2 text-sm", i === 0 ? "font-semibold" : "text-muted-foreground")}>
                  <TeamLogo team={teams[b.team_id] ?? null} size="xs" />
                  <span className="flex-1 truncate">{teams[b.team_id]?.name}</span>
                  <span className="tabular">{credits(b.amount)}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
      <div className={cn("mb-2 text-xs text-muted-foreground", lotId && "mt-4 border-t pt-3")}>Results</div>
      {recentClosed.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing sold yet.</p>
      ) : (
        <ol className="space-y-1.5 text-sm">
          {recentClosed.map((l) => (
            <li key={l.id} className="flex items-center gap-2">
              <span className="flex-1 truncate">{players[l.player_id]?.ign}</span>
              {l.status === "sold" ? (
                <>
                  <span className="truncate text-xs text-muted-foreground">{teams[l.sold_team_id ?? ""]?.tag}</span>
                  <span className="tabular font-medium text-win">{credits(l.sold_price ?? 0)}</span>
                </>
              ) : (
                <span className="text-xs text-loss">unsold</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ResultBanner({ result, player, team, big }: { result: Result; player: RoomPlayer | undefined; team: Team | null; big: boolean }) {
  const sold = result.kind === "sold";
  return (
    <div className="grid place-items-center py-10 text-center animate-in zoom-in-95 fade-in duration-500">
      <div
        className={cn(
          "rotate-[-4deg] rounded-lg border-2 px-6 py-1 font-heading italic",
          sold ? "border-win text-win" : "border-muted-foreground text-muted-foreground",
          big ? "text-7xl" : "text-5xl",
        )}
      >
        {sold ? "Sold!" : "Unsold"}
      </div>
      <div className={cn("mt-6 font-heading", big ? "text-5xl" : "text-3xl")}>{player?.ign}</div>
      {sold && (
        <div className="mt-3 flex items-center gap-3 text-xl">
          <TeamLogo team={team} size="md" />
          <span className="font-semibold">{team?.name}</span>
          <span className="font-heading text-4xl tabular">{credits(result.lot.sold_price ?? 0)}</span>
        </div>
      )}
    </div>
  );
}

function IdleStage({ status, poolCount, unsoldCount, isAdmin }: { status: string; poolCount: number; unsoldCount: number; isAdmin: boolean }) {
  const title =
    status === "completed"
      ? "The auction is over"
      : status === "setup"
        ? "The auction starts soon"
        : poolCount > 0
          ? "Next player coming up…"
          : unsoldCount > 0
            ? "Pool finished. Unsold players may get another round."
            : "Every player has been auctioned";
  return (
    <div className="grid place-items-center py-16 text-center">
      <Gavel className="size-10 text-muted-foreground" />
      <p className="mt-4 font-heading text-2xl">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {status === "completed"
          ? "See the final squads below."
          : isAdmin
            ? "Use the auctioneer panel to draw the next player at random."
            : `${poolCount} player${poolCount === 1 ? "" : "s"} waiting in the pool. Turn sound on to hear the auctioneer.`}
      </p>
    </div>
  );
}

