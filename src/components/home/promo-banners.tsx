"use client";

import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import { ChickenIcon, CrateIcon, PanIcon, ParachuteIcon } from "@/components/pubg-icons";
import ShinyText from "@/components/reactbits/ShinyText";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import StarBorder from "@/components/reactbits/StarBorder";
import { cn } from "@/lib/utils";

export type Promo = {
  id: string;
  eyebrow: string;
  title: string;
  text: string;
  href: string;
  cta: string;
  tone: "navy" | "hot" | "gold";
  icon: "crate" | "parachute" | "pan" | "chicken";
  live?: boolean;
};

const ICONS = { crate: CrateIcon, parachute: ParachuteIcon, pan: PanIcon, chicken: ChickenIcon };

const TONES = {
  navy: { surface: "#0c1a3a", glow: "#7aa2ff", text: "text-white", sub: "text-white/70" },
  hot: { surface: "#c8102e", glow: "#ffd1d8", text: "text-white", sub: "text-white/80" },
  gold: { surface: "#f2b705", glow: "#ffffff", text: "text-brand", sub: "text-brand/75" },
} as const;

/** Big clickable banners under the hero: the auction, availability, Hall of Fame. */
export function PromoBanners({ promos }: { promos: Promo[] }) {
  if (promos.length === 0) return null;
  return (
    <div className={cn("grid gap-4", promos.length > 2 ? "lg:grid-cols-[1.5fr_1fr_1fr]" : promos.length === 2 ? "lg:grid-cols-[1.5fr_1fr]" : "")}>
      {promos.map((p, i) => {
        const tone = TONES[p.tone];
        const Icon = ICONS[p.icon];
        const featured = i === 0;
        return (
          <SpotlightCard
            key={p.id}
            theme="dark"
            spotlightColor={tone.glow}
            intensity={0.22}
            spotlightSize={featured ? 420 : 300}
            className={cn("group flex min-h-56 flex-col rounded-xl p-6", tone.text, featured && "sm:p-8")}
            style={{ "--spotlight-card-surface": tone.surface, "--spotlight-card-shadow": "none" } as React.CSSProperties}
          >
            <Icon className={cn("pointer-events-none absolute -right-6 -bottom-6 opacity-15 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110", featured ? "size-56" : "size-40")} />
            <div className="relative z-[2] flex flex-1 flex-col">
              <span className="inline-flex items-center gap-2 font-heading text-xs font-bold tracking-widest uppercase">
                {p.live && <span className="size-2 animate-pulse rounded-full bg-hot ring-2 ring-white/40" />}
                {p.eyebrow}
              </span>
              <h3 className={cn("mt-3 font-heading leading-[0.95] font-extrabold uppercase italic", featured ? "text-4xl sm:text-5xl" : "text-3xl")}>
                {featured ? <ShinyText text={p.title} color="currentColor" shineColor={p.tone === "gold" ? "#ffffff" : "#ffd84d"} speed={3} delay={1.5} /> : p.title}
              </h3>
              <p className={cn("mt-3 max-w-md text-sm", tone.sub)}>{p.text}</p>
              <div className="mt-auto pt-6">
                {featured ? (
                  <StarBorder
                    as={Link}
                    href={p.href}
                    color={p.tone === "navy" ? "#ff2d4b" : "#ffffff"}
                    radius={6}
                    thickness={1.5}
                    duration={3.5}
                    backgroundColor="#ffffff"
                    textColor="#0c1a3a"
                    className="px-5 py-2.5 font-heading text-lg font-bold tracking-wide uppercase"
                  >
                    {p.cta} <ArrowRight className="size-4" />
                  </StarBorder>
                ) : (
                  <Link
                    href={p.href}
                    className={cn(
                      "inline-flex h-10 items-center gap-1.5 rounded-md px-4 font-heading text-base font-bold tracking-wide uppercase ring-1 transition active:scale-[0.98]",
                      p.tone === "gold" ? "ring-brand/30 hover:bg-brand/10" : "ring-white/40 hover:bg-white/15",
                    )}
                  >
                    {p.cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )}
              </div>
            </div>
          </SpotlightCard>
        );
      })}
    </div>
  );
}
