"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { Maximize, Monitor, Pause, Play, RotateCcw, Shuffle, Square, Undo2, Volume2, VolumeX, X } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bidOptions, credits, lotBase, teamPurse } from "@/lib/auction";
import { browserSupabase } from "@/lib/supabase/browser";
import { teamColor } from "@/lib/team-colors";
import type { AuctionLot, AuctionSnapshot, DateStatus, PlayerAvailability, Team } from "@/lib/types";
import { AvailabilityBlock } from "@/components/availability";
import DecryptedText from "@/components/reactbits/DecryptedText";
import { countWord, useAnnouncer } from "./announcer";
import { ChatPanel, ChatSheet, useAuctionChat } from "./chat-panel";
import { MyStatus, REACTIONS, ReactionBar, ReactionLayer, StartCountdown, useAlerts, useAuctionLive, WatchingCount, type ReactionKind } from "./live-extras";
import {
  BidLadder,
  CaptainPanel,
  IdleStage,
  MobileBidBar,
  PlayerChips,
  PlayerTile,
  PriceBlock,
  ResultsList,
  SoldOverlay,
  StatRow,
  StatusBadge,
  TeamCard,
  TeamGlow,
  TimerRing,
} from "./room-ui";
import { ScoutingBoard } from "./scouting-board";
import { crowdSounds, playSfx } from "./sfx";
import { cn } from "@/lib/utils";

export interface RoomPlayer {
  id: string;
  ign: string;
  photo: string | null;
  role: string | null;
  bio: string | null;
  verified: boolean;
  lastTeam: string | null;
  stats: { games: number; kills: number; revives: number; mvp: number; potm: number; avgKills: number } | null;
  availability: PlayerAvailability | null;
  /** Answers for the season's match days. */
  dates: Record<string, DateStatus>;
}

interface Props {
  auctionId: string;
  initial: AuctionSnapshot;
  players: Record<string, RoomPlayer>;
  matchDays: { day: string; label: string | null }[];
  teams: Record<string, Team>;
  viewer: { isAdmin: boolean; captainTeamId: string | null; signedIn: boolean; playerId?: string | null; userId?: string | null };
  screen: boolean;
}

type Result = { kind: "sold" | "unsold"; lot: AuctionLot; at: number };

/** After the price changes, bid buttons pause briefly so a tap meant for the old price can't land on the new one. */
const FREEZE_MS = 900;

