"use client";

import { AnimatePresence, motion } from "motion/react";
import { credits } from "@/lib/auction";
import { cn } from "@/lib/utils";

/** The draw ceremony, in ms after a new player is drawn. The name is announced at REVEAL_MS. */
export const DRAW_TIMELINE = { toBag: 1400, dig: 2600, back: 4000, done: 8000 } as const;
export const REVEAL_MS = DRAW_TIMELINE.back;
const SOLD_MS = 1800;

export interface HallTeam {
  id: string;
  tag: string;
  name: string;
  color: string;
  ink: string;
  captain: string;
  left: number;
  bought: number;
  maxBuys: number;
  /** Match days this squad can field a full lineup, out of `days`; null when there are no match days. */
  covered: number | null;
  days: number;
  /** Lineup size the cover is measured against. */
  need: number;
}

type Phase = "idle" | "toBag" | "dig" | "back" | "announce" | "sold";

interface Props {
  /** When the current player was drawn (server-synced clock), or null when the ceremony shouldn't play. */
  drawAt: number | null;
  now: number;
  ign: string | null;
  poolLeft: number;
  leaderId: string | null;
  bid: number | null;
  /** Changes with every new top bid, to pop that team's paddle. */
  bidKey: string | null;
  result: { at: number; kind: "sold" | "unsold"; teamId: string | null } | null;
  teams: HallTeam[];
  status: string;
  big: boolean;
  /** Bid paddles only, no walking (reduced motion or the viewer turned the show off). */
  still: boolean;
}

// Stage positions, as % of the scene width.
const PODIUM_X = 58;
const BAG_X = 19;
const DIG_X = 24;

function phaseOf(drawAt: number | null, now: number, result: Props["result"]): Phase {
  if (result && result.kind === "sold" && now - result.at < SOLD_MS) return "sold";
  if (drawAt == null) return "idle";
  const t = now - drawAt;
  // The room's clock ticks every 100ms, so a fresh draw can read as slightly in the future.
  if (t < 0) return t > -5000 ? "toBag" : "idle";
  if (t < DRAW_TIMELINE.toBag) return "toBag";
  if (t < DRAW_TIMELINE.dig) return "dig";
  if (t < DRAW_TIMELINE.back) return "back";
  if (t < DRAW_TIMELINE.done) return "announce";
  return "idle";
}

const SKIN = "#d9a273";
const SUIT = "#1d2433";

