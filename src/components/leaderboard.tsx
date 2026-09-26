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
        "grid gap-4 sm:grid-cols-2",
        awards.length === 3 ? "lg:grid-cols-3" : awards.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3 xl:grid-cols-5",
      )}
    >
      {awards.map((award) => {
        const ranked = rankBy(rows, award.key).filter((r) => r[award.key] > 0);
        const [leader, ...rest] = ranked;
        return (
          <div key={award.key} className="rounded-xl border bg-card p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">{award.title}</div>
            {leader ? (
              <>
                <div className="mt-3 flex items-center gap-3">
                  <TeamLogo team={leader.team} size="md" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/players/${leader.player.id}`} className="block truncate font-heading text-lg font-bold hover:text-primary">
                      {leader.player.ign}
                    </Link>
                    <div className="truncate text-xs text-muted-foreground">{leader.team?.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-heading text-2xl font-bold tabular">{value(leader, award.key)}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">{award.stat}</div>
                  </div>
                </div>
                <ol className="mt-3 space-y-1 border-t pt-2 text-sm">
                  {rest.slice(0, 2).map((r, i) => (
                    <li key={r.player.id} className="flex items-center gap-2 text-muted-foreground">
                      <span className="w-4 text-xs">{i + 2}</span>
                      <Link href={`/players/${r.player.id}`} className="flex-1 truncate hover:text-foreground">
                        {r.player.ign}
                      </Link>
                      <span className="tabular">{value(r, award.key)}</span>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No games yet</p>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">{award.description}</p>
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
  const ranked = sortKey === "avgKills" ? rankBy(rows, "avgKills") : rankBy(rows, sortKey);
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-max text-sm tabular">
        <thead>
          <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-3 pr-2 pl-4 text-left font-medium">#</th>
            <th className="px-2 py-3 text-left font-medium">Player</th>
            <th className="px-2 py-3 text-left font-medium">Team</th>
            {COLS.map((c) => (
              <th key={c.key} className="px-2 py-3 text-center font-medium">
                {c.key === "games" ? (
                  c.label
                ) : (
                  <Link
                    href={sortHref(c.key)}
                    scroll={false}
                    className={cn("hover:text-foreground", sortKey === c.key && "text-primary")}
                  >
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
            <tr key={r.player.id} className="border-b last:border-0 hover:bg-accent/40">
              <td className="py-2.5 pr-2 pl-4 font-heading font-bold text-muted-foreground">{i + 1}</td>
              <td className="px-2 py-2.5">
                <Link href={`/players/${r.player.id}`} className="font-medium hover:text-primary">
                  {r.player.ign}
                </Link>
              </td>
              <td className="px-2 py-2.5">
                <TeamLink team={r.team} size="xs" short />
              </td>
              {COLS.map((c) => (
                <td key={c.key} className={cn("px-2 py-2.5 text-center text-muted-foreground", sortKey === c.key && "font-semibold text-foreground")}>
                  {c.key === "games" ? r.games : value(r, c.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {sortKey === "avgKills" && (
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">
          Only players who played at least half of their team&apos;s games are ranked by average.
        </p>
      )}
    </div>
  );
}
