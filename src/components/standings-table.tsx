import { TeamLink } from "@/components/team";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { StandingRow } from "@/lib/engine/league";
import { pct, signed } from "@/lib/format";
import { cn } from "@/lib/utils";

const COLUMNS: { key: string; label: string; hint: string; compact?: boolean }[] = [
  { key: "p", label: "P", hint: "Map games played", compact: true },
  { key: "w", label: "W", hint: "Won", compact: true },
  { key: "l", label: "L", hint: "Lost", compact: true },
  { key: "pts", label: "Pts", hint: "Points", compact: true },
  { key: "nrr", label: "NRR", hint: "Net Round Rate = (rounds won − rounds lost) ÷ rounds played", compact: true },
  { key: "rw", label: "RW", hint: "Rounds won" },
  { key: "rl", label: "RL", hint: "Rounds lost" },
  { key: "rwp", label: "Win %", hint: "Round win % = rounds won ÷ rounds played" },
  { key: "k", label: "K", hint: "Total kills" },
  { key: "kc", label: "KC", hint: "Kills conceded (opponent kills)" },
  { key: "nkr", label: "NKR", hint: "Net Kill Rate = (kills − kills conceded) ÷ rounds played" },
  { key: "rev", label: "Rev", hint: "Total revives" },
  { key: "form", label: "Form", hint: "Last 5 results, most recent on the right" },
];

function cell(row: StandingRow, key: string): React.ReactNode {
  switch (key) {
    case "p":
      return row.played;
    case "w":
      return row.won;
    case "l":
      return row.lost;
    case "pts":
      return <span className="font-bold text-foreground">{row.points}</span>;
    case "nrr":
      return <span className={metricTone(row.nrr)}>{signed(row.nrr)}</span>;
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
      return <span className={metricTone(row.nkr)}>{signed(row.nkr)}</span>;
    case "rev":
      return row.revives;
    case "form":
      return <Form results={row.form} />;
  }
}

const metricTone = (n: number) => (n > 0 ? "text-win" : n < 0 ? "text-loss" : "");

export function Form({ results }: { results: ("W" | "L")[] }) {
  if (results.length === 0) return <span className="text-muted-foreground">–</span>;
  return (
    <span className="inline-flex gap-1">
      {results.map((r, i) => (
        <span
          key={i}
          className={cn(
            "grid size-5 place-items-center rounded text-[10px] font-bold",
            r === "W" ? "bg-win/20 text-win" : "bg-loss/20 text-loss",
          )}
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
}: {
  rows: StandingRow[];
  compact?: boolean;
  /** Highlight top 2 / top 4 and show Q/E marks (official league table). */
  playoffLines?: boolean;
}) {
  const cols = compact ? COLUMNS.filter((c) => c.compact) : COLUMNS;
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-max text-sm tabular">
        <thead>
          <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
            <th className="sticky left-0 z-10 bg-card py-3 pr-2 pl-4 text-left font-medium">#</th>
            <th className="sticky left-10 z-10 bg-card px-2 py-3 text-left font-medium">Team</th>
            {cols.map((c) => (
              <th key={c.key} className="px-2 py-3 text-center font-medium">
                <Tooltip>
                  <TooltipTrigger className="cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-4">
                    {c.label}
                  </TooltipTrigger>
                  <TooltipContent>{c.hint}</TooltipContent>
                </Tooltip>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const top2 = playoffLines && row.position <= 2;
            const top4 = playoffLines && row.position <= 4;
            return (
              <tr
                key={row.team.id}
                className={cn(
                  "border-b last:border-0 hover:bg-accent/40",
                  playoffLines && row.position === 4 && rows.length > 4 && "border-b-2 border-b-primary/40",
                )}
              >
                <td
                  className={cn(
                    "sticky left-0 z-10 w-10 bg-card py-3 pr-2 pl-4 font-heading font-bold",
                    top2 ? "text-primary" : top4 ? "text-sky-300" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 w-1",
                      top2 ? "bg-primary" : top4 ? "bg-sky-400/70" : "bg-transparent",
                    )}
                  />
                  {row.position}
                </td>
                <td className="sticky left-10 z-10 max-w-48 bg-card px-2 py-3">
                  <div className="flex items-center gap-2">
                    <TeamLink team={row.team} short={compact} />
                    {row.mark === "Q" && <MarkBadge mark="Q" />}
                    {row.mark === "E" && <MarkBadge mark="E" />}
                  </div>
                </td>
                {cols.map((c) => (
                  <td key={c.key} className="px-2 py-3 text-center text-muted-foreground">
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

function MarkBadge({ mark }: { mark: "Q" | "E" }) {
  return (
    <Tooltip>
      <TooltipTrigger
        className={cn(
          "grid size-5 shrink-0 cursor-help place-items-center rounded text-[10px] font-bold",
          mark === "Q" ? "bg-win/20 text-win" : "bg-loss/20 text-loss",
        )}
      >
        {mark}
      </TooltipTrigger>
      <TooltipContent>{mark === "Q" ? "Qualified for the playoffs" : "Eliminated"}</TooltipContent>
    </Tooltip>
  );
}

export function StandingsLegend({ playoffLines }: { playoffLines?: boolean }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
      {playoffLines && (
        <>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-1 rounded bg-primary" /> Top 2: Qualifier 1 (two chances to reach the Final)
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-1 rounded bg-sky-400/70" /> 3rd–4th: Eliminator
          </span>
        </>
      )}
      <span>
        <b className="text-foreground">NRR</b> = (RW − RL) ÷ rounds played
      </span>
      <span>
        <b className="text-foreground">NKR</b> = (Kills − Kills conceded) ÷ rounds played
      </span>
    </div>
  );
}