/** The auctioneer: front view, built from pieces so arms and legs can swing around real joints. */
function Auctioneer({ phase, ign }: { phase: Phase; ign: string | null }) {
  const walking = phase === "toBag" || phase === "back";
  const leftArm = phase === "dig" ? 44 : phase === "announce" ? 158 : walking ? 0 : 10;
  const rightArm = phase === "sold" ? [-20, -150, -38, -150, -38] : walking ? 0 : phase === "announce" ? -14 : -10;
  const holdsSlip = phase === "back" || phase === "announce";
  return (
    <motion.div
      className={cn("relative h-[180px] w-[80px]", walking ? "hall-walking" : "hall-idle")}
      animate={{ rotate: phase === "toBag" ? -4 : phase === "back" ? 4 : 0, y: phase === "announce" ? -4 : 0 }}
      transition={{ type: "spring", stiffness: 90, damping: 16 }}
      style={{ originY: 1 }}
    >
      <span aria-hidden className="absolute -bottom-2 left-1/2 h-3 w-20 -translate-x-1/2 rounded-[50%] bg-black/45 blur-[3px]" />
      {/* legs */}
      <div className="hall-leg-a absolute top-[112px] left-[26px] h-[60px] w-[13px] rounded-b-sm" style={{ background: SUIT }}>
        <span className="absolute -bottom-1 -left-1 h-[8px] w-[19px] rounded-full bg-[#0b0d12]" />
      </div>
      <div className="hall-leg-b absolute top-[112px] left-[41px] h-[60px] w-[13px] rounded-b-sm" style={{ background: SUIT }}>
        <span className="absolute -right-1 -bottom-1 h-[8px] w-[19px] rounded-full bg-[#0b0d12]" />
      </div>
      <div className="hall-body absolute inset-0">
        {/* arms behind the jacket edge */}
        <motion.div
          className="absolute top-[58px] left-[4px] h-[56px] w-[14px]"
          style={{ originX: 0.5, originY: 0.08 }}
          animate={{ rotate: leftArm }}
          transition={{ type: "spring", stiffness: 70, damping: 13 }}
        >
          <span className="absolute inset-x-0 top-0 h-[46px] rounded-full" style={{ background: SUIT }} />
          <span className="absolute bottom-0 left-[1px] size-[12px] rounded-full" style={{ background: SKIN }} />
          {holdsSlip && (
            <motion.span
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute -bottom-[14px] -left-[12px] grid h-[18px] min-w-[38px] place-items-center rounded-[3px] bg-white px-1 font-heading text-[9px] leading-none font-extrabold whitespace-nowrap text-brand shadow-md"
              style={{ rotate: phase === "announce" ? 180 : 0 }}
            >
              {phase === "announce" && ign ? ign.slice(0, 10) : "?"}
            </motion.span>
          )}
        </motion.div>
        <motion.div
          className="absolute top-[58px] left-[62px] h-[56px] w-[14px]"
          style={{ originX: 0.5, originY: 0.08 }}
          animate={{ rotate: rightArm }}
          transition={phase === "sold" ? { duration: 1.2, times: [0, 0.25, 0.45, 0.7, 0.9] } : { type: "spring", stiffness: 160, damping: 14 }}
        >
          <span className="absolute inset-x-0 top-0 h-[46px] rounded-full" style={{ background: SUIT }} />
          <span className="absolute bottom-0 left-[1px] size-[12px] rounded-full" style={{ background: SKIN }} />
          {/* gavel */}
          <svg viewBox="0 0 40 24" className="absolute -bottom-[10px] -left-[8px] w-[34px]" aria-hidden>
            <rect x="16" y="2" width="5" height="20" rx="2" fill="#7a4a21" transform="rotate(-90 18.5 12)" />
            <rect x="2" y="4" width="13" height="16" rx="3" fill="#5a3214" />
            <rect x="3" y="7" width="11" height="2" fill="#c08a4f" />
            <rect x="3" y="15" width="11" height="2" fill="#c08a4f" />
          </svg>
        </motion.div>
        {/* jacket + shirt + bow tie */}
        <svg viewBox="0 0 64 74" className="absolute top-[52px] left-[8px] w-[64px]" aria-hidden>
          <path d="M8 10 Q32 0 56 10 L60 70 Q32 76 4 70 Z" fill={SUIT} />
          <path d="M24 4 L32 34 L40 4 Z" fill="#f4f6fb" />
          <path d="M24 4 L32 34 L22 22 Z M40 4 L32 34 L42 22 Z" fill="#2b3447" />
          <path d="M26 7 L32 11 L38 7 L38 15 L32 11 L26 15 Z" fill="#e4002b" />
          <circle cx="32" cy="44" r="1.6" fill="#0b0d12" />
          <circle cx="32" cy="54" r="1.6" fill="#0b0d12" />
          <rect x="44" y="20" width="9" height="3" rx="1" fill="#fbbf24" />
        </svg>
        {/* head */}
        <svg viewBox="0 0 44 50" className="absolute top-[6px] left-[18px] w-[44px]" aria-hidden>
          <rect x="17" y="38" width="10" height="10" fill={SKIN} />
          <circle cx="4" cy="26" r="4" fill={SKIN} />
          <circle cx="40" cy="26" r="4" fill={SKIN} />
          <ellipse cx="22" cy="24" rx="17" ry="19" fill={SKIN} />
          <path d="M5 20 Q6 4 22 4 Q38 4 39 20 Q34 11 22 12 Q12 12 5 20 Z" fill="#1a1410" />
          <circle cx="15.5" cy="23" r="2" fill="#1a1410" />
          <circle cx="28.5" cy="23" r="2" fill="#1a1410" />
          <path d="M12 18 L19 17 M25 17 L32 18" stroke="#1a1410" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M13 32 Q22 28 31 32 Q27 34 22 32.5 Q17 34 13 32 Z" fill="#1a1410" />
          <path d={phase === "announce" || phase === "sold" ? "M16 35 Q22 41 28 35 Z" : "M17 35.5 Q22 38 27 35.5"} fill={phase === "announce" || phase === "sold" ? "#7a1f1f" : "none"} stroke="#7a1f1f" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
    </motion.div>
  );
}

