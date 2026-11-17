"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { ArrowRight, Crown, Medal, Sparkle, Star, Trophy } from "@/components/icons";
import ShinyText from "@/components/reactbits/ShinyText";
import { cn } from "@/lib/utils";

const LightRays = dynamic(() => import("@/components/reactbits/LightRays"), { ssr: false });

export interface ShowTeam {
  id: string;
  name: string;
  tag: string;
  color: string;
  /** Text colour that reads on `color`. */
  ink: string;
}

export interface ShowPlayer {
  id: string;
  ign: string;
  photo: string | null;
  kills: number;
  games: number;
}

export interface ChampionsShowcaseProps {
  seasonName: string;
  seasonNumber: number;
  champion: ShowTeam;
  runnerUp: ShowTeam | null;
  championSquad: ShowPlayer[];
  runnerUpSquad: ShowPlayer[];
  /** How the title was won, e.g. "Beat Bad Bunties 2–1 in the Final". */
  how: string;
  finalHref: string | null;
  finalStar: { id: string; ign: string; kills: number } | null;
}

const GOLD = "#fbbf24";

/** Deterministic 0..1 noise, so pieces render the same on the server and the client. */
function rand(seed: number, i: number, k: number) {
  const v = Math.sin((i + 1) * 12.9898 + k * 78.233 + seed) * 43758.5453;
  return v - Math.floor(v);
}
/** Short decimals: browsers normalise long ones in inline styles, which would break hydration. */
const r2 = (n: number) => Math.round(n * 100) / 100;
const hash = (s: string) => s.split("").reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 100003, 7);

function Avatar({ p, team, className }: { p: ShowPlayer; team: ShowTeam; className?: string }) {
  if (p.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.photo} alt={p.ign} className={cn("shrink-0 object-cover", className)} />;
  }
  return (
    <span className={cn("grid shrink-0 place-items-center font-heading leading-none font-extrabold italic", className)} style={{ background: team.color, color: team.ink }} aria-hidden>
      {p.ign.slice(0, 2).toUpperCase()}
    </span>
  );
}

