"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { BellRinging, CalendarPlus, Eye } from "@/components/icons";
import { ChickenIcon } from "@/components/pubg-icons";
import { credits } from "@/lib/auction";
import { onColor, teamColor } from "@/lib/team-colors";
import { fmtDateTime } from "@/lib/time";
import type { AuctionLot, Team } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Sfx } from "./sfx";

// ---------------------------------------------------------------------------
// Viewers and reactions: realtime presence + broadcast on one channel. Nothing is stored.
// ---------------------------------------------------------------------------

/** Reactions: 3D emoji (Fluent Emoji, MIT) with a game sound each. */
export const REACTIONS = {
  headshot: { label: "Headshot", img: "/reactions/headshot.png", sfx: "awm" },
  fire: { label: "On fire", img: "/reactions/fire.png", sfx: "smg" },
  pan: { label: "Pan!", img: "/reactions/pan.png", sfx: "pan" },
  nade: { label: "Nade", img: "/reactions/nade.png", sfx: "nade" },
  dinner: { label: "Chicken dinner", img: "/reactions/dinner.png", sfx: "dinner" },
  money: { label: "Big money", img: "/reactions/money.png", sfx: "money" },
  boom: { label: "Boom", img: "/reactions/boom.png", sfx: "boom" },
  clap: { label: "GG", img: "/reactions/clap.png", sfx: "clap" },
  lol: { label: "LOL", img: "/reactions/lol.png", sfx: null },
  skull: { label: "Rekt", img: "/reactions/skull.png", sfx: "skull" },
} as const satisfies Record<string, { label: string; img: string; sfx: Sfx | null }>;
export type ReactionKind = keyof typeof REACTIONS;
const isReaction = (k: unknown): k is ReactionKind => typeof k === "string" && k in REACTIONS;

type Floater = { id: number; kind: ReactionKind; x: number; drift: number; spin: number };

const MAX_FLOATERS = 40;
const SEND_GAP_MS = 600; // per viewer
const RECEIVE_LIMIT = 5; // per sender per 3 seconds; anything faster is ignored

/**
 * Live viewer count and floating reactions for one auction room. `onReaction` fires for every
 * reaction shown (yours and everyone else's), e.g. to play its sound.
 */
export function useAuctionLive(sb: SupabaseClient, auctionId: string, userId: string | null, onReaction?: (kind: ReactionKind) => void) {
  // Signed-in viewers count once across tabs; guests once per tab.
  const [key] = useState(() => userId ?? `guest-${Math.random().toString(36).slice(2, 10)}`);
  const [watching, setWatching] = useState(0);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [hype, setHype] = useState<Partial<Record<ReactionKind, number>>>({});
  const channel = useRef<RealtimeChannel | null>(null);
  const seq = useRef(0);
  const recent = useRef(new Map<string, number[]>());
  const lastSent = useRef(0);
  const onReactionRef = useRef(onReaction);
  useEffect(() => {
    onReactionRef.current = onReaction;
  }, [onReaction]);

  const show = useCallback((kind: ReactionKind) => {
    const id = ++seq.current;
    setFloaters((f) => [...f.slice(-(MAX_FLOATERS - 1)), { id, kind, x: 6 + Math.random() * 88, drift: (Math.random() - 0.5) * 120, spin: (Math.random() - 0.5) * 50 }]);
    setHype((h) => ({ ...h, [kind]: (h[kind] ?? 0) + 1 }));
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 2800);
    // The count on each button shows the last few seconds of hype.
    setTimeout(() => setHype((h) => ({ ...h, [kind]: Math.max((h[kind] ?? 1) - 1, 0) })), 6000);
    onReactionRef.current?.(kind);
  }, []);

  useEffect(() => {
    const ch = sb.channel(`auction-live-${auctionId}`, { config: { presence: { key }, broadcast: { self: false } } });
    ch.on("presence", { event: "sync" }, () => setWatching(Object.keys(ch.presenceState()).length))
      .on("broadcast", { event: "react" }, ({ payload }) => {
        const from = String(payload?.from ?? "");
        if (!isReaction(payload?.kind)) return;
        const now = Date.now();
        const times = (recent.current.get(from) ?? []).filter((t) => now - t < 3000);
        if (times.length >= RECEIVE_LIMIT) return;
        recent.current.set(from, [...times, now]);
        show(payload.kind);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void ch.track({ since: Date.now() });
      });
    channel.current = ch;
    return () => {
      channel.current = null;
      void sb.removeChannel(ch);
    };
  }, [sb, auctionId, key, show]);

  const react = useCallback(
    (kind: ReactionKind) => {
      const now = Date.now();
      if (now - lastSent.current < SEND_GAP_MS) return;
      lastSent.current = now;
      show(kind);
      void channel.current?.send({ type: "broadcast", event: "react", payload: { kind, from: key } });
    },
    [key, show],
  );

  return { watching, floaters, hype, react };
}