function Bag({ digging, poolLeft }: { digging: boolean; poolLeft: number }) {
  return (
    <div className={cn("relative w-[60px] sm:w-[78px]", digging && "hall-wobble")}>
      <svg viewBox="0 0 80 84" className="w-full drop-shadow-[0_6px_6px_rgb(0_0_0/0.45)]" aria-hidden>
        <rect x="24" y="2" width="9" height="20" rx="1" fill="#fff" transform="rotate(-12 28 12)" />
        <rect x="36" y="0" width="9" height="20" rx="1" fill="#fef3c7" transform="rotate(6 40 10)" />
        <rect x="46" y="4" width="9" height="20" rx="1" fill="#fff" transform="rotate(16 50 14)" />
        <path d="M18 22 Q40 14 62 22 L58 28 Q40 22 22 28 Z" fill="#8a6a3f" />
        <path d="M22 27 Q40 21 58 27 Q76 44 70 66 Q66 82 40 82 Q14 82 10 66 Q4 44 22 27 Z" fill="#b48a55" />
        <path d="M22 27 Q40 21 58 27" stroke="#6b4f2c" strokeWidth="3" fill="none" />
        <path d="M16 46 Q40 54 64 46" stroke="#9c7746" strokeWidth="2" fill="none" />
        <text x="40" y="66" textAnchor="middle" fontSize="12" fontWeight="800" fill="#4a3519" fontFamily="var(--font-heading), sans-serif">
          WOW
        </text>
      </svg>
      <span className="absolute -right-3 top-6 rotate-6 rounded-[3px] bg-gold px-1 font-heading text-[10px] leading-4 font-extrabold text-brand shadow">{poolLeft} left</span>
    </div>
  );
}

function Lectern() {
  return (
    <svg viewBox="0 0 120 92" className="w-[118px] drop-shadow-[0_8px_10px_rgb(0_0_0/0.5)]" aria-hidden>
      <path d="M6 6 L114 6 L106 20 L14 20 Z" fill="#6b3d18" />
      <path d="M14 20 L106 20 L98 90 L22 90 Z" fill="#8a5426" />
      <path d="M30 20 L36 90 M90 20 L84 90" stroke="#6b3d18" strokeWidth="2" />
      <rect x="34" y="34" width="52" height="20" rx="3" fill="#0c1a3a" />
      <text x="60" y="48.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="var(--font-heading), sans-serif" fontStyle="italic">
        WOW<tspan fill="#e4002b">/</tspan>
      </text>
      <rect x="76" y="0" width="22" height="7" rx="2" fill="#4a2a10" />
    </svg>
  );
}

function Bubble({ children, tone = "light", side }: { children: React.ReactNode; tone?: "light" | "gold"; side: "left" | "right" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={cn(
        "relative rounded-2xl px-3.5 py-2 text-center whitespace-nowrap shadow-[0_8px_24px_rgb(0_0_0/0.35)]",
        tone === "gold" ? "bg-gold text-brand" : "bg-white text-brand",
      )}
    >
      {children}
      <span className={cn("absolute top-1/2 size-3 -translate-y-1/2 rotate-45", side === "left" ? "-right-1.5" : "-left-1.5", tone === "gold" ? "bg-gold" : "bg-white")} />
    </motion.div>
  );
}