/** A season's champions on a navy stage: gold rays, a floating trophy, confetti and the whole squad; the runners-up underneath. */
export function ChampionsShowcase({ seasonName, seasonNumber, champion, runnerUp, championSquad, runnerUpSquad, how, finalHref, finalStar }: ChampionsShowcaseProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [burst, setBurst] = useState<{ n: number; h: number } | null>(null);
  const seed = hash(champion.id);
  const fire = () => {
    if (reduce) return;
    setBurst((b) => ({ n: (b?.n ?? 0) + 1, h: ref.current?.offsetHeight ?? 800 }));
  };

  // Slow ticker tape that keeps falling behind everything.
  const tape = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        i,
        left: r2(rand(seed, i, 1) * 100),
        dur: r2(9 + rand(seed, i, 2) * 9),
        delay: r2(-rand(seed, i, 3) * 18),
        drift: Math.round((rand(seed, i, 4) - 0.5) * 160),
        spin: Math.round(360 + rand(seed, i, 5) * 720),
        w: Math.round(4 + rand(seed, i, 6) * 5),
        c: [GOLD, "#ffffff", champion.color, GOLD, "#ffe9a8"][i % 5],
        o: r2(0.3 + rand(seed, i, 7) * 0.45),
      })),
    [seed, champion.color],
  );

  // A full confetti shower when the section first comes into view, and on "Celebrate".
  const pieces = useMemo(() => {
    if (!burst) return [];
    const s = seed + burst.n * 977;
    return Array.from({ length: 110 }, (_, i) => ({
      i,
      left: rand(s, i, 1) * 100,
      x: (rand(s, i, 2) - 0.5) * 260,
      r: (rand(s, i, 3) - 0.5) * 1440,
      d: 2.2 + rand(s, i, 4) * 1.8,
      delay: rand(s, i, 5) * 0.5,
      w: 6 + rand(s, i, 6) * 8,
      c: [GOLD, "#ffffff", champion.color, "#ff2d4b", "#ffe9a8", GOLD][i % 6],
    }));
  }, [burst, seed, champion.color]);

  const starId = finalStar?.id;
  const n = championSquad.length;
  const cols = n <= 4 ? "lg:grid-cols-4" : n === 5 ? "lg:grid-cols-5" : n === 6 || n === 9 ? "lg:grid-cols-3" : "lg:grid-cols-4";

  return (
    <motion.section
      ref={ref}
      className="dark relative isolate overflow-hidden rounded-2xl bg-brand text-white"
      onViewportEnter={() => {
        if (!burst) fire();
      }}
      viewport={{ once: true, amount: 0.35 }}
      aria-label={`${seasonName} champions: ${champion.name}`}
    >
      {/* Stage lighting */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(70% 90% at 80% 10%, color-mix(in oklab, ${champion.color} 55%, transparent), transparent 70%), radial-gradient(50% 70% at 0% 100%, rgb(251 191 36 / 0.16), transparent 70%)`,
        }}
      />
      {!reduce && (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-60">
          <LightRays raysOrigin="top-center" raysColor={GOLD} raysSpeed={0.6} lightSpread={1.1} rayLength={1.8} noiseAmount={0.04} distortion={0.03} />
        </div>
      )}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {tape.map((t) => (
          <span
            key={t.i}
            className="champ-tape absolute top-0 block rounded-[1px]"
            style={
              {
                left: `${t.left}%`,
                width: t.w,
                height: t.w * 2,
                background: t.c,
                opacity: t.o,
                "--dur": `${t.dur}s`,
                "--delay": `${t.delay}s`,
                "--drift": `${t.drift}px`,
                "--spin": `${t.spin}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      {burst && (
        <div key={burst.n} aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          {pieces.map((p) => (
            <motion.span
              key={p.i}
              className="absolute top-0 block rounded-[2px]"
              style={{ left: `${p.left}%`, width: p.w, height: p.w * 0.55, background: p.c }}
              initial={{ y: -30, x: 0, rotate: 0, opacity: 1 }}
              animate={{ y: burst.h + 30, x: [0, p.x * 0.6, p.x], rotate: p.r, opacity: [1, 1, 0.85, 0] }}
              transition={{ duration: p.d, delay: p.delay, ease: [0.25, 0.6, 0.4, 1] }}
            />
          ))}
        </div>
      )}

      {/* Title */}
      <div className="grid items-center gap-8 px-5 pt-8 pb-6 sm:px-10 sm:pt-10 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="honour-gold inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-heading text-xs font-bold tracking-widest whitespace-nowrap text-brand uppercase">
              <Crown weight="fill" className="size-3.5" /> Season {seasonNumber} champions
            </span>
            <span className="text-xs text-white/60">{seasonName}</span>
          </div>
          <h2 className="mt-4 font-heading text-5xl leading-[0.88] font-extrabold uppercase italic sm:text-7xl lg:text-8xl">
            <Link href={`/teams/${champion.id}`} className="block">
              <ShinyText text={champion.name} color="#ffffff" shineColor={GOLD} speed={3.2} delay={1.2} />
            </Link>
          </h2>
          <p className="mt-4 font-heading text-lg font-bold tracking-wide text-white/85 uppercase">{how}</p>
          {finalStar && (
            <Link
              href={`/players/${finalStar.id}`}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm ring-1 ring-white/15 transition-colors hover:bg-white/15"
            >
              <Star weight="fill" className="size-4 text-gold" />
              <span className="text-white/70">Star of the Final</span>
              <b className="font-heading text-base tracking-wide uppercase">{finalStar.ign}</b>
              <span className="text-white/70">· {finalStar.kills} kills</span>
            </Link>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={fire}
              className="inline-flex items-center gap-1.5 rounded-md bg-gold px-3.5 py-2 font-heading text-sm font-bold tracking-wide text-brand uppercase transition-transform hover:-translate-y-px active:scale-[0.97]"
            >
              <Sparkle weight="fill" className="size-4" /> Celebrate
            </button>
            {finalHref && (
              <Link href={finalHref} className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 font-heading text-sm font-bold tracking-wide uppercase ring-1 ring-white/30 transition-colors hover:bg-white/10">
                The Final <ArrowRight className="size-3.5" />
              </Link>
            )}
          </div>
        </div>

        {/* Trophy */}
        <div className="relative mx-auto grid size-40 place-items-center sm:size-64" aria-hidden>
          <div
            className="champ-spin absolute inset-[-30%] rounded-full opacity-40"
            style={{
              background: `repeating-conic-gradient(from 0deg, ${GOLD} 0deg 5deg, transparent 5deg 20deg)`,
              maskImage: "radial-gradient(circle, black 0%, transparent 62%)",
              WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 62%)",
            }}
          />
          <div className="absolute inset-6 rounded-full" style={{ background: `radial-gradient(circle, rgb(251 191 36 / 0.35), transparent 70%)` }} />
          <div className="champ-float relative flex flex-col items-center">
            <Trophy weight="fill" className="size-28 text-gold drop-shadow-[0_8px_30px_rgb(251_191_36/0.55)] sm:size-48" />
            <span
              className="-mt-2 rounded-md px-3 py-1 font-heading text-base sm:-mt-3 sm:text-xl leading-none font-extrabold tracking-wider italic shadow-[0_6px_18px_rgb(0_0_0/0.35)]"
              style={{ background: champion.color, color: champion.ink }}
            >
              {champion.tag}
            </span>
          </div>
        </div>
      </div>

      {/* Champion squad */}
      {championSquad.length > 0 && (
        <div className="border-t border-white/10 px-5 py-6 sm:px-10">
          <div className="mb-4 flex items-center gap-2 font-heading text-xs font-bold tracking-widest text-gold uppercase">
            <Crown weight="fill" className="size-3.5" /> The champions
          </div>
          <ul className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", cols)}>
            {championSquad.map((p, i) => (
              <motion.li
                key={p.id}
                initial={reduce ? false : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  href={`/players/${p.id}`}
                  className="group relative flex h-full flex-col items-center gap-2 rounded-xl bg-white/[0.06] p-3 text-center ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:ring-gold/60 sm:flex-row sm:gap-3 sm:p-2.5 sm:text-left"
                >
                  <span className="relative shrink-0">
                    <Avatar p={p} team={champion} className="size-14 rounded-lg text-xl ring-2 ring-gold ring-offset-2 ring-offset-brand transition-transform duration-300 group-hover:scale-105" />
                    <Crown weight="fill" className="absolute -top-2.5 -right-2 size-5 rotate-12 text-gold drop-shadow" />
                  </span>
                  <span className="w-full min-w-0 sm:w-auto">
                    <span className="block truncate font-heading text-lg leading-tight font-bold tracking-wide uppercase">{p.ign}</span>
                    <span className="block text-xs text-white/60 tabular">
                      {p.games ? `${p.kills} kills · ${p.games} games` : "Squad member"}
                    </span>
                    {p.id === starId && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-sm bg-gold px-1 font-heading text-[10px] font-bold tracking-wide whitespace-nowrap text-brand uppercase">
                        <Star weight="fill" className="size-2.5" /> Final star
                      </span>
                    )}
                  </span>
                </Link>
              </motion.li>
            ))}
          </ul>
        </div>
      )}

      {/* Runners-up */}
      {runnerUp && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 bg-black/25 px-5 py-5 sm:px-10">
          <div className="flex items-center gap-3">
            <span className="honour-silver inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-heading text-xs font-bold tracking-widest whitespace-nowrap text-brand uppercase">
              <Medal weight="fill" className="size-3.5" /> Runners-up
            </span>
            <Link href={`/teams/${runnerUp.id}`} className="flex items-center gap-2 font-heading text-xl font-bold uppercase transition-colors hover:text-white/80">
              <span className="rounded-[4px] px-1.5 text-xs leading-5" style={{ background: runnerUp.color, color: runnerUp.ink }}>
                {runnerUp.tag}
              </span>
              {runnerUp.name}
            </Link>
          </div>
          <ul className="flex flex-wrap gap-2">
            {runnerUpSquad.map((p) => (
              <li key={p.id}>
                <Link href={`/players/${p.id}`} className="flex items-center gap-2 rounded-full bg-white/[0.07] py-1 pr-3 pl-1 text-sm ring-1 ring-white/10 transition-colors hover:bg-white/15">
                  <Avatar p={p} team={runnerUp} className="size-7 rounded-full text-[11px] ring-1 ring-[#c3ccd9]" />
                  <span className="font-medium">{p.ign}</span>
                  {p.games > 0 && <span className="text-xs text-white/50 tabular">{p.kills}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.section>
  );
}
