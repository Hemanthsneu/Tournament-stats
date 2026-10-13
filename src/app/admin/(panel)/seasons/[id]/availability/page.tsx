import Link from "next/link";
import { BadgeCheck } from "@/components/icons";
import { MatchDaysEditor } from "@/components/admin/match-days-editor";
import { Panel } from "@/components/admin/fields";
import { DATE_STATUS, dateScore, dateSummary, fmtDayMonth, fmtWeekday } from "@/lib/availability";
import { dateAnswers, loadCommunity, matchDaysFor, verifiedSet } from "@/lib/community";
import { loadLeague } from "@/lib/data";
import { filterGames } from "@/lib/engine/league";
import { dateKey } from "@/lib/time";
import { cn } from "@/lib/utils";
import { saveMatchDays } from "../../../../actions";

const TONE = { yes: "bg-win text-white", maybe: "bg-gold-soft text-gold", no: "bg-loss-soft text-loss" } as const;

export default async function SeasonAvailability({ params }: PageProps<"/admin/seasons/[id]/availability">) {
  const { id } = await params;
  const [{ idx }, community] = await Promise.all([loadLeague(true), loadCommunity()]);
  const season = idx.seasonById.get(id)!;
  const today = dateKey(new Date().toISOString());
  const matchDays = matchDaysFor(community, id);
  const days = matchDays.map((d) => d.day);
  const answers = dateAnswers(community, id);
  const verified = verifiedSet(community);
  const scheduleDays = [
    ...new Set(
      filterGames(idx, { seasonId: id, type: "official" })
        .map((g) => g.game.scheduled_at)
        .filter((x): x is string => !!x)
        .map(dateKey),
    ),
  ].sort();
  const answerCounts: Record<string, number> = {};
  for (const a of answers.values()) for (const d of Object.keys(a)) answerCounts[d] = (answerCounts[d] ?? 0) + 1;

  // Who to list: this season's auction pools and captains, rostered players, and anyone who answered.
  const auctionIds = new Set(community.auctions.filter((a) => a.season_id === id && !a.is_practice).map((a) => a.id));
  const ids = new Set<string>([
    ...community.auctionLots.filter((l) => auctionIds.has(l.auction_id)).map((l) => l.player_id),
    ...community.auctionTeams.filter((t) => auctionIds.has(t.auction_id) && t.captain_player_id).map((t) => t.captain_player_id!),
    ...idx.data.rosters.filter((r) => r.season_id === id).map((r) => r.player_id),
    ...answers.keys(),
  ]);
  if (ids.size === 0) for (const a of community.accounts) ids.add(a.player_id);
  const rows = [...ids]
    .map((pid) => ({ player: idx.playerById.get(pid), a: answers.get(pid) ?? {} }))
    .filter((r) => r.player)
    .map((r) => ({ ...r, s: dateSummary(days, r.a) }))
    .sort((x, y) => Number(x.s.unanswered === x.s.total) - Number(y.s.unanswered === y.s.total) || dateScore(y.s) - dateScore(x.s) || x.player!.ign.localeCompare(y.player!.ign));
  const answered = rows.filter((r) => r.s.unanswered < r.s.total).length;
  const perDay = days.map((d) => ({ d, yes: rows.filter((r) => r.a[d] === "yes").length, maybe: rows.filter((r) => r.a[d] === "maybe").length }));
  const bestYes = Math.max(0, ...perDay.map((p) => p.yes));

  return (
    <div className="space-y-6">
      <Panel
        title="Match days"
        description={
          <>
            Pick the dates {season.name} will be played on. Players answer each date on their profile page (available, maybe, can&apos;t play), and captains see the
            answers on every player&apos;s auction card. The schedule&apos;s &quot;Set dates &amp; times&quot; can then use only these dates.
          </>
        }
      >
        <MatchDaysEditor
          action={saveMatchDays.bind(null, id)}
          initial={matchDays.map((d) => ({ day: d.day, label: d.label }))}
          scheduleDays={scheduleDays}
          answerCounts={answerCounts}
          today={today}
        />
      </Panel>

      <Panel
        title="Who can play when"
        description={days.length ? `${answered} of ${rows.length} players have answered. Sorted by how many match days they can make.` : "Add match days first."}
      >
        {days.length > 0 && rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-max text-sm tabular">
              <thead className="bg-muted/60">
                <tr className="font-heading text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  <th className="sticky left-0 z-10 bg-muted px-3 py-2 text-left">Player</th>
                  <th className="px-2 py-2 text-center">Can make</th>
                  {days.map((d) => (
                    <th key={d} className="px-1 py-2 text-center" title={matchDays.find((m) => m.day === d)?.label ?? undefined}>
                      <div>{fmtWeekday(d)}</div>
                      <div className="text-xs text-foreground">{fmtDayMonth(d)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ player, a, s }) => (
                  <tr key={player!.id} className="border-t">
                    <td className="sticky left-0 z-10 bg-card px-3 py-1.5 whitespace-nowrap">
                      <Link href={`/players/${player!.id}`} className="font-medium hover:text-hot">
                        {player!.ign}
                      </Link>
                      {verified.has(player!.id) && <BadgeCheck className="ml-1 inline size-3.5 text-win" />}
                    </td>
                    <td className="px-2 py-1.5 text-center text-xs text-muted-foreground">
                      {s.unanswered === s.total ? (
                        <span className="italic">No answer</span>
                      ) : (
                        <>
                          <b className="text-foreground">{s.yes}</b>/{s.total}
                          {s.maybe ? <span className="text-gold"> +{s.maybe}?</span> : null}
                        </>
                      )}
                    </td>
                    {days.map((d) => (
                      <td key={d} className="px-1 py-1.5 text-center">
                        <span className={cn("inline-grid size-7 place-items-center rounded font-heading text-sm font-bold", a[d] ? TONE[a[d]] : "bg-muted/60 text-muted-foreground/50")} title={a[d] ? DATE_STATUS[a[d]].label : "No answer"}>
                          {a[d] ? DATE_STATUS[a[d]].symbol : "·"}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 bg-muted/40">
                <tr className="text-xs">
                  <td className="sticky left-0 z-10 bg-muted px-3 py-2 font-heading font-bold tracking-wide uppercase">Available</td>
                  <td />
                  {perDay.map((p) => (
                    <td key={p.d} className="px-1 py-2 text-center">
                      <div className={cn("font-heading text-base font-bold", p.yes === bestYes && bestYes > 0 && "text-win")}>{p.yes}</div>
                      {p.maybe > 0 && <div className="text-[10px] text-gold">+{p.maybe}?</div>}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
