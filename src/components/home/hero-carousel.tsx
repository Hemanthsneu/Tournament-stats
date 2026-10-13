"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "@/components/icons";
import { ChickenIcon, CrosshairIcon } from "@/components/pubg-icons";
import BlurText from "@/components/reactbits/BlurText";
import CountUp from "@/components/reactbits/CountUp";
import RotatingText from "@/components/reactbits/RotatingText";
import { onColor } from "@/lib/team-colors";
import { cn } from "@/lib/utils";

// WebGL background: client only, loaded after the page.
const LightRays = dynamic(() => import("@/components/reactbits/LightRays"), { ssr: false });

export type TeamLite = { id: string; name: string; tag: string; color: string };

export type HeroSlide =
  | {
      kind: "season";
      id: string;
      eyebrow: string;
      live?: boolean;
      title: string;
      meta: string;
      stats: { label: string; value: number }[];
      ctas: { label: string; href: string; primary?: boolean }[];
    }
  | {
      kind: "match";
      id: string;
      eyebrow: string;
      href: string;
      label: string;
      a: TeamLite | null;
      b: TeamLite | null;
      ra: number | null;
      rb: number | null;
      winnerId: string | null;
      scheduledAt: string | null;
      when: string | null;
      map: string | null;
    }
  | {
      kind: "player";
      id: string;
      eyebrow: string;
      href: string;
      ign: string;
      team: TeamLite | null;
      photo: string | null;
      stats: { label: string; value: number; decimals?: number }[];
    }
  | { kind: "banner"; id: string; eyebrow: string; title: string; text: string; href: string; cta: string; live?: boolean; tone?: "hot" | "gold"; team?: TeamLite };

const AUTOPLAY_MS = 7000;

function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  if (now === null) return <span className="opacity-0">00</span>;
  const ms = Date.parse(to) - now;
  if (ms <= 0) return <span>Starting now</span>;
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const cells = [...(d ? [[d, "d"]] : []), [h, "h"], [m, "m"], [s, "s"]] as [number, string][];
  return (
    <span className="inline-flex gap-2">
      {cells.map(([v, u]) => (
        <span key={u} className="min-w-14 rounded-md bg-white/10 px-2 py-1.5 text-center ring-1 ring-white/10">
          <span className="font-heading text-3xl leading-none font-bold tabular">{String(v).padStart(2, "0")}</span>
          <span className="ml-0.5 text-xs text-white/60 uppercase">{u}</span>
        </span>
      ))}
    </span>
  );
}

function TeamBlock({ team, dim, align }: { team: TeamLite | null; dim?: boolean; align: "left" | "right" }) {
  const color = team?.color ?? "#3a4560";
  return (
    <div className={cn("flex min-w-0 flex-col justify-center gap-1 px-4 py-5 sm:px-5 sm:py-8", align === "right" ? "items-end text-right" : "items-start")} style={{ background: color, color: onColor(color) }}>
      <span className={cn("font-heading text-5xl leading-none font-extrabold italic sm:text-7xl", dim && "opacity-55")}>{team?.tag ?? "TBD"}</span>
      <span className="line-clamp-1 font-heading text-sm font-semibold tracking-wide uppercase opacity-90">{team?.name ?? "To be decided"}</span>
    </div>
  );
}

function Eyebrow({ children, live, tone = "hot" }: { children: React.ReactNode; live?: boolean; tone?: "hot" | "gold" }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-sm px-2 py-1 font-heading text-xs font-bold tracking-widest uppercase", tone === "gold" ? "bg-gold text-brand" : "bg-hot text-white")}>
      {live && <span className="size-1.5 animate-pulse rounded-full bg-white" />}
      {children}
    </span>
  );
}

