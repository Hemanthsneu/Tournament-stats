import {
  BulletIcon,
  ChickenIcon,
  CrateIcon,
  CrosshairIcon,
  EnergyIcon,
  HelmetCrackedIcon,
  HelmetIcon,
  HitMarkerIcon,
  MedkitIcon,
  ParachuteIcon,
  ScopeIcon,
  SkullIcon,
  TargetIcon,
} from "@/components/pubg-icons";
import { TeamLink } from "@/components/team";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { StandingRow } from "@/lib/engine/league";
import { pct, signed } from "@/lib/format";
import { PLAYOFF_FORMATS, type PlayoffFormatSpec } from "@/lib/playoff-formats";
import { cn } from "@/lib/utils";

const COLUMNS: { key: string; label: string; hint: string; icon: React.ComponentType<{ className?: string }>; compact?: boolean }[] = [
  { key: "p", label: "P", hint: "Map games played", icon: ParachuteIcon, compact: true },
  { key: "w", label: "W", hint: "Won (chicken dinners)", icon: ChickenIcon, compact: true },
  { key: "l", label: "L", hint: "Lost", icon: SkullIcon, compact: true },
  { key: "nrr", label: "NRR", hint: "Net Round Rate = (rounds won − rounds lost) ÷ rounds played", icon: BulletIcon, compact: true },
  { key: "rw", label: "RW", hint: "Rounds won", icon: HelmetIcon },
  { key: "rl", label: "RL", hint: "Rounds lost", icon: HelmetCrackedIcon },
  { key: "rwp", label: "Win %", hint: "Round win % = rounds won ÷ rounds played", icon: TargetIcon },
  { key: "k", label: "K", hint: "Total kills", icon: CrosshairIcon },
  { key: "kc", label: "KC", hint: "Kills conceded (opponent kills)", icon: HitMarkerIcon },
  { key: "nkr", label: "NKR", hint: "Net Kill Rate = (kills − kills conceded) ÷ rounds played", icon: ScopeIcon },
  { key: "rev", label: "Rev", hint: "Total revives", icon: MedkitIcon },
  { key: "form", label: "Form", hint: "Last 5 results, most recent on the right", icon: EnergyIcon },
  { key: "pts", label: "Pts", hint: "Points", icon: CrateIcon, compact: true },
];

const tone = (n: number) => (n > 0 ? "text-win" : n < 0 ? "text-loss" : "text-muted-foreground");

function cell(row: StandingRow, key: string): React.ReactNode {
  switch (key) {
    case "p":
      return row.played;
    case "w":
      return row.won;
    case "l":
      return row.lost;
    case "pts":
      return <span className="font-heading text-lg font-bold text-foreground">{row.points}</span>;
    case "nrr":
      return <span className={tone(row.nrr)}>{signed(row.nrr)}</span>;
    case "rw":
      return row.roundsWon;
    case "rl":
      return row.roundsLost;
    case "rwp":
      return pct(row.roundWinPct);
    case "k":
      return row.kills;
    case "kc":
      return row.killsConceded;
    case "nkr":
      return <span className={tone(row.nkr)}>{signed(row.nkr)}</span>;
    case "rev":
      return row.revives;
    case "form":
      return <Form results={row.form} />;
  }
}

