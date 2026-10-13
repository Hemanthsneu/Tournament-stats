"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ActionForm } from "@/components/admin/action-form";
import { X } from "@/components/icons";
import { MonthCalendar } from "@/components/match-calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/admin";
import { fmtClock, fmtLongDay, monthOf } from "@/lib/availability";
import { onColor } from "@/lib/team-colors";
import { cn } from "@/lib/utils";

export interface PlannerTeam {
  id: string;
  tag: string;
  name: string;
  color: string;
}

export interface PlannerGame {
  id: string;
  fixtureId: string;
  /** "League", "Round Robin 2", "Playoffs" */
  group: string;
  /** "PP vs KT" or "Qualifier 1" */
  title: string;
  /** "Close range · G1" */
  sub: string;
  teamA: PlannerTeam | null;
  teamB: PlannerTeam | null;
  /** "YYYY-MM-DDTHH:mm" in the league timezone, or null when not on the calendar yet. */
  at: string | null;
  completed: boolean;
  score: string | null;
  /** Suggested play order (balanced round robin). */
  order: number;
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fromMin = (n: number) => {
  const c = Math.max(0, Math.min(n, 23 * 60 + 55));
  return `${String(Math.floor(c / 60)).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`;
};
const dayOf = (at: string) => at.slice(0, 10);
const timeOf = (at: string) => at.slice(11, 16);

function TeamTag({ team, compact }: { team: PlannerTeam | null; compact?: boolean }) {
  const size = compact ? "px-[2px] text-[8px] leading-3" : "px-1 text-[10px]";
  if (!team) return <span className={cn("shrink-0 rounded-[3px] bg-muted font-heading font-bold text-muted-foreground", size)}>TBD</span>;
  return (
    <span className={cn("shrink-0 rounded-[3px] font-heading font-bold", size)} style={{ background: team.color, color: onColor(team.color) }}>
      {team.tag}
    </span>
  );
}

/**
 * Calendar planner for a season's fixtures: drag games (or select them and click a date) onto the
 * calendar, adjust times per day, then save. Nothing changes on the site until "Save plan".
 */
export function FixturePlanner({
  action,
  games,
  matchDays,
  available,
  today,
  tz,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  games: PlannerGame[];
  matchDays: { day: string; label: string | null }[];
  /** day → players who said they're available */
  available: Record<string, { yes: number; maybe: number }>;
  today: string;
  tz: string;
}) {
  const initial = useMemo(() => Object.fromEntries(games.map((g) => [g.id, g.at])) as Record<string, string | null>, [games]);
  const [plan, setPlan] = useState<Record<string, string | null>>(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [team, setTeam] = useState<string | null>(null);
  const [start, setStart] = useState("19:00");
  const [gap, setGap] = useState(40);
  const [perDay, setPerDay] = useState(4);

  const byId = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);
  const matchSet = useMemo(() => new Map(matchDays.map((d) => [d.day, d.label])), [matchDays]);
  const firstMonth = monthOf(matchDays.find((d) => d.day >= today)?.day ?? games.find((g) => g.at)?.at?.slice(0, 10) ?? today);
  const [month, setMonth] = useState(firstMonth);

  const teams = useMemo(() => {
    const m = new Map<string, PlannerTeam>();
    for (const g of games) for (const t of [g.teamA, g.teamB]) if (t) m.set(t.id, t);
    return [...m.values()].sort((a, b) => a.tag.localeCompare(b.tag));
  }, [games]);

  const byDay = useMemo(() => {
    const m = new Map<string, PlannerGame[]>();
    for (const g of games) {
      const at = plan[g.id];
      if (!at) continue;
      m.set(dayOf(at), [...(m.get(dayOf(at)) ?? []), g]);
    }
    for (const list of m.values()) list.sort((a, b) => plan[a.id]!.localeCompare(plan[b.id]!) || a.order - b.order);
    return m;
  }, [games, plan]);

  const unscheduled = games.filter((g) => !plan[g.id] && !g.completed).sort((a, b) => a.order - b.order);
  const visible = team ? unscheduled.filter((g) => g.teamA?.id === team || g.teamB?.id === team) : unscheduled;
  const groups = [...new Set(visible.map((g) => g.group))];
  const changes = games.filter((g) => (plan[g.id] ?? null) !== (initial[g.id] ?? null));
  const involves = (g: PlannerGame) => !team || g.teamA?.id === team || g.teamB?.id === team;

  /** Puts games on a day, each in the next free slot after the day's latest game. */
  const assign = (ids: string[], day: string) => {
    const movable = ids.map((id) => byId.get(id)).filter((g): g is PlannerGame => !!g && !g.completed);
    if (!movable.length) return;
    setPlan((p) => {
      const next = { ...p };
      for (const g of movable) next[g.id] = null;
      const times = games.filter((g) => next[g.id] && dayOf(next[g.id]!) === day).map((g) => toMin(timeOf(next[g.id]!)));
      let slot = times.length ? Math.max(...times) + gap : toMin(start);
      for (const g of [...movable].sort((a, b) => a.order - b.order)) {
        next[g.id] = `${day}T${fromMin(slot)}`;
        slot += gap;
      }
      return next;
    });
    setSelected(new Set());
    setOpenDay(day);
  };
  const unassign = (id: string) => setPlan((p) => ({ ...p, [id]: null }));
  const setTime = (id: string, t: string) => setPlan((p) => (p[id] && /^\d{2}:\d{2}$/.test(t) ? { ...p, [id]: `${dayOf(p[id]!)}T${t}` } : p));
  const toggle = (ids: string[]) =>
    setSelected((s) => {
      const next = new Set(s);
      const on = ids.some((id) => !next.has(id));
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const autoFill = () => {
    const days = matchDays.map((d) => d.day).filter((d) => d >= today);
    if (!days.length) {
      toast.error("Add upcoming match days first (Match days & availability tab).");
      return;
    }
    const next = { ...plan };
    const count = new Map<string, number>();
    const last = new Map<string, number>();
    for (const g of games) {
      const at = next[g.id];
      if (!at) continue;
      count.set(dayOf(at), (count.get(dayOf(at)) ?? 0) + 1);
      last.set(dayOf(at), Math.max(last.get(dayOf(at)) ?? -1, toMin(timeOf(at))));
    }
    let placed = 0;
    let d = 0;
    for (const g of unscheduled) {
      while (d < days.length && (count.get(days[d]) ?? 0) >= perDay) d++;
      if (d >= days.length) break;
      const day = days[d];
      const slot = last.has(day) ? last.get(day)! + gap : toMin(start);
      next[g.id] = `${day}T${fromMin(slot)}`;
      count.set(day, (count.get(day) ?? 0) + 1);
      last.set(day, slot);
      placed++;
    }
    setPlan(next);
    const left = unscheduled.length - placed;
    if (left) toast.warning(`Placed ${placed}. ${left} didn't fit: add match days or allow more games per day.`);
    else toast.success(`Placed ${placed} games on the match days. Review, then save.`);
  };

  const onDrop = (day: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    try {
      const ids = JSON.parse(e.dataTransfer.getData("text/plain")) as string[];
      if (Array.isArray(ids)) assign(ids, day);
    } catch {
      /* not one of ours */
    }
  };
  const dragIds = (ids: string[]) => (e: React.DragEvent) => {
    const withSelection = ids.length === 1 && selected.has(ids[0]) ? [...selected] : ids;
    e.dataTransfer.setData("text/plain", JSON.stringify(withSelection));
    e.dataTransfer.effectAllowed = "move";
  };

  const dayGames = openDay ? byDay.get(openDay) ?? [] : [];
  const clash = (g: PlannerGame) =>
    dayGames.some((o) => o.id !== g.id && plan[o.id] === plan[g.id] && [o.teamA?.id, o.teamB?.id].some((t) => t && (t === g.teamA?.id || t === g.teamB?.id)));
  const teamLoad = (list: PlannerGame[]) => {
    const m = new Map<string, number>();
    for (const g of list) for (const t of [g.teamA, g.teamB]) if (t) m.set(t.tag, (m.get(t.tag) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/40 p-3">
        <div className="mr-auto">
          <div className="font-heading text-sm font-bold tracking-wide uppercase">
            {games.length - unscheduled.length} of {games.length} games on the calendar
          </div>
          <div className="text-xs text-muted-foreground">Drag a game onto a date, or click games then a date. Times in {tz}.</div>
        </div>
        <label className="grid gap-1 text-[11px] text-muted-foreground">
          First game
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value || "19:00")} className="h-8 w-32 text-xs" />
        </label>
        <label className="grid gap-1 text-[11px] text-muted-foreground">
          Minutes between games
          <Input type="number" min={10} max={180} step={5} value={gap} onChange={(e) => setGap(Math.max(10, Number(e.target.value) || 40))} className="h-8 w-24 text-xs" />
        </label>
        <label className="grid gap-1 text-[11px] text-muted-foreground">
          Games per day (auto-fill)
          <Input type="number" min={1} max={12} value={perDay} onChange={(e) => setPerDay(Math.max(1, Number(e.target.value) || 4))} className="h-8 w-24 text-xs" />
        </label>
        <Button type="button" variant="outline" size="sm" onClick={autoFill} disabled={!unscheduled.length} title="Fills the remaining games, in the suggested order, onto the season's match days">
          Auto-fill on match days
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        {/* Games to place */}
        <section
          className="flex max-h-[720px] flex-col rounded-lg border bg-card"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            try {
              for (const id of JSON.parse(e.dataTransfer.getData("text/plain")) as string[]) unassign(id);
            } catch {
              /* ignore */
            }
          }}
        >
          <div className="border-b px-3 py-2">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-sm font-bold tracking-wide uppercase">To schedule · {unscheduled.length}</h3>
              {selected.size > 0 && (
                <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelected(new Set())}>
                  Clear selection ({selected.size})
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <button type="button" onClick={() => setTeam(null)} className={cn("rounded px-1.5 py-0.5 text-[11px]", !team ? "bg-brand text-white" : "bg-muted text-muted-foreground")}>
                All teams
              </button>
              {teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTeam(team === t.id ? null : t.id)}
                  className={cn("rounded px-1.5 py-0.5 font-heading text-[11px] font-bold", team === t.id ? "ring-2 ring-foreground" : "opacity-80 hover:opacity-100")}
                  style={{ background: t.color, color: onColor(t.color) }}
                  title={t.name}
                >
                  {t.tag}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-auto p-2">
            {unscheduled.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">Every game is on the calendar.</p>}
            {groups.map((group) => {
              const list = visible.filter((g) => g.group === group);
              const fixtures = [...new Set(list.map((g) => g.fixtureId))];
              return (
                <div key={group}>
                  <div className="px-1 pb-1 font-heading text-[11px] font-bold tracking-widest text-muted-foreground uppercase">{group}</div>
                  <ul className="space-y-1">
                    {fixtures.map((fid) => {
                      const fg = list.filter((g) => g.fixtureId === fid);
                      const allOn = fg.every((g) => selected.has(g.id));
                      return (
                        <li key={fid} className={cn("rounded-md border p-1.5 transition-colors", allOn ? "border-hot bg-hot/5" : "bg-card")}>
                          <button
                            type="button"
                            draggable
                            onDragStart={dragIds(fg.map((g) => g.id))}
                            onClick={() => toggle(fg.map((g) => g.id))}
                            className="flex w-full cursor-grab items-center gap-1.5 text-left active:cursor-grabbing"
                            title="Drag both maps together, or click to select them"
                          >
                            <TeamTag team={fg[0].teamA} />
                            <span className="text-[10px] text-muted-foreground">vs</span>
                            <TeamTag team={fg[0].teamB} />
                            <span className="min-w-0 flex-1 truncate text-xs font-medium">{fg[0].title}</span>
                          </button>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {fg.map((g) => (
                              <button
                                key={g.id}
                                type="button"
                                draggable
                                onDragStart={dragIds([g.id])}
                                onClick={() => toggle([g.id])}
                                aria-pressed={selected.has(g.id)}
                                className={cn(
                                  "cursor-grab rounded border px-1.5 py-0.5 text-[11px] transition-colors active:cursor-grabbing",
                                  selected.has(g.id) ? "border-hot bg-hot text-white" : "bg-muted/50 text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {g.sub}
                              </button>
                            ))}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* Calendar */}
        <div className="min-w-0">
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            renderDay={(day) => {
              const list = byDay.get(day) ?? [];
              const label = matchSet.get(day);
              const isMatch = matchSet.has(day);
              const avail = available[day];
              return (
                // A div, not a button: its game chips are draggable, which nested buttons don't allow everywhere.
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => (selected.size ? assign([...selected], day) : setOpenDay(day))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (selected.size) assign([...selected], day);
                      else setOpenDay(day);
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(day);
                  }}
                  onDragLeave={() => setDragOver((d) => (d === day ? null : d))}
                  onDrop={onDrop(day)}
                  className={cn(
                    "flex min-h-24 w-full cursor-pointer flex-col gap-0.5 rounded-md border p-1 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isMatch ? "border-hot/60 bg-hot/5" : "border-transparent hover:border-border",
                    openDay === day && "ring-2 ring-brand",
                    dragOver === day && "border-hot bg-hot/15",
                    selected.size > 0 && "hover:border-hot hover:bg-hot/10",
                    day < today && !list.length && "opacity-50",
                  )}
                  aria-label={`${fmtLongDay(day)}: ${list.length} game${list.length === 1 ? "" : "s"}${isMatch ? ", match day" : ""}`}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span className={cn("font-heading text-sm font-bold", isMatch && "text-hot")}>{Number(day.slice(8))}</span>
                    {avail && avail.yes > 0 && (
                      <span className="rounded-sm bg-win-soft px-1 text-[9px] font-semibold text-win" title={`${avail.yes} players available${avail.maybe ? `, ${avail.maybe} maybe` : ""}`}>
                        {avail.yes}✓
                      </span>
                    )}
                  </span>
                  {label && <span className="truncate text-[9px] leading-tight text-hot">{label}</span>}
                  {list.slice(0, 4).map((g) => (
                    <span
                      key={g.id}
                      draggable={!g.completed}
                      onDragStart={dragIds([g.id])}
                      className={cn(
                        "flex items-center gap-0.5 overflow-hidden rounded-sm bg-muted px-0.5 text-[9px] leading-4 tabular",
                        !involves(g) && "opacity-30",
                        g.completed && "bg-win-soft",
                      )}
                    >
                      <span className="shrink-0 text-muted-foreground">{timeOf(plan[g.id]!)}</span>
                      <TeamTag team={g.teamA} compact />
                      <TeamTag team={g.teamB} compact />
                    </span>
                  ))}
                  {list.length > 4 && <span className="text-[9px] text-muted-foreground">+{list.length - 4} more</span>}
                </div>
              );
            }}
          />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="size-3 rounded-sm border border-hot/60 bg-hot/5" /> Match day
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="rounded-sm bg-win-soft px-1 text-[9px] font-semibold text-win">8✓</span> Players available
            </span>
          </div>
        </div>

        {/* Day panel */}
        <section className="rounded-lg border bg-card xl:max-h-[720px] xl:overflow-auto">
          {openDay ? (
            <>
              <div className="border-b px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-heading text-base font-bold tracking-wide uppercase">{fmtLongDay(openDay)}</h3>
                    <div className="text-xs text-muted-foreground">
                      {matchSet.has(openDay) ? `Match day${matchSet.get(openDay) ? ` · ${matchSet.get(openDay)}` : ""}` : matchDays.length ? "Not one of the season's match days" : "No match days set"}
                      {available[openDay] ? ` · ${available[openDay].yes} available${available[openDay].maybe ? `, ${available[openDay].maybe} maybe` : ""}` : ""}
                    </div>
                  </div>
                  <button type="button" onClick={() => setOpenDay(null)} className="text-muted-foreground hover:text-foreground" aria-label="Close day">
                    <X className="size-4" />
                  </button>
                </div>
                {selected.size > 0 && (
                  <Button type="button" size="sm" className="mt-2 w-full" onClick={() => assign([...selected], openDay)}>
                    Place {selected.size} selected game{selected.size === 1 ? "" : "s"} here
                  </Button>
                )}
              </div>
              {dayGames.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">No games on this day yet. Drag games here or select them and click the date.</p>
              ) : (
                <>
                  <ul className="divide-y">
                    {dayGames.map((g) => (
                      <li key={g.id} draggable={!g.completed} onDragStart={dragIds([g.id])} className={cn("px-3 py-2", !g.completed && "cursor-grab")}>
                        <div className="flex items-center gap-2">
                          {g.completed ? (
                            <span className="w-[7.5rem] shrink-0 text-xs text-muted-foreground">{fmtClock(timeOf(plan[g.id]!))}</span>
                          ) : (
                            <Input type="time" step={300} value={timeOf(plan[g.id]!)} onChange={(e) => setTime(g.id, e.target.value)} className="h-8 w-[7.5rem] shrink-0 text-xs" aria-label={`Time for ${g.title} ${g.sub}`} />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <TeamTag team={g.teamA} />
                              <span className="text-[10px] text-muted-foreground">vs</span>
                              <TeamTag team={g.teamB} />
                              <span className="truncate text-xs font-medium">{g.teamA || g.teamB ? "" : g.title}</span>
                            </div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              {g.sub}
                              {g.teamA || g.teamB ? ` · ${g.group}` : ""}
                            </div>
                          </div>
                          {g.completed ? (
                            <span className="rounded bg-win-soft px-1.5 py-0.5 text-[11px] font-semibold text-win">Final {g.score}</span>
                          ) : (
                            <button type="button" onClick={() => unassign(g.id)} className="text-muted-foreground hover:text-loss" aria-label={`Take ${g.title} ${g.sub} off the calendar`}>
                              <X className="size-4" />
                            </button>
                          )}
                        </div>
                        {clash(g) && <p className="mt-1 text-[11px] text-loss">Same time as another game with the same team.</p>}
                      </li>
                    ))}
                  </ul>
                  <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
                    Games per team today: {teamLoad(dayGames).map(([t, n]) => `${t} ×${n}`).join(", ")}
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">Click a date to see its games and set times.</p>
          )}
        </section>
      </div>

      {/* Save bar */}
      <ActionForm action={action} className={cn("sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-lg", !changes.length && "hidden")}>
        <input type="hidden" name="plan" value={JSON.stringify(changes.map((g) => ({ id: g.id, at: plan[g.id] ?? null })))} />
        <span className="text-sm">
          <b>{changes.length}</b> unsaved change{changes.length === 1 ? "" : "s"}. The public schedule updates when you save.
        </span>
        <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => setPlan(initial)}>
          Discard
        </Button>
        <Button type="submit" size="sm">
          Save plan
        </Button>
      </ActionForm>
    </div>
  );
}
