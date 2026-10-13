import Link from "next/link";
import { TeamLink, TeamLogo } from "@/components/team";
import { AWARDS, rankBy, type AwardKey, type PlayerAgg } from "@/lib/engine/players";
import { num } from "@/lib/format";
import { cn } from "@/lib/utils";

const value = (row: PlayerAgg, key: AwardKey) =>
  key === "avgKills" ? row.avgKills.toFixed(2) : key === "mvp" ? num(row.mvp, Number.isInteger(row.mvp) ? 0 : 1) : String(row[key]);

export function AwardCards({ rows, keys }: { rows: PlayerAgg[]; keys?: AwardKey[] }) {
  const awards = keys ? AWARDS.filter((a) => keys.includes(a.key)) : AWARDS;
  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2",
        awards.length === 3 ? "lg:grid-cols-3" : awards.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3 xl:grid-cols-5",
      )}
    >
      {awards.map((award) => {
        const ranked = rankBy(rows, award.key).filter((r) => r[award.key] > 0);
        const [leader, ...rest] = ranked;
        return (
          <div key={award.key} className="bg-card p-5">
            <div className="text-xs text-muted-foreground">{award.title}</div>
            {leader ? (
              <>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/players/${leader.player.id}`} className="block truncate font-heading text-3xl leading-none transition-colors hover:text-muted-foreground">
                      {leader.player.ign}
                    </Link>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <TeamLogo team={leader.team} size="xs" />
                      <span className="truncate">{leader.team?.name}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-medium tabular">{value(leader, award.key)}</div>
                    <div className="text-[11px] text-muted-foreground">{award.stat}</div>
                  </div>
                </div>
                {rest.length > 0 && (
                  <ol className="mt-4 space-y-1.5 border-t pt-3 text-sm">
                    {rest.slice(0, 2).map((r, i) => (
                      <li key={r.player.id} className="flex items-center gap-2 text-muted-foreground">
                        <span className="w-3 text-xs">{i + 2}</span>
                        <Link href={`/players/${r.player.id}`} className="flex-1 truncate transition-colors hover:text-foreground">
                          {r.player.ign}
                        </Link>
                        <span className="tabular">{value(r, award.key)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">{rows.length ? "Not recorded yet" : "No games yet"}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

const COLS: { key: AwardKey | "games"; label: string }[] = [
  { key: "games", label: "Games" },
  { key: "kills", label: "Kills" },
  { key: "revives", label: "Revives" },
  { key: "mvp", label: "MVP" },
  { key: "potm", label: "POTM" },
  { key: "avgKills", label: "K/G" },
];

export function PlayerTable({ rows, sortKey, sortHref }: { rows: PlayerAgg[]; sortKey: AwardKey; sortHref: (key: AwardKey) => string }) {
  const ranked = rankBy(rows, sortKey);
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-max text-sm tabular">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="w-10 py-3 pl-4 text-left font-normal">#</th>
            <th className="px-2 py-3 text-left font-normal">Player</th>
            <th className="px-2 py-3 text-left font-normal">Team</th>
            {COLS.map((c) => (
              <th key={c.key} className="px-2.5 py-3 text-right font-normal last:pr-4">
                {c.key === "games" ? (
                  c.label
                ) : (
                  <Link href={sortHref(c.key)} scroll={false} className={cn("transition-colors hover:text-foreground", sortKey === c.key && "text-foreground")}>
                    {c.label}
                    {sortKey === c.key && " ↓"}
                  </Link>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ranked.map((r, i) => (
            <tr key={r.player.id} className="border-b transition-colors last:border-0 hover:bg-accent/50">
              <td className="py-2.5 pl-4 text-muted-foreground">{i + 1}</td>
              <td className="px-2 py-2.5">
                <Link href={`/players/${r.player.id}`} className="font-medium transition-colors hover:text-muted-foreground">
                  {r.player.ign}
                </Link>
              </td>
              <td className="px-2 py-2.5">
                <TeamLink team={r.team} size="xs" short />
              </td>
              {COLS.map((c) => (
                <td key={c.key} className={cn("px-2.5 py-2.5 text-right text-muted-foreground last:pr-4", sortKey === c.key && "font-medium text-foreground")}>
                  {c.key === "games" ? r.games : value(r, c.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {sortKey === "avgKills" && (
        <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">Only players who played at least half of their team&apos;s games are ranked by average.</p>
      )}
    </div>
  );
}