export function Form({ results }: { results: ("W" | "L")[] }) {
  if (results.length === 0) return <span className="text-muted-foreground">–</span>;
  return (
    <span className="inline-flex gap-0.5" aria-label={`Form: ${results.join(" ")}`}>
      {results.map((r, i) => (
        <span
          key={i}
          className={cn("grid size-[18px] place-items-center rounded-[4px] text-[10px] font-semibold", r === "W" ? "bg-win-soft text-win" : "bg-loss-soft text-loss")}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

export function StandingsTable({
  rows,
  compact = false,
  playoffLines = false,
  format = PLAYOFF_FORMATS.ipl4,
  movement,
}: {
  rows: StandingRow[];
  compact?: boolean;
  /** Mark the playoff places and show Q/E (official league table). */
  playoffLines?: boolean;
  /** The season's playoff format: how many qualify and who gets a head start. */
  format?: PlayoffFormatSpec;
  /** Places gained (+) / lost (−) since the previous matchday. */
  movement?: Map<string, number>;
}) {
  const cols = compact ? COLUMNS.filter((c) => c.compact) : COLUMNS;
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-max text-sm tabular">
        <thead>
          <tr className="border-b bg-muted/50 font-heading text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
            <th className={cn("sticky left-0 z-10 bg-muted py-3 pl-4 text-left font-semibold", movement ? "w-[4.5rem]" : "w-12")}>#</th>
            <th className={cn("sticky z-10 bg-muted px-2 py-3 text-left font-semibold", movement ? "left-[4.5rem]" : "left-12")}>Team</th>
            {cols.map((c) => (
              <th key={c.key} className={cn("px-2.5 py-3 text-right font-semibold", c.key === "form" && "text-left", c.key === "pts" && "pr-4 text-foreground")}>
                <Tooltip>
                  <TooltipTrigger className={cn("inline-flex cursor-help flex-col items-center gap-0.5", c.key === "form" ? "items-start" : "items-end")}>
                    <c.icon className={cn("size-4", c.key === "pts" ? "text-hot" : "text-foreground/70")} />
                    <span>{c.label}</span>
                  </TooltipTrigger>
                  <TooltipContent>{c.hint}</TooltipContent>
                </Tooltip>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const lines = playoffLines && format.qualify > 0;
            const top2 = lines && !!format.edge && row.position <= format.edge.places;
            const top4 = lines && row.position <= format.qualify;
            return (
              <tr
                key={row.team.id}
                className={cn(
                  "border-b transition-colors last:border-0 hover:bg-accent/50",
                  lines && row.position === format.qualify && rows.length > format.qualify && "border-b-2 border-b-hot",
                )}
              >
                <td className="sticky left-0 z-10 bg-card py-3 pl-4">
                  <span
                    className={cn(
                      "inline-grid size-6 place-items-center rounded-[5px] align-middle font-heading text-sm font-bold",
                      top2 ? "bg-brand text-white" : top4 ? "bg-info-soft text-info" : "text-muted-foreground",
                    )}
                  >
                    {row.position}
                  </span>
                  {movement && (
                    <span className="ml-1.5 align-middle text-[11px] font-semibold">
                      <Move delta={movement.get(row.team.id) ?? 0} />
                    </span>
                  )}
                </td>

                <td className={cn("sticky z-10 max-w-52 bg-card px-2 py-3", movement ? "left-[4.5rem]" : "left-12")}>
                  <div className="flex items-center gap-2">
                    <TeamLink team={row.team} short={compact} />
                    {row.mark && <MarkBadge mark={row.mark} />}
                  </div>
                </td>
                {cols.map((c) => (
                  <td key={c.key} className={cn("px-2.5 py-3 text-right text-muted-foreground", c.key === "form" && "text-left", c.key === "pts" && "pr-4")}>
                    {cell(row, c.key)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Move({ delta }: { delta: number }) {
  if (delta > 0) return <span className="text-win">▲{delta}</span>;
  if (delta < 0) return <span className="text-loss">▼{-delta}</span>;
  return <span className="text-muted-foreground/50">–</span>;
}

function MarkBadge({ mark }: { mark: "Q" | "E" }) {
  return (
    <Tooltip>
      <TooltipTrigger
        className={cn(
          "shrink-0 cursor-help rounded-[4px] px-1 text-[10px] leading-4 font-semibold",
          mark === "Q" ? "bg-win-soft text-win" : "bg-loss-soft text-loss",
        )}
      >
        {mark}
      </TooltipTrigger>
      <TooltipContent>{mark === "Q" ? "Qualified for the playoffs" : "Eliminated"}</TooltipContent>
    </Tooltip>
  );
}

export function StandingsLegend({ playoffLines, format = PLAYOFF_FORMATS.ipl4 }: { playoffLines?: boolean; format?: PlayoffFormatSpec }) {
  return (
    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
      {playoffLines && format.qualify > 0 && (
        <>
          {format.edge && (
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-sm bg-brand" /> {format.edge.label}
            </span>
          )}
          {format.restLabel && (
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-sm bg-info-soft ring-1 ring-info/30" /> {format.restLabel}
            </span>
          )}
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 bg-hot" /> Playoff line
          </span>
        </>
      )}
      <span>
        <span className="text-foreground">NRR</span> (RW − RL) ÷ rounds
      </span>
      <span>
        <span className="text-foreground">NKR</span> (K − KC) ÷ rounds
      </span>
    </div>
  );
}