function SlideBody({ slide, visit }: { slide: HeroSlide; visit: number }) {
  if (slide.kind === "season") {
    return (
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
        <div>
          <Eyebrow live={slide.live}>{slide.eyebrow}</Eyebrow>
          <BlurText
            key={`t${visit}`}
            text={slide.title}
            delay={70}
            animateBy="words"
            direction="top"
            className="mt-4 font-heading text-5xl leading-[0.95] font-bold uppercase sm:text-7xl"
          />
          <div className="mt-4 flex flex-wrap items-center gap-2 font-heading text-2xl font-bold uppercase sm:text-3xl">
            <span className="text-white/80">Every round:</span>
            <RotatingText
              texts={["clutch it", "frag out", "revive", "chicken dinner"]}
              mainClassName="overflow-hidden rounded-md bg-hot px-2.5 py-0.5 text-white"
              staggerFrom="last"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-120%" }}
              staggerDuration={0.02}
              splitLevelClassName="overflow-hidden pb-0.5"
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
              rotationInterval={2200}
            />
          </div>
          <p className="mt-4 max-w-xl text-sm text-white/70">{slide.meta}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {slide.ctas.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className={cn(
                  "inline-flex h-10 items-center gap-1.5 rounded-md px-4 font-heading text-base font-bold tracking-wide uppercase transition active:scale-[0.98]",
                  c.primary ? "bg-white text-brand hover:bg-white/90" : "text-white ring-1 ring-white/25 hover:bg-white/10",
                )}
              >
                {c.label} <ArrowRight className="size-4" />
              </Link>
            ))}
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-6 lg:grid-cols-1 lg:gap-5">
          {slide.stats.map((s) => (
            <div key={s.label} className="lg:text-right">
              <dd className="font-heading text-5xl leading-none font-bold tabular sm:text-6xl">
                <CountUp key={`c${visit}`} to={s.value} duration={1.4} />
              </dd>
              <dt className="mt-1 text-xs font-medium tracking-widest text-white/60 uppercase">{s.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  if (slide.kind === "match") {
    const done = slide.ra != null && slide.rb != null;
    return (
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_minmax(0,560px)]">
        <div>
          <Eyebrow>{slide.eyebrow}</Eyebrow>
          <h2 className="mt-4 font-heading text-4xl leading-[0.95] font-bold uppercase sm:text-6xl">
            {slide.a?.name ?? "TBD"} <span className="text-white/40">vs</span> {slide.b?.name ?? "TBD"}
          </h2>
          <p className="mt-3 text-sm text-white/70">
            {slide.label}
            {slide.when && ` · ${slide.when}`}
            {slide.map && ` · ${slide.map}`}
          </p>
          <div className="mt-5">
            {done ? (
              <span className="hidden font-heading text-xl font-bold tracking-wide text-white/80 uppercase sm:inline">Final · {Math.max(slide.ra!, slide.rb!)} rounds to {Math.min(slide.ra!, slide.rb!)}</span>
            ) : slide.scheduledAt ? (
              <Countdown to={slide.scheduledAt} />
            ) : (
              <span className="text-white/60">Time to be announced</span>
            )}
          </div>
          <Link href={slide.href} className="mt-6 inline-flex h-10 items-center gap-1.5 rounded-md bg-white px-4 font-heading text-base font-bold tracking-wide text-brand uppercase transition hover:bg-white/90 active:scale-[0.98]">
            Match centre <ArrowRight className="size-4" />
          </Link>
        </div>
        <Link href={slide.href} className="grid grid-cols-[1fr_auto_1fr] overflow-hidden rounded-xl ring-1 ring-white/15 transition hover:ring-white/40">
          <TeamBlock team={slide.a} align="left" dim={done ? slide.winnerId !== slide.a?.id : false} />
          <div className="flex min-w-24 flex-col items-center justify-center bg-brand-2 px-3 sm:min-w-28 sm:px-4">
            {done ? (
              <div className="font-heading text-5xl leading-none font-bold tabular sm:text-6xl">
                {slide.ra}
                <span className="mx-1 text-white/35">-</span>
                {slide.rb}
              </div>
            ) : (
              <div className="font-heading text-5xl font-extrabold text-white/80 italic">VS</div>
            )}
          </div>
          <TeamBlock team={slide.b} align="right" dim={done ? slide.winnerId !== slide.b?.id : false} />
        </Link>
      </div>
    );
  }

  if (slide.kind === "player") {
    const color = slide.team?.color ?? "#3a4560";
    return (
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
        <div>
          <Eyebrow tone="gold">{slide.eyebrow}</Eyebrow>
          <BlurText key={`p${visit}`} text={slide.ign} delay={60} animateBy="letters" className="mt-4 font-heading text-6xl leading-[0.9] font-extrabold uppercase italic sm:text-8xl" />
          {slide.team && <p className="mt-2 font-heading text-lg font-semibold tracking-wide text-white/80 uppercase">{slide.team.name}</p>}
          <dl className="mt-6 flex flex-wrap gap-8">
            {slide.stats.map((s) => (
              <div key={s.label}>
                <dd className="font-heading text-5xl leading-none font-bold tabular">
                  <CountUp key={`s${visit}`} to={s.value} duration={1.2} />
                </dd>
                <dt className="mt-1 text-xs font-medium tracking-widest text-white/60 uppercase">{s.label}</dt>
              </div>
            ))}
          </dl>
          <Link href={slide.href} className="mt-6 inline-flex h-10 items-center gap-1.5 rounded-md bg-white px-4 font-heading text-base font-bold tracking-wide text-brand uppercase transition hover:bg-white/90 active:scale-[0.98]">
            Player profile <ArrowRight className="size-4" />
          </Link>
        </div>
        <motion.div
          key={`tile${visit}`}
          initial={{ rotate: -6, scale: 0.9, opacity: 0 }}
          animate={{ rotate: -3, scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 160, damping: 16 }}
          className="relative hidden size-64 place-items-center overflow-hidden rounded-2xl shadow-2xl lg:grid"
          style={{ background: color, color: onColor(color) }}
        >
          {slide.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slide.photo} alt={slide.ign} className="size-full object-cover" />
          ) : (
            <span className="font-heading text-8xl font-extrabold italic">{slide.ign.slice(0, 2).toUpperCase()}</span>
          )}
          <CrosshairIcon className="absolute right-3 bottom-3 size-10 opacity-40" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
      <div className="max-w-3xl">
        <Eyebrow live={slide.live} tone={slide.tone}>
          {slide.eyebrow}
        </Eyebrow>
        <BlurText key={`b${visit}`} text={slide.title} delay={60} animateBy="words" className="mt-4 font-heading text-5xl leading-[0.95] font-bold uppercase sm:text-7xl" />
        <p className="mt-4 max-w-xl text-base text-white/75">{slide.text}</p>
        <Link href={slide.href} className="mt-6 inline-flex h-11 items-center gap-1.5 rounded-md bg-hot px-5 font-heading text-lg font-bold tracking-wide text-white uppercase transition hover:bg-hot/90 active:scale-[0.98]">
          {slide.cta} <ArrowRight className="size-4" />
        </Link>
      </div>
      {slide.team ? (
        <motion.div
          key={`team${visit}`}
          initial={{ rotate: 6, scale: 0.9, opacity: 0 }}
          animate={{ rotate: 3, scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 160, damping: 16 }}
          className="relative hidden size-64 place-items-center overflow-hidden rounded-2xl shadow-2xl lg:grid"
          style={{ background: slide.team.color, color: onColor(slide.team.color) }}
        >
          <span className="font-heading text-8xl font-extrabold italic">{slide.team.tag}</span>
          <ChickenIcon className="absolute right-3 bottom-3 size-12 opacity-40" />
        </motion.div>
      ) : (
        <ChickenIcon className="pointer-events-none hidden size-48 text-white/10 lg:block" />
      )}
    </div>
  );
}

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [visit, setVisit] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dir, setDir] = useState(1);

  const go = useCallback(
    (next: number, direction: number) => {
      setDir(direction);
      setIndex(((next % slides.length) + slides.length) % slides.length);
      setVisit((v) => v + 1);
    },
    [slides.length],
  );

  if (slides.length === 0) return null;
  const slide = slides[index];

  return (
    <section
      className="dark full-bleed relative -mt-8 overflow-hidden bg-brand text-white sm:-mt-10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      {!reduce && (
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <LightRays raysOrigin="top-center" raysColor="#ffffff" raysSpeed={0.8} lightSpread={0.9} rayLength={1.6} followMouse mouseInfluence={0.08} noiseAmount={0.05} distortion={0.04} />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-hot" />
      <div className="relative mx-auto max-w-7xl px-4 pt-10 pb-20 sm:px-6 sm:pt-14">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={slide.id}
            custom={dir}
            initial={reduce ? false : { opacity: 0, x: 60 * dir }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -60 * dir }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            drag={slides.length > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={(_, info) => {
              if (info.offset.x < -70) go(index + 1, 1);
              else if (info.offset.x > 70) go(index - 1, -1);
            }}
            className="relative min-h-[440px] cursor-grab active:cursor-grabbing sm:min-h-[360px]"
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${slides.length}`}
          >
            <SlideBody slide={slide} visit={visit} />
          </motion.div>
        </AnimatePresence>

        {slides.length > 1 && (
          <div className="absolute inset-x-4 bottom-6 flex items-center gap-3 sm:inset-x-6">
            <div className="flex flex-1 gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => go(i, i > index ? 1 : -1)}
                  className="group relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/15"
                  aria-label={`Go to slide ${i + 1}: ${s.eyebrow}`}
                  aria-current={i === index}
                >
                  {/* The active bar's animation is the autoplay timer: pausing it pauses both. */}
                  <span
                    key={i === index ? `on${visit}` : "off"}
                    className={cn("absolute inset-y-0 left-0 rounded-full bg-white", i < index && "w-full", i > index && "w-0", i === index && reduce && "w-full")}
                    style={i === index && !reduce ? { animation: `hero-progress ${AUTOPLAY_MS}ms linear forwards`, animationPlayState: paused ? "paused" : "running" } : undefined}
                    onAnimationEnd={i === index ? () => go(index + 1, 1) : undefined}
                  />
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => go(index - 1, -1)} className="grid size-9 place-items-center rounded-md ring-1 ring-white/20 transition hover:bg-white/10" aria-label="Previous slide">
                <ArrowRight className="size-4 rotate-180" />
              </button>
              <button type="button" onClick={() => go(index + 1, 1)} className="grid size-9 place-items-center rounded-md ring-1 ring-white/20 transition hover:bg-white/10" aria-label="Next slide">
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