function Desk({ team, leading, bid, bidKey, soldHere }: { team: HallTeam; leading: boolean; bid: number | null; bidKey: string | null; soldHere: boolean }) {
  const cover = team.covered != null && team.days > 0 ? team.covered / team.days : null;
  const up = leading || soldHere;
  return (
    <div className="relative flex flex-col items-center pt-8 sm:pt-10">
      {/* paddle: tucked behind the desk, raised for the leading bid */}
      <motion.div
        className="absolute top-0 z-0 flex flex-col items-center"
        initial={false}
        animate={{ y: up ? "-38%" : "125%", rotate: leading ? -7 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 17 }}
      >
        <div key={leading ? bidKey ?? "lead" : "rest"} className={cn("flex flex-col items-center", leading && "hall-pop")}>
          <span
            className={cn(
              "grid size-10 place-items-center rounded-full font-heading text-[11px] leading-none font-extrabold shadow-[0_6px_14px_rgb(0_0_0/0.45)] ring-2 sm:size-14 sm:text-sm",
              soldHere ? "ring-gold" : leading ? "ring-white" : "ring-black/25",
            )}
            style={{ background: team.color, color: team.ink }}
          >
            {soldHere ? "SOLD" : leading && bid != null ? credits(bid) : team.tag}
          </span>
          {up && <span className="h-6 w-1 rounded-b bg-[#5a3214]" />}
        </div>
      </motion.div>
      {/* captain, seen from behind */}
      <div className="relative z-[1] flex flex-col items-center">
        <span className="size-5 rounded-full bg-[#0a0f1d] ring-2 ring-black/30 sm:size-6" />
        <span className="-mt-0.5 h-3.5 w-11 rounded-t-[14px] sm:h-4 sm:w-16" style={{ background: team.color }} />
      </div>
      {/* desk */}
      <div
        className={cn("relative z-[2] w-full rounded-md border-t-4 bg-[#141b2d] px-1 py-1 text-center shadow-[0_-4px_14px_rgb(0_0_0/0.35)] ring-1 ring-white/10 sm:px-2", soldHere && "ring-2 ring-gold")}
        style={{ borderTopColor: team.color }}
      >
        <div className="truncate font-heading text-sm leading-tight font-extrabold tracking-wide uppercase">
          <span className="sm:hidden">{team.tag}</span>
          <span className="hidden sm:inline">{team.name}</span>
        </div>
        <div className="flex items-center justify-center gap-1 text-[10px] text-white/70 tabular sm:gap-1.5 sm:text-[11px]">
          <span title="Purse left" className="font-semibold text-white">
            {credits(team.left)}
          </span>
          <span className="text-white/30">·</span>
          <span title="Players bought">
            {team.bought}/{team.maxBuys}
          </span>
          <span className="hidden truncate text-white/45 lg:inline">· {team.captain}</span>
        </div>
        {cover != null && (
          <div
            className={cn("hidden truncate text-[10px] font-medium sm:block", cover === 1 ? "text-win" : cover >= 0.7 ? "text-gold" : "text-loss")}
            title={`Match days where at least ${team.need} of this squad said yes`}
          >
            {cover === 1 ? `Full ${team.need} every match day` : `Full ${team.need} on ${team.covered}/${team.days} days`}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The auction hall: an auctioneer on stage who walks to the bag, draws the next name and announces it,
 * with the captains' desks in front raising paddles as they bid.
 */
export function HallScene({ drawAt, now, ign, poolLeft, leaderId, bid, bidKey, result, teams, status, big, still }: Props) {
  const phase = still ? (result && result.kind === "sold" && now - result.at < SOLD_MS ? "sold" : "idle") : phaseOf(drawAt, now, result);
  const x = phase === "toBag" || phase === "dig" ? DIG_X : PODIUM_X;
  const side = x < 40 ? "right" : "left";
  const bubble =
    phase === "toBag" || phase === "dig" ? (
      <Bubble side={side}>
        <span className="font-heading text-sm font-bold tracking-wide uppercase">Let&apos;s see who&apos;s next…</span>
      </Bubble>
    ) : phase === "back" ? (
      <Bubble side={side}>
        <span className="font-heading text-sm font-bold tracking-wide uppercase">And the name is…</span>
      </Bubble>
    ) : phase === "announce" && ign ? (
      <Bubble tone="gold" side={side}>
        <span className="block font-heading text-[11px] font-bold tracking-widest uppercase opacity-70">Next up</span>
        <span className="block font-heading text-2xl leading-none font-extrabold uppercase sm:text-3xl">{ign}!</span>
      </Bubble>
    ) : phase === "sold" ? (
      <Bubble tone="gold" side={side}>
        <span className="font-heading text-xl font-extrabold uppercase">
          Sold{result?.teamId ? ` to ${teams.find((t) => t.id === result.teamId)?.tag ?? ""}` : ""}!
        </span>
      </Bubble>
    ) : status === "completed" ? (
      <Bubble side={side}>
        <span className="font-heading text-sm font-bold tracking-wide uppercase">That&apos;s a wrap!</span>
      </Bubble>
    ) : status === "setup" ? (
      <Bubble side={side}>
        <span className="font-heading text-sm font-bold tracking-wide uppercase">Starting soon</span>
      </Bubble>
    ) : null;

  return (
    <section
      aria-label="Auction hall"
      className={cn("dark relative isolate overflow-hidden rounded-2xl bg-[#0a1430] text-white shadow-xl select-none", big ? "h-[360px]" : "h-[300px] sm:h-[330px]")}
    >
      {/* back wall + backdrop */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_50%_0%,#1b2c63_0%,#0a1430_60%,#060b1c_100%)]" />
      <div aria-hidden className="absolute inset-x-[14%] top-[13%] -z-10 flex justify-center">
        <span className="font-heading text-[clamp(28px,7vw,84px)] leading-none font-extrabold tracking-tight text-white/[0.06] uppercase italic">Player auction</span>
      </div>
      {/* spotlight follows the auctioneer */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-0 -z-10 h-[78%] w-[46%] -translate-x-1/2"
        animate={{ left: `${x}%` }}
        transition={{ duration: still ? 0 : 1.4, ease: [0.45, 0, 0.25, 1] }}
        style={{
          background:
            "radial-gradient(42% 12% at 50% 93%, rgb(255 236 190 / 0.28), transparent 70%), conic-gradient(from 163deg at 50% 0%, transparent 0deg, rgb(255 240 200 / 0.1) 9deg, rgb(255 240 200 / 0.18) 17deg, rgb(255 240 200 / 0.1) 25deg, transparent 34deg)",
        }}
      />
      {/* stage floor */}
      <div aria-hidden className="absolute inset-x-0 top-[56%] -z-10 h-[24%] bg-[repeating-linear-gradient(90deg,#5b3418_0px,#5b3418_46px,#4d2c14_46px,#4d2c14_48px)]">
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/30" />
        <div className="absolute inset-x-0 bottom-0 h-2 bg-[#2a170a]" />
      </div>
      {/* curtains */}
      <div aria-hidden className="absolute inset-y-0 left-0 -z-0 w-[9%] bg-[repeating-linear-gradient(90deg,#7d0b1c_0px,#b3142c_9px,#7d0b1c_18px)] shadow-[8px_0_24px_rgb(0_0_0/0.5)] [clip-path:polygon(0_0,100%_0,70%_100%,0_100%)]" />
      <div aria-hidden className="absolute inset-y-0 right-0 -z-0 w-[9%] bg-[repeating-linear-gradient(90deg,#7d0b1c_0px,#b3142c_9px,#7d0b1c_18px)] shadow-[-8px_0_24px_rgb(0_0_0/0.5)] [clip-path:polygon(0_0,100%_0,100%_100%,30%_100%)]" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-6 bg-[radial-gradient(circle_at_50%_0%,#b3142c_0,#b3142c_14px,#7d0b1c_15px,transparent_16px)] bg-[length:32px_24px] bg-repeat-x" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-2 bg-gold/80" />

      {/* bag */}
      <div className="absolute top-[44%] -translate-x-1/2" style={{ left: `${BAG_X}%` }}>
        <Bag digging={phase === "dig"} poolLeft={poolLeft} />
      </div>

      {/* auctioneer (moves across the stage) */}
      <motion.div className="pointer-events-none absolute inset-x-0 top-[14%]" animate={{ x: `${x - PODIUM_X}%` }} transition={{ duration: still ? 0 : 1.4, ease: [0.45, 0, 0.25, 1] }} initial={false}>
        <div className="absolute -translate-x-1/2" style={{ left: `${PODIUM_X}%` }}>
          <div className={cn("origin-top", big ? "scale-[1.05]" : "scale-[0.82] sm:scale-90")}>
            <Auctioneer phase={phase} ign={ign} />
          </div>
          <div className={cn("absolute top-[2px]", side === "left" ? "right-[calc(100%-6px)]" : "left-[calc(100%-6px)]")}>
            <AnimatePresence mode="wait">{bubble && <motion.div key={phase + (ign ?? "")}>{bubble}</motion.div>}</AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* lectern in front of him */}
      <div className="absolute top-[41%] -translate-x-1/2" style={{ left: `${PODIUM_X}%` }}>
        <Lectern />
      </div>

      {/* captains' desks, facing the stage */}
      <div className="absolute inset-x-[3%] bottom-2 z-10 grid gap-1.5 sm:inset-x-[6%] sm:gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(teams.length, 1)}, minmax(0, 1fr))` }}>
        {teams.map((t) => (
          <Desk key={t.id} team={t} leading={leaderId === t.id && phase !== "sold"} bid={bid} bidKey={bidKey} soldHere={phase === "sold" && result?.teamId === t.id} />
        ))}
      </div>
    </section>
  );
}

const SHOW_KEY = "wow-stage-show";
/** Viewers can turn the auctioneer's walk off and keep just the desks and paddles. */
export const stageShow = {
  get(): boolean {
    try {
      return localStorage.getItem(SHOW_KEY) !== "off";
    } catch {
      return true;
    }
  },
  set(on: boolean) {
    try {
      localStorage.setItem(SHOW_KEY, on ? "on" : "off");
      window.dispatchEvent(new Event(SHOW_KEY));
    } catch {
      /* private mode */
    }
  },
  subscribe(cb: () => void) {
    window.addEventListener(SHOW_KEY, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(SHOW_KEY, cb);
      window.removeEventListener("storage", cb);
    };
  },
};
