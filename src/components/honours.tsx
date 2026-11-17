import Link from "next/link";
import { Crown, Medal } from "@/components/icons";
import type { PlayerHonour } from "@/lib/engine/honours";
import { cn } from "@/lib/utils";

/** "S2 Champion" (gold, shimmering) and "S1 Runner-up" (silver) tags, each linking to that season. */
export function HonourTags({ honours, size = "sm", className }: { honours: PlayerHonour[] | undefined; size?: "sm" | "md"; className?: string }) {
  if (!honours?.length) return null;
  return (
    <span className={cn("flex flex-wrap gap-1.5", className)}>
      {honours.map((h) => {
        const champ = h.kind === "champion";
        const Icon = champ ? Crown : Medal;
        return (
          <Link
            key={`${h.season.id}:${h.kind}`}
            href={`/s/${h.season.number}`}
            title={`${h.season.name}: ${champ ? "champion" : "runner-up"} with ${h.team.name}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-sm font-heading font-bold tracking-wide whitespace-nowrap text-brand uppercase shadow-[inset_0_0_0_1px_rgb(255_255_255/0.35)] transition-transform hover:-translate-y-px",
              champ ? "honour-gold" : "honour-silver",
              size === "md" ? "px-2 py-1 text-xs" : "px-1.5 py-px text-[10px]",
            )}
          >
            <Icon weight="fill" className={size === "md" ? "size-3.5" : "size-3"} />S{h.season.number} {champ ? "Champion" : "Runner-up"}
          </Link>
        );
      })}
    </span>
  );
}
