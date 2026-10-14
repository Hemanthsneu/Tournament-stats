"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { BellRinging, CalendarPlus, Eye } from "@/components/icons";
import { ChickenIcon, CrosshairIcon, MedkitIcon, PanIcon } from "@/components/pubg-icons";
import { credits } from "@/lib/auction";
import { onColor, teamColor } from "@/lib/team-colors";
import { fmtDateTime } from "@/lib/time";
import type { AuctionLot, Team } from "@/lib/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Viewers and reactions: realtime presence + broadcast on one channel. Nothing is stored.
// ---------------------------------------------------------------------------

export const REACTIONS = {
  pan: { label: "Pan!", Icon: PanIcon, color: "#f2b705" },
  chicken: { label: "Chicken dinner", Icon: ChickenIcon, color: "#ff9f43" },
  headshot: { label: "Headshot", Icon: CrosshairIcon, color: "#ff2d4b" },
  revive: { label: "Revive", Icon: MedkitIcon, color: "#34d399" },
} as const;
export type ReactionKind = keyof typeof REACTIONS;
const isReaction = (k: unknown): k is ReactionKind => typeof k === "string" && k in REACTIONS;

type Floater = { id: number; kind: ReactionKind; x: number; drift: number };

const MAX_FLOATERS = 40;
const SEND_GAP_MS = 700; // per viewer
const RECEIVE_LIMIT = 5; // per sender per 3 seconds; anything faster is ignored

/** Live viewer count and floating reactions for one auction room. */
export function useAuctionLive(sb: SupabaseClient, auctionId: string, userId: string | null) {
  // Signed-in viewers count once across tabs; guests once per tab.
  const [key] = useState(() => userId ?? `guest-${Math.random().toString(36).slice(2, 10)}`);
  const [watching, setWatching] = useState(0);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const channel = useRef<RealtimeChannel | null>(null);
  const seq = useRef(0);
  const recent = useRef(new Map<string, number[]>());
  const lastSent = useRef(0);

  const show = useCallback((kind: ReactionKind) => {
    const id = ++seq.current;
    setFloaters((f) => [...f.slice(-(MAX_FLOATERS - 1)), { id, kind, x: 6 + Math.random() * 88, drift: (Math.random() - 0.5) * 80 }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 2600);
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

  return { watching, floaters, react };
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
export function ReactionLayer({ floaters }: { floaters: Floater[] }) {
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden>
      <AnimatePresence>
        {floaters.map((f) => {
          const { Icon, color } = REACTIONS[f.kind];
          return (
            <motion.div
              key={f.id}
              className="absolute bottom-6"
              style={{ left: `${f.x}%`, color }}
              initial={{ y: 0, opacity: 0, scale: 0.6 }}
              animate={
                reduce
                  ? { opacity: [0, 1, 0] }
                  : { y: -300, x: f.drift, opacity: [0, 1, 1, 0], scale: [0.6, 1.25, 1, 0.9], rotate: f.drift / 3 }
              }
              transition={{ duration: 2.4, ease: "easeOut" }}
            >
              <Icon className="size-11 drop-shadow-[0_3px_8px_rgba(0,0,0,0.45)]" />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function ReactionBar({ onReact, canReact }: { onReact: (kind: ReactionKind) => void; canReact: boolean }) {
  if (!canReact) {
    return (
      <Link href="/login?next=/auction" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
        Sign in to react
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="React">
      {(Object.keys(REACTIONS) as ReactionKind[]).map((k) => {
        const { Icon, label, color } = REACTIONS[k];
        return (
          <button
            key={k}
            type="button"
            onClick={() => onReact(k)}
            title={label}
            aria-label={`React: ${label}`}
            className="grid size-10 place-items-center rounded-full border bg-card transition hover:-translate-y-0.5 hover:shadow-md active:scale-90"
            style={{ color }}
          >
            <Icon className="size-5" />
          </button>
        );
      })}
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
