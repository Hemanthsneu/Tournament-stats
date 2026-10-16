"use client";

import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BadgeCheck, Gavel } from "@/components/icons";
import { CrosshairIcon, MedkitIcon, PanIcon, ParachuteIcon, TargetIcon } from "@/components/pubg-icons";
import { Button } from "@/components/ui/button";
import ClickSpark from "@/components/reactbits/ClickSpark";
import ShinyText from "@/components/reactbits/ShinyText";
import { TeamLogo } from "@/components/team";
import { credits, type TeamPurse } from "@/lib/auction";
import { onColor, teamColor } from "@/lib/team-colors";
import type { AuctionBid, AuctionLot, Team } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { RoomPlayer } from "./auction-room";

export function StatusBadge({ status }: { status: string }) {
  const base = "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-heading text-xs font-bold tracking-widest uppercase";
  if (status === "live")
    return (
      <span className={cn(base, "bg-hot text-white")}>
        <span className="size-2 animate-pulse rounded-full bg-white" />
        <ShinyText text="LIVE" color="#ffffff" shineColor="#ffd84d" speed={2} />
      </span>
    );
  if (status === "paused") return <span className={cn(base, "bg-gold-soft text-gold")}>Paused</span>;
  if (status === "completed") return <span className={cn(base, "bg-muted text-muted-foreground")}>Finished</span>;
  return <span className={cn(base, "border text-muted-foreground")}>Starting soon</span>;
}

/** Soft glow in the leading team's colour behind the stage. */
export function TeamGlow({ color }: { color: string | null }) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute -top-40 -right-40 -z-0 size-[34rem] rounded-full blur-3xl"
      animate={{ backgroundColor: color ?? "#1d428a", opacity: color ? 0.45 : 0.25 }}
      transition={{ duration: 0.8 }}
    />
  );
}