export function AuctionRoom({ auctionId, initial, players, matchDays, teams, viewer, screen }: Props) {
  const sb = browserSupabase();
  const [snap, setSnap] = useState(initial);
  const [now, setNow] = useState(() => Date.parse(initial.now));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [priceChangedAt, setPriceChangedAt] = useState(0);
  const reduceMotion = useReducedMotion();
  const [unsoldBase, setUnsoldBase] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSeenAt, setChatSeenAt] = useState(initial.now);
  const offset = useRef(0);
  const bestRtt = useRef(Infinity);
  const prev = useRef<AuctionSnapshot | null>(null);
  const announcer = useAnnouncer();
  const { speak, sfx } = announcer;
  const crowdOn = useSyncExternalStore(crowdSounds.subscribe, crowdSounds.get, () => true);

  // Everyone's reactions play their sound here too, when sound is on (quietly, never over the voice).
  const onReaction = useCallback(
    (kind: ReactionKind) => {
      const s = REACTIONS[kind].sfx;
      if (s && announcer.enabled && crowdSounds.get()) playSfx(s, { crowd: true });
    },
    [announcer.enabled],
  );
  const live = useAuctionLive(sb, auctionId, viewer.userId ?? null, onReaction);
  const chat = useAuctionChat(sb, auctionId);
  const alerts = useAlerts();

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

  // ---- announcer + effects: react to what changed between snapshots
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
        if (announcer.enabled) playSfx("sold", { volume: 0.4 });
        speak(`Sold! ${ign(closed.player_id)} to ${teamName(closed.sold_team_id)} for ${closed.sold_price}.`, { interrupt: true });
        setResult({ kind: "sold", lot: closed, at: Date.now() });
      } else if (closed?.status === "unsold") {
        if (announcer.enabled) playSfx("unsold", { volume: 0.35 });
        speak(`${ign(closed.player_id)} goes unsold.`, { interrupt: true });
        setResult({ kind: "unsold", lot: closed, at: Date.now() });
      }
    }
    const l = after ? snap.lots.find((x) => x.id === after) : null;
    const pl = l ? players[l.player_id] : null;
    if (l && pl && after !== before) {
      sfx("next");
      speak(`Next up, ${pl.ign}.${pl.role ? ` ${pl.role}.` : ""} Base price ${lotBase(snap.auction, l)}.`);
    } else if (l && pl && after === before && l.draw_no !== p.lots.find((x) => x.id === after)?.draw_no) {
      speak(`Bidding restarts for ${pl.ign}.`, { interrupt: true });
      setPriceChangedAt(Date.now() + offset.current);
    }
    const top = snap.bids[0];
    if (top && top.id !== p.bids[0]?.id && top.lot_id === after) {
      sfx("bid");
      speak(`${teamName(top.team_id)}, ${top.amount}`, { interrupt: true });
      setPriceChangedAt(Date.now() + offset.current);
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
      const changed = /Price changed: (.+) now leads at (\d+)/.exec(error.message);
      const outbid = /Bid must be at least (\d+)/.exec(error.message);
      toast.error(
        changed
          ? `${changed[1]} bid ${credits(Number(changed[2]))} just before you. Tap again if you still want in.`
          : outbid
            ? `Outbid just now. Tap again for ${credits(Number(outbid[1]))}`
            : error.message,
      );
      void refresh();
      return null;
    }
    if (ok) toast.success(ok);
    void refresh();
    return data;
  };

  // Bids carry the price this screen showed, so two taps at once can never stack into a jump.
  const bid = (amount: number) => lot && call("auction_place_bid", { p_lot_id: lot.id, p_amount: amount, p_seen_bid: lot.current_bid ?? -1 });

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
  const frozen = now - priceChangedAt < FREEZE_MS;

  // The signed-in player's own lot, and an alert when they're drawn or sold.
  const myLot = viewer.playerId ? snap.lots.find((l) => l.player_id === viewer.playerId) ?? null : null;
  const onBlock = !!lot && !!viewer.playerId && lot.player_id === viewer.playerId;
  const myState = onBlock ? "block" : myLot?.status ?? "";
  const prevMyState = useRef(myState);
  useEffect(() => {
    const before = prevMyState.current;
    prevMyState.current = myState;
    if (before === myState || !a) return;
    if (myState === "block") {
      toast("You're on the block now!", { description: "Captains are bidding on you." });
      alerts.notify("You're on the block!", `${a.name}: captains are bidding on you now.`);
    } else if (before === "block" && myState === "sold" && myLot) {
      const to = teams[myLot.sold_team_id ?? ""]?.name ?? "a team";
      alerts.notify(`Sold to ${to}!`, `${a.name}: ${to} bought you for ${credits(myLot.sold_price ?? 0)}.`);
    }
  }, [myState, myLot, a, teams, alerts]);

  const recentClosed = useMemo(
    () =>
      snap.lots
        .filter((l) => (l.status === "sold" || l.status === "unsold") && l.closed_at)
        .sort((x, y) => (y.closed_at ?? "").localeCompare(x.closed_at ?? "")),
    [snap.lots],
  );

  if (!a) return <p className="text-muted-foreground">This auction no longer exists.</p>;

  const total = Math.max(a.timer_seconds, a.bid_extend_seconds, 1);
  const inCountdown = !!lot && a.status === "live" && secs > 0 && secs <= a.countdown_seconds;
  const player = lot ? players[lot.player_id] : null;
  const showResult = result && !lot;
  const lotBids = lot ? snap.bids.filter((b) => b.lot_id === lot.id) : [];
  const leaderTeam = leader ? teams[leader] ?? null : null;
  const chatEnabled = a.chat_enabled !== false;
  const unread = chat.messages.filter((m) => m.created_at > chatSeenAt).length;
  const openChat = (open: boolean) => {
    setChatOpen(open);
    setChatSeenAt(new Date(Date.now() + offset.current).toISOString());
  };
  const chatPanel = (props: { className?: string; readOnly?: boolean; autoFocus?: boolean }) => (
    <ChatPanel
      messages={chat.messages}
      onSend={chat.send}
      onDelete={(id) => void chat.remove(id)}
      teams={teams}
      signedIn={viewer.signedIn}
      enabled={chatEnabled}
      isAdmin={viewer.isAdmin}
      {...props}
    />
  );

  return (
    <div className={cn(screen ? "dark fixed inset-0 z-50 space-y-6 overflow-y-auto bg-background p-6 text-foreground sm:p-8" : "space-y-6", myTeam && !screen && "pb-24 lg:pb-0")}>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className={cn("leading-none", screen ? "text-5xl sm:text-6xl" : "text-3xl sm:text-5xl")}>{a.name}</h1>
        <StatusBadge status={a.status} />
        {a.is_practice && <Badge className="bg-info-soft text-info">PRACTICE</Badge>}
        <WatchingCount count={live.watching} big={screen} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {a.status !== "completed" && (
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
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
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

      {!screen && viewer.playerId && !myTeam && (
        <MyStatus
          lot={myLot}
          onBlock={onBlock}
          poolLeft={pool.length}
          soldTo={myLot?.sold_team_id ? teams[myLot.sold_team_id] ?? null : null}
          leader={leader ? teamName(leader) : null}
          bid={lot?.current_bid ?? null}
          canRegister={a.registration_open && a.status === "setup"}
          alerts={alerts}
        />
      )}

      <div className={cn("grid gap-6", screen ? "xl:grid-cols-[minmax(0,1fr)_400px]" : "lg:grid-cols-[minmax(0,1fr)_360px]")}>
        <div className="min-w-0 space-y-3">
          {/* Stage */}
          <section className={cn("dark relative isolate overflow-hidden rounded-2xl bg-brand text-foreground shadow-xl", screen ? "min-h-[560px]" : "min-h-[380px] md:min-h-[460px]", inCountdown && "ring-2 ring-loss/70")}>
            <TeamGlow color={leaderTeam ? teamColor(leaderTeam) : null} />
            <ReactionLayer floaters={live.floaters} big={screen} />
            {lot && player ? (
              // Phones: who, then price + timer, then stats. Wider: price + timer in their own column.
              <div
                className={cn(
                  "relative z-10 grid gap-4 p-5 sm:gap-6 sm:p-8",
                  screen
                    ? "xl:grid-cols-[minmax(0,1fr)_360px] xl:[grid-template-areas:'id_price'_'details_price']"
                    : "md:grid-cols-[minmax(0,1fr)_270px] md:[grid-template-areas:'id_price'_'details_price']",
                )}
              >
                <div className={cn("flex items-start gap-4 sm:gap-6", screen ? "xl:[grid-area:id]" : "md:[grid-area:id]")}>
                  <PlayerTile player={player} big={screen} />
                  <div className="min-w-0 flex-1 space-y-2 pt-1">
                    <PlayerChips lot={lot} player={player} base={lotBase(a, lot)} />
                    <h2 aria-label={player.ign} className={cn("font-heading leading-[0.88] font-extrabold break-words uppercase", screen ? "text-7xl sm:text-8xl" : "text-4xl sm:text-6xl xl:text-7xl")}>
                      {reduceMotion ? (
                        player.ign
                      ) : (
                        // Scrambles in each time a player is drawn (or re-drawn).
                        <DecryptedText
                          key={`${lot.id}:${lot.draw_no}`}
                          text={player.ign}
                          animateOn="view"
                          sequential
                          speed={60}
                          characters="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@"
                          encryptedClassName="text-hot"
                        />
                      )}
                    </h2>
                    {player.lastTeam && <p className="text-sm text-white/60">Last played for {player.lastTeam}</p>}
                    {player.bio && <p className="line-clamp-2 max-w-xl text-sm text-white/60 italic">“{player.bio}”</p>}
                  </div>
                </div>
                <div className={cn("flex flex-col gap-4 rounded-2xl bg-black/20 p-4 ring-1 ring-white/10", screen ? "xl:[grid-area:price]" : "md:[grid-area:price]")}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <PriceBlock price={lot.current_bid ?? lotBase(a, lot)} label={lot.current_bid != null ? "Current bid" : "Opening bid"} leader={leaderTeam} big={screen} />
                    <TimerRing secs={secs} frac={Math.max(0, Math.min(1, remainingMs / (total * 1000)))} paused={a.status === "paused"} danger={inCountdown} big={screen} />
                  </div>
                  <BidLadder bids={lotBids} teams={teams} big={screen} />
                </div>
                <div className={cn("min-w-0 space-y-4", screen ? "xl:[grid-area:details]" : "md:[grid-area:details]")}>
                  <StatRow player={player} />
                  <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/5">
                    <div className="mb-1.5 font-heading text-[11px] font-bold tracking-widest text-white/50 uppercase">Availability</div>
                    <AvailabilityBlock availability={player.availability} dates={matchDays.length ? { days: matchDays, answers: player.dates } : undefined} />
                  </div>
                </div>
              </div>
            ) : (
              <div className={cn("relative z-10 grid place-items-center", screen ? "min-h-[560px]" : "min-h-[380px] md:min-h-[460px]")}>
                <IdleStage
                  status={a.status}
                  poolCount={pool.length}
                  unsoldCount={unsold.length}
                  isAdmin={viewer.isAdmin}
                  countdown={a.status === "setup" && a.starts_at ? <StartCountdown startsAt={a.starts_at} now={now} title={a.name} big={screen} /> : null}
                />
              </div>
            )}

            {inCountdown && (
              <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-background/25">
                <span key={secs} className="font-heading text-[10rem] leading-none font-extrabold text-loss drop-shadow-[0_0_40px_rgba(255,45,75,0.6)] animate-in zoom-in-150 fade-in duration-300 sm:text-[14rem]">
                  {secs}
                </span>
              </div>
            )}
            <AnimatePresence>
              {showResult && (
                <SoldOverlay
                  key={result.at}
                  kind={result.kind}
                  player={players[result.lot.player_id]}
                  team={result.lot.sold_team_id ? teams[result.lot.sold_team_id] ?? null : null}
                  price={result.lot.sold_price ?? 0}
                  big={screen}
                />
              )}
            </AnimatePresence>
          </section>
          {!screen && a.status !== "completed" && (
            <ReactionBar onReact={live.react} canReact={viewer.signedIn} hype={live.hype} crowdOn={crowdOn} onCrowdToggle={() => crowdSounds.set(!crowdOn)} />
          )}
        </div>

        {/* Side column */}
        <aside className="min-w-0 space-y-4">
          {myTeam && myPurse && (
            <CaptainPanel
              team={teams[myTeam.team_id] ?? null}
              purse={myPurse}
              options={lot && a.status === "live" ? bidOptions(a, lot, 3) : []}
              leading={leader === myTeam.team_id}
              canBid={!!lot && a.status === "live" && !expired}
              busy={busy}
              frozen={frozen}
              onBid={(amount) => void bid(amount)}
            />
          )}
          {viewer.isAdmin && !screen && (
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-heading text-base font-bold tracking-wide uppercase">Auctioneer</span>
                <button
                  type="button"
                  className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
                  onClick={async () => {
                    const { error } = await sb.from("auctions").update({ chat_enabled: !chatEnabled }).eq("id", a.id);
                    if (error) toast.error(error.message);
                    else toast.success(chatEnabled ? "Chat turned off" : "Chat turned on");
                    void refresh();
                  }}
                >
                  Chat {chatEnabled ? "on" : "off"}
                </button>
              </div>
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
                      Sell now
                    </Button>
                    <Button variant="ghost" disabled={busy} onClick={() => confirm(`Mark ${player?.ign} unsold?`) && call("auction_close_lot", { p_lot_id: lot.id, p_force: "unsold" })}>
                      Mark unsold
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      title="Clears this player's bids and starts their timer again"
                      onClick={() =>
                        confirm(`Restart bidding for ${player?.ign}? Their bids are cleared and the timer starts again. Nothing else changes.`) &&
                        call("auction_restart_lot", { p_lot_id: lot.id }, `Bidding restarted for ${player?.ign}`)
                      }
                    >
                      <RotateCcw /> Restart player
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      title="Takes this player off the block; they can be drawn again later"
                      onClick={() => confirm(`Send ${player?.ign} back to the pool? Their bids are cleared.`) && call("auction_return_lot", { p_lot_id: lot.id }, `${player?.ign} is back in the pool`)}
                    >
                      Back to pool
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
                      onClick={() => confirm("Stop the auction? The player on the block goes back to the pool. Results so far are kept.") && call("auction_stop", { p_auction_id: a.id }, "Auction stopped")}
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
                Re-auction any result below, or pick the next player from the scouting board. Settings, captains, reopening and the roster step are in{" "}
                <Link href={`/admin/auction/${a.id}`} className="text-foreground underline underline-offset-2">
                  Admin → Auction
                </Link>
                .
              </p>
            </div>
          )}
          {!viewer.signedIn && a.status !== "completed" && !screen && (
            <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
              Captain or player?{" "}
              <Link href={`/login?next=${encodeURIComponent(`/auction?id=${auctionId}`)}`} className="text-foreground underline underline-offset-2">
                Sign in
              </Link>{" "}
              to bid, react and chat.
            </p>
          )}
          <ResultsList
            results={recentClosed}
            teams={teams}
            players={players}
            canEdit={viewer.isAdmin && !screen && a.status !== "completed" && !lot}
            busy={busy}
            onRedraw={(l) => confirm(`Put ${ign(l.player_id)} on the block again now? Their previous result is cleared.`) && call("auction_redraw_lot", { p_lot_id: l.id })}
            onReturn={(l) => confirm(`Send ${ign(l.player_id)} back to the pool? Their result is cleared.`) && call("auction_return_lot", { p_lot_id: l.id }, `${ign(l.player_id)} is back in the pool`)}
          />
          {chatPanel({ className: cn("hidden lg:flex", screen ? "h-[520px]" : "h-[440px]"), readOnly: screen })}
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
          frozen={frozen}
          onBid={(amount) => void bid(amount)}
        />
      )}
      {!screen && (
        <ChatSheet unread={unread} open={chatOpen} onOpenChange={openChat} raised={!!(myTeam && lot && a.status === "live")}>
          {chatPanel({ className: "min-h-0 flex-1 border-0", autoFocus: true })}
        </ChatSheet>
      )}

      {/* Teams */}
      <section>
        <h2 className="mb-3 font-heading text-xl font-bold tracking-wide uppercase">Teams</h2>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-4">
          {snap.teams.map((t) => (
            <TeamCard
              key={t.team_id}
              team={teams[t.team_id] ?? null}
              captain={t.captain_player_id ? ign(t.captain_player_id) : "TBD"}
              purse={teamPurse(a, t)}
              maxBuys={a.max_buys}
              squad={snap.lots.filter((l) => l.status === "sold" && l.sold_team_id === t.team_id).sort((x, y) => (x.closed_at ?? "").localeCompare(y.closed_at ?? ""))}
              leading={leader === t.team_id}
              ign={ign}
            />
          ))}
        </div>
      </section>

      {/* Scouting board: availability + form for everyone still to come */}
      {!screen && (
        <ScoutingBoard
          auctionId={auctionId}
          lots={snap.lots}
          players={players}
          matchDays={matchDays}
          canShortlist={!!viewer.captainTeamId}
          onDraw={viewer.isAdmin && !lot && a.status !== "completed" ? (l) => call("auction_redraw_lot", { p_lot_id: l.id }) : undefined}
        />
      )}
    </div>
  );
}
