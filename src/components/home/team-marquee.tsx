"use client";

import { useReducedMotion } from "motion/react";
import { ChickenIcon, CrosshairIcon } from "@/components/pubg-icons";
import ScrollVelocity from "@/components/reactbits/ScrollVelocity";
import { onColor } from "@/lib/team-colors";
import type { TeamLite } from "./hero-carousel";

/** Scroll-reactive band of team names: drifts on its own and speeds up as you scroll. */
export function TeamMarquee({ teams, words }: { teams: TeamLite[]; words: string[] }) {
  const reduce = useReducedMotion();
  if (teams.length === 0) return null;

  const teamRow = (
    <span className="flex items-center">
      {teams.map((t) => (
        <span key={t.id} className="inline-flex items-center gap-3 px-6">
          <span className="rounded-sm px-2 py-1 text-[0.55em] leading-none not-italic" style={{ background: t.color, color: onColor(t.color) }}>
            {t.tag}
          </span>
          {t.name}
          <CrosshairIcon className="ml-6 size-[0.6em] text-hot" />
        </span>
      ))}
    </span>
  );
  const wordRow = (
    <span className="flex items-center">
      {words.map((w) => (
        <span key={w} className="inline-flex items-center gap-6 px-6">
          {w}
          <ChickenIcon className="size-[0.7em] text-gold" />
        </span>
      ))}
    </span>
  );

  if (reduce) {
    return (
      <div className="full-bleed overflow-hidden border-y bg-card py-4 font-heading text-3xl font-extrabold uppercase italic">
        <div className="flex justify-center whitespace-nowrap">{teamRow}</div>
      </div>
    );
  }

  return (
    <div className="full-bleed overflow-hidden border-y bg-card py-3 select-none" aria-hidden>
      <ScrollVelocity
        texts={[teamRow, wordRow]}
        velocity={45}
        className="flex items-center"
        numCopies={4}
        scrollerClassName="font-heading text-4xl leading-tight font-extrabold tracking-normal uppercase italic drop-shadow-none sm:text-5xl md:text-6xl md:leading-tight"
        parallaxClassName="[&:nth-child(2)]:text-muted-foreground/45"
      />
    </div>
  );
}
