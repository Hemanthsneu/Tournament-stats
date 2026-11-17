import Link from "next/link";
import { SectionTitle } from "@/components/page-header";
import { ChickenIcon, CrosshairIcon, HelmetIcon, PanIcon, SkullIcon, TargetIcon } from "@/components/pubg-icons";
import { TeamLink } from "@/components/team";
import type { Carry, Clutch, GameStory, MatchStories, TeamStory } from "@/lib/engine/insights";
import { onColor, teamColor } from "@/lib/team-colors";
import { fmtDate } from "@/lib/time";
import type { Team } from "@/lib/types";
import { cn } from "@/lib/utils";

function Tag({ team }: { team: Team | null }) {
  const c = teamColor(team);
  return (
    <span className="shrink-0 rounded-[4px] px-1.5 font-heading text-[11px] leading-5 font-bold" style={{ background: c, color: onColor(c) }}>
      {team?.tag ?? "?"}
    </span>
  );
}

function Card({ icon, title, note, children }: { icon: React.ReactNode; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <span className="text-hot">{icon}</span>
        <h3 className="font-heading text-base font-bold tracking-wide uppercase">{title}</h3>
        {note && <span className="ml-auto text-[11px] text-muted-foreground">{note}</span>}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

const Empty = ({ text }: { text: string }) => <p className="px-4 py-5 text-sm text-muted-foreground">{text}</p>;

/** One game: winner, score, loser and a detail line, linking to the match. */
function GameLine({ s, detail }: { s: GameStory; detail: React.ReactNode }) {
  return (
    <li>
      <Link href={`/games/${s.view.game.id}`} className="flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-accent/50">
        <Tag team={s.winner} />
        <span className="font-heading text-base font-bold tabular">
          {s.winnerRounds}–{s.loserRounds}
        </span>
        <Tag team={s.loser} />
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{detail}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{s.view.game.scheduled_at ? fmtDate(s.view.game.scheduled_at) : s.view.label}</span>
      </Link>
    </li>
  );
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function MatchStoriesSection({ stories, carries, clutch, teams }: { stories: MatchStories; carries: Carry[]; clutch: Clutch[]; teams: TeamStory[] }) {
  if (stories.played === 0) return null;
  const biggest = stories.blowouts[0];
  const bloodiest = stories.bloodbaths[0];
  const summary = [
    { v: `${stories.thrillers.length}`, l: `of ${stories.played} games went to the last round`, Icon: TargetIcon },
    { v: `${stories.upsets.length}`, l: "won with fewer kills", Icon: SkullIcon },
    { v: biggest ? `${biggest.winnerRounds}–${biggest.loserRounds}` : "–", l: "biggest win", Icon: HelmetIcon },
    { v: bloodiest ? `${bloodiest.totalKills}` : "–", l: "most kills in one game", Icon: CrosshairIcon },
  ];
  return (
    <section className="space-y-4">
      <SectionTitle>Match stories</SectionTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map(({ v, l, Icon }) => (
          <div key={l} className="flex items-center gap-3 rounded-xl bg-brand px-4 py-3 text-white">
            <Icon className="size-7 shrink-0 text-hot" />
            <div className="min-w-0">
              <div className="font-heading text-3xl leading-none font-bold tabular">{v}</div>
              <div className="mt-0.5 text-[11px] leading-tight text-white/65">{l}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card icon={<TargetIcon className="size-4" />} title="Last-round thrillers" note="won by one round">
          {stories.thrillers.length ? (
            <ul className="divide-y">
              {stories.thrillers.slice(0, 6).map((s) => (
                <GameLine key={s.view.game.id} s={s} detail={`${s.view.map?.name ?? "Map"} · kills ${s.winnerKills}–${s.loserKills}`} />
              ))}
            </ul>
          ) : (
            <Empty text="No one-round finishes yet." />
          )}
        </Card>

        <Card icon={<SkullIcon className="size-4" />} title="Upsets" note="won with fewer kills">
          {stories.upsets.length ? (
            <ul className="divide-y">
              {stories.upsets.slice(0, 6).map((s) => (
                <GameLine key={s.view.game.id} s={s} detail={`won with ${s.winnerKills} kills to ${s.loserKills}`} />
              ))}
            </ul>
          ) : (
            <Empty text="The team with more kills has won every game so far." />
          )}
        </Card>

        <Card icon={<PanIcon className="size-4" />} title="Carry jobs" note="share of the team's kills">
          {carries.length ? (
            <ul className="divide-y">
              {carries.map((c) => (
                <li key={`${c.view.game.id}:${c.player.id}`}>
                  <Link href={`/games/${c.view.game.id}`} className="flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-accent/50">
                    <Tag team={c.team} />
                    <span className="min-w-0 flex-1 truncate font-medium">{c.player.ign}</span>
                    <span className="text-xs text-muted-foreground tabular">
                      {c.kills} of {c.teamKills}
                    </span>
                    <span className="w-11 text-right font-heading text-base font-bold tabular">{pct(c.share)}</span>
                    <span className={cn("w-4 text-center font-heading text-xs font-bold", c.won ? "text-win" : "text-loss")}>{c.won ? "W" : "L"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="No games yet." />
          )}
        </Card>

        <Card icon={<ChickenIcon className="size-4" />} title="Mr. Clutch" note="kills in one-round wins">
          {clutch.length ? (
            <ul className="divide-y">
              {clutch.map((c, i) => (
                <li key={c.player.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                  <span className="w-4 font-heading font-bold text-muted-foreground">{i + 1}</span>
                  <Tag team={c.team} />
                  <Link href={`/players/${c.player.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-hot">
                    {c.player.ign}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {c.games} thriller{c.games === 1 ? "" : "s"}
                  </span>
                  <span className="w-10 text-right font-heading text-base font-bold tabular">{c.kills}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="No one-round wins yet." />
          )}
        </Card>

        <Card icon={<HelmetIcon className="size-4" />} title="Biggest wins" note="round margin">
          <ul className="divide-y">
            {stories.blowouts.map((s) => (
              <GameLine key={s.view.game.id} s={s} detail={`by ${s.margin} rounds · ${s.view.map?.name ?? ""}`} />
            ))}
          </ul>
        </Card>

        <Card icon={<CrosshairIcon className="size-4" />} title="Bloodbaths" note="kills, both teams">
          <ul className="divide-y">
            {stories.bloodbaths.map((s) => (
              <GameLine key={s.view.game.id} s={s} detail={`${s.totalKills} kills (${s.winnerKills}–${s.loserKills})`} />
            ))}
          </ul>
        </Card>
      </div>

      {teams.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <div className="border-b px-4 py-2.5 font-heading text-base font-bold tracking-wide uppercase">Clutch & streaks</div>
          <table className="w-full min-w-max text-sm tabular">
            <thead>
              <tr className="border-b bg-muted/50 font-heading text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2.5 text-left font-semibold">Team</th>
                <th className="px-2 py-2.5 text-right font-semibold">Played</th>
                <th className="px-2 py-2.5 text-right font-semibold">Won</th>
                <th className="px-2 py-2.5 text-right font-semibold" title="Games decided by one round">
                  One-round games
                </th>
                <th className="px-2 py-2.5 text-right font-semibold" title="Wins with fewer kills than the opponent">
                  Upset wins
                </th>
                <th className="px-2 py-2.5 text-right font-semibold">Best streak</th>
                <th className="px-2 py-2.5 text-right font-semibold">Now</th>
                <th className="px-4 py-2.5 text-left font-semibold">Best map</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.team.id} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2">
                    <TeamLink team={t.team} size="xs" />
                  </td>
                  <td className="px-2 py-2 text-right text-muted-foreground">{t.played}</td>
                  <td className="px-2 py-2 text-right">{t.wins}</td>
                  <td className="px-2 py-2 text-right">
                    <span className="font-heading text-base font-bold text-win">{t.closeWins}</span>
                    <span className="text-muted-foreground">–</span>
                    <span className="font-heading text-base font-bold text-loss">{t.closeLosses}</span>
                  </td>
                  <td className="px-2 py-2 text-right">{t.upsetWins}</td>
                  <td className="px-2 py-2 text-right">{t.longestStreak ? `${t.longestStreak} W` : "–"}</td>
                  <td className={cn("px-2 py-2 text-right font-heading text-base font-bold", t.current > 0 ? "text-win" : "text-loss")}>
                    {t.current > 0 ? `W${t.current}` : `L${-t.current}`}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {t.bestMap ? (
                      <>
                        <span className="text-foreground">{t.bestMap.map.name}</span> · {t.bestMap.wins}/{t.bestMap.played} won
                      </>
                    ) : (
                      "–"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