export function WatchingCount({ count, big }: { count: number; big?: boolean }) {
  if (count < 1) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-muted-foreground tabular", big ? "text-lg" : "text-sm")} aria-live="polite">
      <Eye className={big ? "size-5" : "size-4"} /> {count} watching
    </span>
  );
}

/** Reactions floating up over the stage. Sits inside a `relative overflow-hidden` container. */
export function ReactionLayer({ floaters, big }: { floaters: Floater[]; big?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden>
      <AnimatePresence>
        {floaters.map((f) => (
          <motion.img
            key={f.id}
            src={REACTIONS[f.kind].img}
            alt=""
            className={cn("absolute bottom-4 drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)]", big ? "size-20" : "size-14")}
            style={{ left: `${f.x}%` }}
            initial={{ y: 0, opacity: 0, scale: 0.3 }}
            animate={
              reduce
                ? { opacity: [0, 1, 0] }
                : { y: [0, -60, -340], x: [0, f.drift * 0.3, f.drift], opacity: [0, 1, 1, 0], scale: [0.3, 1.35, 1, 0.85], rotate: [0, f.spin, -f.spin / 2] }
            }
            transition={{ duration: 2.6, ease: "easeOut", times: [0, 0.18, 1] }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

export function ReactionBar({
  onReact,
  canReact,
  hype,
  crowdOn,
  onCrowdToggle,
}: {
  onReact: (kind: ReactionKind) => void;
  canReact: boolean;
  hype: Partial<Record<ReactionKind, number>>;
  crowdOn: boolean;
  onCrowdToggle: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 py-1.5 [scrollbar-width:none]" role="group" aria-label="React">
        {(Object.keys(REACTIONS) as ReactionKind[]).map((k) => {
          const { label, img } = REACTIONS[k];
          const n = hype[k] ?? 0;
          return (
            <button
              key={k}
              type="button"
              onClick={() => (canReact ? onReact(k) : undefined)}
              disabled={!canReact}
              title={canReact ? label : "Sign in to react"}
              aria-label={`React: ${label}`}
              className="group relative grid size-12 shrink-0 place-items-center rounded-2xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md active:scale-90 disabled:opacity-60 disabled:hover:translate-y-0 sm:size-14"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" className="size-8 transition-transform duration-200 group-hover:scale-110 group-active:scale-95 sm:size-9" />
              {n > 1 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-hot px-1 font-heading text-[11px] leading-5 font-bold text-white tabular">
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {!canReact && (
          <Link href="/login?next=/auction" className="underline-offset-2 hover:underline">
            Sign in to react
          </Link>
        )}
        <button type="button" onClick={onCrowdToggle} className="rounded-full border px-2.5 py-1 transition-colors hover:bg-accent" aria-pressed={crowdOn}>
          Crowd sounds {crowdOn ? "on" : "off"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Start time countdown (before the first player is drawn)
// ---------------------------------------------------------------------------

function calendarLink(title: string, startsAt: string): string {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + 2 * 3_600_000);
  const details = `Watch live: ${window.location.origin}/auction`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${stamp(start)}/${stamp(end)}&details=${encodeURIComponent(details)}`;
}

export function StartCountdown({ startsAt, now, title, big }: { startsAt: string; now: number; title: string; big?: boolean }) {
  const ms = Date.parse(startsAt) - now;
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const cells = (d > 0 ? [[d, "days"]] : []).concat([
    [h, "hours"],
    [m, "min"],
    [s, "sec"],
  ]) as [number, string][];
  return (
    <div className="grid place-items-center gap-4 py-10 text-center">
      <div className="font-heading text-sm font-bold tracking-widest text-muted-foreground uppercase">{ms > 0 ? "The auction starts in" : "Starting any moment now"}</div>
      {ms > 0 && (
        <div className="flex gap-2 sm:gap-3">
          {cells.map(([v, u]) => (
            <div key={u} className={cn("rounded-lg bg-white/5 px-3 py-2 ring-1 ring-white/10", big ? "min-w-28" : "min-w-16 sm:min-w-20")}>
              <div className={cn("font-heading leading-none font-bold tabular", big ? "text-7xl" : "text-4xl sm:text-5xl")}>{String(v).padStart(2, "0")}</div>
              <div className="mt-1 text-[11px] tracking-widest text-muted-foreground uppercase">{u}</div>
            </div>
          ))}
        </div>
      )}
      <div className="text-sm text-muted-foreground">{fmtDateTime(startsAt)}</div>
      {ms > 0 && !big && (
        <button
          type="button"
          onClick={() => window.open(calendarLink(title, startsAt), "_blank", "noopener")}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ring-1 ring-white/20 transition hover:bg-white/10"
        >
          <CalendarPlus className="size-4" /> Add to Google Calendar
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The signed-in player's own status
// ---------------------------------------------------------------------------

const noop = () => () => {};
const permission = () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission);

/** Browser alerts when this tab is in the background (e.g. "You're on the block!"). */
export function useAlerts() {
  const [, bump] = useState(0);
  const perm = useSyncExternalStore(noop, permission, () => "unsupported" as const);
  const enable = useCallback(() => {
    void Notification.requestPermission().then(() => bump((n) => n + 1));
  }, []);
  const notify = useCallback((title: string, body: string) => {
    if (permission() === "granted" && document.hidden) new Notification(title, { body, tag: "wow-auction" });
  }, []);
  return { perm, enable, notify };
}

export function MyStatus({
  lot,
  onBlock,
  poolLeft,
  soldTo,
  leader,
  bid,
  canRegister,
  alerts,
}: {
  lot: AuctionLot | null;
  onBlock: boolean;
  poolLeft: number;
  soldTo: Team | null;
  leader: string | null;
  bid: number | null;
  canRegister: boolean;
  alerts: ReturnType<typeof useAlerts>;
}) {
  if (!lot) {
    if (!canRegister) return null;
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-sm">
        <span>You&apos;re not in this auction&apos;s pool yet.</span>
        <Link href="/me" className="font-semibold text-hot hover:underline">
          Register on your profile →
        </Link>
      </div>
    );
  }

  if (onBlock) {
    return (
      <div className="relative overflow-hidden rounded-lg bg-hot px-5 py-4 text-white">
        <div className="absolute inset-y-0 right-0 w-1/3 animate-pulse bg-white/10" aria-hidden />
        <div className="relative font-heading text-2xl font-extrabold tracking-wide uppercase italic sm:text-3xl">You&apos;re on the block now!</div>
        <div className="relative mt-1 text-sm text-white/85">
          {bid != null && leader ? `${leader} leads at ${credits(bid)}.` : "Waiting for the first bid."} Fingers crossed.
        </div>
      </div>
    );
  }

  if (lot.status === "sold" && soldTo) {
    const color = teamColor(soldTo);
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg px-5 py-4" style={{ background: color, color: onColor(color) }}>
        <ChickenIcon className="size-8 shrink-0" />
        <div>
          <div className="font-heading text-2xl font-extrabold tracking-wide uppercase italic">
            Sold to {soldTo.name} for {credits(lot.sold_price ?? 0)}
          </div>
          <div className="text-sm opacity-85">Welcome to the squad.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="font-heading text-base font-bold tracking-wide uppercase">
          {lot.status === "unsold" ? "Unsold this round" : "You're in the pool"}
        </div>
        <div className="text-xs text-muted-foreground">
          {lot.status === "unsold"
            ? "Unsold players can come back if the organizers run another round."
            : `Players are drawn at random. ${poolLeft} still to come, so stay tuned.`}
        </div>
      </div>
      {lot.status !== "unsold" &&
        (alerts.perm === "default" ? (
          <button type="button" onClick={alerts.enable} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
            <BellRinging className="size-4" /> Alert me when I&apos;m drawn
          </button>
        ) : alerts.perm === "granted" ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-win">
            <BellRinging className="size-4" /> Alerts on
          </span>
        ) : null)}
    </div>
  );
}