export function PlayerTile({ player, big }: { player: RoomPlayer; big: boolean }) {
  const size = big ? "size-56 sm:size-64" : "size-28 sm:size-44";
  return player.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={player.photo} alt={player.ign} className={cn(size, "shrink-0 rounded-2xl object-cover shadow-2xl ring-4 ring-white/10")} />
  ) : (
    <div className={cn(size, "grid shrink-0 place-items-center rounded-2xl bg-white/5 font-heading font-extrabold text-white/70 italic ring-4 ring-white/10", big ? "text-8xl" : "text-5xl sm:text-7xl")}>
      {player.ign.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function PlayerChips({ lot, player, base }: { lot: AuctionLot; player: RoomPlayer; base: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="rounded-md bg-white/10 px-2 py-0.5 font-medium">
        {lot.set_name}
        {lot.round > 1 ? ` · round ${lot.round}` : ""}
      </span>
      {player.role && <span className="rounded-md bg-white/10 px-2 py-0.5">{player.role}</span>}
      {player.verified && (
        <span className="inline-flex items-center gap-1 rounded-md bg-win/15 px-2 py-0.5 text-win">
          <BadgeCheck className="size-3.5" /> Verified
        </span>
      )}
      <span className="rounded-md bg-white/5 px-2 py-0.5 text-white/60">Base {credits(base)}</span>
    </div>
  );
}

export function StatRow({ player }: { player: RoomPlayer }) {
  if (!player.stats) return <p className="text-sm text-white/60">New to the league: no stats yet.</p>;
  const s = player.stats;
  const stats = [
    { Icon: CrosshairIcon, v: s.kills, l: "Kills", c: "#ff2d4b" },
    { Icon: TargetIcon, v: s.avgKills.toFixed(1), l: "K/G", c: "#ff9f43" },
    { Icon: PanIcon, v: Math.round(s.mvp), l: "MVP", c: "#fbbf24" },
    { Icon: ParachuteIcon, v: s.games, l: "Games", c: "#7aa2ff" },
    { Icon: MedkitIcon, v: s.revives, l: "Revives", c: "#34d399" },
  ];
  return (
    <dl className="grid grid-cols-5 gap-2">
      {stats.map(({ Icon, v, l, c }) => (
        <div key={l} className="rounded-lg bg-white/5 px-2 py-2 text-center ring-1 ring-white/5">
          <Icon className="mx-auto size-4" style={{ color: c }} />
          <dd className="mt-1 font-heading text-xl leading-none font-bold tabular sm:text-2xl">{v}</dd>
          <dt className="mt-0.5 text-[10px] tracking-wide text-white/50 uppercase">{l}</dt>
        </div>
      ))}
    </dl>
  );
}

/** The price, rolling up a notch each time it changes. */
export function PriceBlock({ price, label, leader, big }: { price: number; label: string; leader: Team | null; big: boolean }) {
  const reduce = useReducedMotion();
  const color = leader ? teamColor(leader) : null;
  return (
    <div>
      <div className="font-heading text-xs font-bold tracking-widest text-white/60 uppercase">{label}</div>
      <div className={cn("relative h-[1em] overflow-hidden font-heading leading-none font-extrabold tabular", big ? "text-8xl" : "text-6xl sm:text-7xl")}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={price}
            className="absolute inset-x-0 block"
            initial={reduce ? { opacity: 0 } : { y: "70%", opacity: 0, scale: 1.08 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { y: "-70%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >
            {credits(price)}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="mt-2 h-8">
        <AnimatePresence mode="wait">
          {leader ? (
            <motion.span
              key={leader.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="inline-flex max-w-full items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm font-semibold"
              style={{ background: color!, color: onColor(color!) }}
              title={`${leader.name} leads`}
            >
              <span className="shrink-0 rounded-full bg-black/15 px-2 font-heading text-xs leading-6 font-bold">{leader.tag}</span>
              <span className="truncate">{leader.name}</span>
            </motion.span>
          ) : (
            <motion.span key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-white/50">
              No bids yet
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function TimerRing({ secs, frac, paused, danger, big }: { secs: number; frac: number; paused: boolean; danger: boolean; big: boolean }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const tone = danger ? "#ff2d4b" : frac < 0.5 ? "#fbbf24" : "#ffffff";
  return (
    <div className={cn("relative shrink-0", big ? "size-32" : "size-24 sm:size-28")}>
      {danger && <span className="absolute inset-2 animate-ping rounded-full bg-loss/30" aria-hidden />}
      <svg viewBox="0 0 100 100" className="relative size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: "stroke-dashoffset 100ms linear, stroke 300ms" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className={cn("font-heading leading-none font-extrabold tabular", big ? "text-5xl" : "text-4xl")} style={{ color: tone }}>
            {paused ? "II" : secs}
          </div>
          <div className="text-[10px] tracking-widest text-white/50 uppercase">{paused ? "paused" : "sec"}</div>
        </div>
      </div>
    </div>
  );
}

/** Every bid on this player, newest first: who bid what, and by how much they raised. */
export function BidLadder({ bids, teams, big }: { bids: AuctionBid[]; teams: Record<string, Team>; big: boolean }) {
  const shown = bids.slice(0, big ? 6 : 5);
  return (
    <div className="space-y-1">
      <div className="font-heading text-[11px] font-bold tracking-widest text-white/50 uppercase">Bids</div>
      {shown.length === 0 && <p className="text-xs text-white/40">Waiting for the first bid…</p>}
      <ol className="space-y-1">
        <AnimatePresence initial={false}>
          {shown.map((b, i) => {
            const team = teams[b.team_id] ?? null;
            const color = teamColor(team);
            const prev = bids[i + 1];
            return (
              <motion.li
                key={b.id}
                layout
                initial={{ opacity: 0, x: 24, scale: 0.96 }}
                animate={{ opacity: i === 0 ? 1 : Math.max(0.35, 0.9 - i * 0.15), x: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 36 }}
                className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5", i === 0 ? "bg-white/12 ring-1 ring-white/20" : "bg-white/[0.04]")}
              >
                <span className="rounded-[4px] px-1.5 font-heading text-xs leading-5 font-bold" style={{ background: color, color: onColor(color) }}>
                  {team?.tag ?? "?"}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{team?.name ?? "Team"}</span>
                {prev && <span className="text-[10px] text-white/45 tabular">+{credits(b.amount - prev.amount)}</span>}
                <span className={cn("font-heading font-bold tabular", i === 0 ? "text-lg" : "text-base")}>{credits(b.amount)}</span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
    </div>
  );
}

/** "SOLD!" stamp with a confetti burst in the buying team's colour. */
export function SoldOverlay({ kind, player, team, price, big }: { kind: "sold" | "unsold"; player: RoomPlayer | undefined; team: Team | null; price: number; big: boolean }) {
  const reduce = useReducedMotion();
  const color = team ? teamColor(team) : "#94a3b8";
  // Confetti pieces from a seeded pseudo-random, so each player's burst looks different but renders purely.
  const seed = (player?.id ?? "x").split("").reduce((n, ch) => n + ch.charCodeAt(0), 0);
  const bits = useMemo(() => {
    const rand = (i: number, k: number) => {
      const v = Math.sin((i + 1) * 12.9898 + k * 78.233 + seed) * 43758.5453;
      return v - Math.floor(v);
    };
    return Array.from({ length: 70 }, (_, i) => ({
      i,
      x: (rand(i, 1) - 0.5) * 900,
      y: -120 - rand(i, 2) * 380,
      r: rand(i, 3) * 720 - 360,
      d: 0.9 + rand(i, 4) * 0.9,
      s: 6 + rand(i, 5) * 8,
      c: [color, "#fbbf24", "#ffffff", color, "#ff2d4b"][i % 5],
    }));
  }, [color, seed]);
  const sold = kind === "sold";
  return (
    <motion.div className="absolute inset-0 z-30 grid place-items-center bg-brand/85 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {sold && !reduce && (
        <div className="pointer-events-none absolute top-1/2 left-1/2" aria-hidden>
          {bits.map((b) => (
            <motion.span
              key={b.i}
              className="absolute block rounded-[2px]"
              style={{ width: b.s, height: b.s * 0.6, background: b.c }}
              initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
              animate={{ x: b.x, y: [0, b.y, b.y + 520], rotate: b.r, opacity: [1, 1, 0] }}
              transition={{ duration: b.d + 1.2, ease: "easeOut", times: [0, 0.35, 1] }}
            />
          ))}
        </div>
      )}
      <div className="relative text-center">
        <motion.div
          initial={reduce ? { opacity: 0 } : { scale: 2.6, rotate: -18, opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { scale: 1, rotate: -6, opacity: 1, x: sold ? 0 : [0, -8, 8, -4, 0] }}
          transition={{ type: "spring", stiffness: 260, damping: 14 }}
          className={cn(
            "mx-auto inline-block rounded-xl border-[6px] px-8 py-1 font-heading font-extrabold uppercase italic",
            big ? "text-8xl sm:text-9xl" : "text-6xl sm:text-7xl",
            sold ? "border-current" : "border-white/40 text-white/50",
          )}
          style={sold ? { color, textShadow: `0 0 40px ${color}` } : undefined}
        >
          {sold ? "Sold!" : "Unsold"}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div className={cn("mt-6 font-heading font-extrabold uppercase", big ? "text-6xl" : "text-4xl")}>{player?.ign}</div>
          {sold && team && (
            <div className="mt-3 inline-flex items-center gap-3 rounded-full py-1.5 pr-5 pl-1.5" style={{ background: color, color: onColor(color) }}>
              <span className="rounded-full bg-black/15 px-3 font-heading text-lg leading-9 font-bold">{team.tag}</span>
              <span className="font-semibold">{team.name}</span>
              <span className="font-heading text-3xl font-extrabold tabular">{credits(price)}</span>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

export function IdleStage({ status, poolCount, unsoldCount, isAdmin, countdown }: { status: string; poolCount: number; unsoldCount: number; isAdmin: boolean; countdown: React.ReactNode }) {
  if (countdown)
    return (
      <>
        {countdown}
        {isAdmin && <p className="-mt-6 pb-4 text-center text-xs text-white/50">Draw the first player from the auctioneer panel when you&apos;re ready.</p>}
      </>
    );
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
      <motion.div animate={{ rotate: [0, -18, 0] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.4 }}>
        <Gavel className="size-12 text-white/50" />
      </motion.div>
      <p className="mt-4 font-heading text-3xl font-bold uppercase">{title}</p>
      <p className="mt-1 text-sm text-white/55">
        {status === "completed"
          ? "See the final squads below."
          : isAdmin
            ? "Draw the next player from the auctioneer panel, or pick one from the scouting board."
            : `${poolCount} player${poolCount === 1 ? "" : "s"} waiting in the pool. Turn sound on to hear the auctioneer and the crowd.`}
      </p>
    </div>
  );
}

export function CaptainPanel({
  team,
  purse,
  options,
  leading,
  canBid,
  busy,
  frozen,
  onBid,
}: {
  team: Team | null;
  purse: TeamPurse;
  options: number[];
  leading: boolean;
  canBid: boolean;
  busy: boolean;
  frozen: boolean;
  onBid: (amount: number) => void;
}) {
  const color = teamColor(team);
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
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: color, color: onColor(color) }}>
        <span className="rounded-md bg-black/15 px-2 font-heading text-sm leading-7 font-bold">{team?.tag}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] tracking-widest uppercase opacity-80">Captain&apos;s room</div>
          <div className="truncate font-heading text-lg leading-tight font-bold uppercase">{team?.name}</div>
        </div>
        {leading && <span className="rounded-full bg-black/20 px-2.5 py-0.5 font-heading text-xs font-bold tracking-wide uppercase">Leading</span>}
      </div>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            [credits(purse.left), "Purse left"],
            [purse.slotsLeft, "Slots left"],
            [credits(Math.max(purse.maxBid, 0)), "Max bid"],
          ].map(([v, l]) => (
            <div key={l} className="rounded-lg bg-muted/60 py-2">
              <div className="font-heading text-xl leading-none font-bold tabular">{v}</div>
              <div className="mt-1 text-[10px] tracking-wide text-muted-foreground uppercase">{l}</div>
            </div>
          ))}
        </div>
        {options.length > 0 && (
          <ClickSpark sparkColor={["#ff2d4b", "#fbbf24", "#ffffff"]} sparkCount={12} sparkRadius={28} className="mt-4 grid h-auto gap-2">
            <Button size="lg" className={cn("relative h-16 overflow-hidden bg-hot text-xl font-bold text-white hover:bg-hot/90", frozen && "opacity-70")} disabled={busy || !!reason || frozen} onClick={() => onBid(options[0])}>
              <Gavel className="size-5" /> Bid {credits(options[0])}
              {frozen && <span className="absolute inset-0 grid place-items-center bg-black/30 font-heading text-sm tracking-widest uppercase">Price changed</span>}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              {options.slice(1).map((amt) => (
                <Button key={amt} variant="outline" className="h-11 text-base tabular" disabled={busy || !!reason || frozen || amt > purse.maxBid} onClick={() => onBid(amt)}>
                  Jump to {credits(amt)}
                </Button>
              ))}
            </div>
          </ClickSpark>
        )}
        {reason && <p className="mt-2 text-center text-xs text-muted-foreground">{reason}</p>}
      </div>
    </div>
  );
}

export function MobileBidBar({
  price,
  secs,
  danger,
  next,
  leading,
  disabled,
  frozen,
  onBid,
}: {
  price: number;
  secs: number;
  danger: boolean;
  next: number;
  leading: boolean;
  disabled: boolean;
  frozen: boolean;
  onBid: (amount: number) => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <div className="min-w-0">
          <div className="text-[10px] tracking-wide text-muted-foreground uppercase">{leading ? "You lead at" : "Current"}</div>
          <div className="font-heading text-2xl leading-none font-bold tabular">{credits(price)}</div>
        </div>
        <div className={cn("font-heading text-2xl font-bold tabular", danger && "animate-pulse text-loss")}>{secs}s</div>
        <ClickSpark sparkColor={["#ff2d4b", "#fbbf24"]} sparkCount={10} sparkRadius={24} className="ml-auto h-auto w-auto flex-1">
          <Button size="lg" className="relative h-12 w-full overflow-hidden bg-hot text-base font-bold text-white hover:bg-hot/90" disabled={disabled || leading || frozen} onClick={() => onBid(next)}>
            <Gavel /> {leading ? "Leading" : `Bid ${credits(next)}`}
            {frozen && !leading && <span className="absolute inset-0 grid place-items-center bg-black/35 font-heading text-xs tracking-widest uppercase">Price changed</span>}
          </Button>
        </ClickSpark>
      </div>
    </div>
  );
}

export function TeamCard({
  team,
  captain,
  purse,
  maxBuys,
  squad,
  leading,
  ign,
}: {
  team: Team | null;
  captain: string;
  purse: TeamPurse;
  maxBuys: number;
  squad: AuctionLot[];
  leading: boolean;
  ign: (playerId: string) => string;
}) {
  const color = teamColor(team);
  const pct = Math.max(0, Math.min(100, (purse.left / purse.total) * 100));
  return (
    <motion.div
      layout
      className={cn("relative w-[78vw] max-w-xs shrink-0 snap-start overflow-hidden rounded-xl border bg-card sm:w-auto sm:max-w-none", leading && "ring-2 ring-hot")}
      animate={leading ? { y: -3 } : { y: 0 }}
    >
      <div className="h-1.5" style={{ background: color }} />
      <div className="p-4">
        <div className="flex items-center gap-3">
          <TeamLogo team={team} size="md" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-heading text-base font-bold uppercase">{team?.name}</div>
            <div className="truncate text-xs text-muted-foreground">Captain: {captain}</div>
          </div>
          {leading && <span className="rounded-full bg-hot px-2 py-0.5 font-heading text-[10px] font-bold tracking-wide text-white uppercase">Bidding</span>}
        </div>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="font-heading text-3xl leading-none font-bold tabular">{credits(purse.left)}</div>
            <div className="text-[10px] tracking-wide text-muted-foreground uppercase">of {credits(purse.total)} left</div>
          </div>
          <div className="text-right text-[11px] text-muted-foreground">
            <div>
              {purse.bought}/{maxBuys} bought
            </div>
            <div>Max bid {credits(Math.max(purse.maxBid, 0))}</div>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <motion.div className="h-full rounded-full" style={{ background: color }} initial={false} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
        </div>
        <ul className="mt-3 flex flex-wrap gap-1">
          <AnimatePresence initial={false}>
            {squad.map((l) => (
              <motion.li key={l.id} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
                <span className="font-medium">{ign(l.player_id)}</span>
                <span className="text-muted-foreground tabular">{credits(l.sold_price ?? 0)}</span>
              </motion.li>
            ))}
          </AnimatePresence>
          {squad.length === 0 && <li className="text-xs text-muted-foreground">No players yet</li>}
        </ul>
      </div>
    </motion.div>
  );
}

export function ResultsList({
  results,
  teams,
  players,
  canEdit,
  busy,
  onRedraw,
  onReturn,
}: {
  results: AuctionLot[];
  teams: Record<string, Team>;
  players: Record<string, RoomPlayer>;
  canEdit: boolean;
  busy: boolean;
  onRedraw: (lot: AuctionLot) => void;
  onReturn: (lot: AuctionLot) => void;
}) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-4 py-2.5 font-heading text-base font-bold tracking-wide uppercase">Results</div>
      {results.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">Nothing sold yet.</p>
      ) : (
        <ol className="max-h-72 divide-y overflow-y-auto">
          {results.map((l) => {
            const team = l.sold_team_id ? teams[l.sold_team_id] ?? null : null;
            return (
              <li key={l.id} className="group flex items-center gap-2 px-4 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{players[l.player_id]?.ign}</span>
                {l.status === "sold" ? (
                  <>
                    <span className="rounded-[4px] px-1.5 font-heading text-[11px] leading-5 font-bold" style={{ background: teamColor(team), color: onColor(teamColor(team)) }}>
                      {team?.tag}
                    </span>
                    <span className="w-12 text-right font-heading font-bold text-win tabular">{credits(l.sold_price ?? 0)}</span>
                  </>
                ) : (
                  <span className="text-xs text-loss">unsold</span>
                )}
                {canEdit && (
                  <span className="flex gap-1">
                    <button type="button" disabled={busy} onClick={() => onRedraw(l)} className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-hot hover:text-hot" title="Put this player on the block again now">
                      Re-auction
                    </button>
                    <button type="button" disabled={busy} onClick={() => onReturn(l)} className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground" title="Send back into the pool for later">
                      To pool
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
