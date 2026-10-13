"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { Field, NativeSelect, TextField } from "@/components/admin/fields";
import { MonthCalendar } from "@/components/match-calendar";
import { Button } from "@/components/ui/button";
import { DATE_STATUS, DAYS, TIME_OPTIONS, dateSummary, fmtDayMonth, fmtLongDay, fmtWeekday, monthOf, nextStatus, weekdayOf } from "@/lib/availability";
import { cn } from "@/lib/utils";
import type { DateStatus, PlayerAvailability } from "@/lib/types";
import { saveAvailability } from "@/app/(site)/me/actions";

export interface MatchDayLite {
  day: string;
  label: string | null;
}

const CELL: Record<DateStatus | "open", string> = {
  yes: "bg-win text-white",
  maybe: "bg-gold-soft text-gold ring-2 ring-inset ring-gold/60",
  no: "bg-loss-soft text-loss ring-1 ring-inset ring-loss/40",
  open: "border-2 border-dashed border-hot/50 bg-card text-foreground",
};

const SEG: Record<DateStatus, string> = {
  yes: "bg-win text-white border-win",
  maybe: "bg-gold text-white border-gold",
  no: "bg-loss text-white border-loss",
};

export function AvailabilityForm({
  availability,
  season,
  matchDays,
  answers: initialAnswers,
  today,
}: {
  availability: PlayerAvailability | null;
  season: { id: string; name: string } | null;
  matchDays: MatchDayLite[];
  answers: Record<string, DateStatus>;
  today: string;
}) {
  const [days, setDays] = useState<number[]>(availability?.days ?? []);
  const [answers, setAnswers] = useState<Record<string, DateStatus>>(initialAnswers);
  const toggle = (n: number) => setDays((d) => (d.includes(n) ? d.filter((x) => x !== n) : [...d, n]));

  const dates = matchDays.map((m) => m.day);
  const open = dates.filter((d) => d >= today);
  const labels = new Map(matchDays.map((m) => [m.day, m.label]));
  const isMatch = new Set(dates);
  const firstMonth = monthOf(open[0] ?? dates[0] ?? today);
  const [month, setMonth] = useState(firstMonth);
  const summary = dateSummary(dates, answers);
  const dirty = useMemo(() => JSON.stringify(Object.entries(answers).sort()) !== JSON.stringify(Object.entries(initialAnswers).sort()), [answers, initialAnswers]);

  const set = (day: string, status: DateStatus | undefined) =>
    setAnswers((a) => {
      const next = { ...a };
      if (status) next[day] = status;
      else delete next[day];
      return next;
    });
  const setOpen = (fn: (day: string) => DateStatus | undefined) =>
    setAnswers((a) => {
      const next = { ...a };
      for (const d of open) {
        const s = fn(d);
        if (s) next[d] = s;
        else delete next[d];
      }
      return next;
    });

  return (
    <ActionForm action={saveAvailability} className="grid gap-8">
      {season && <input type="hidden" name="season_id" value={season.id} />}
      <input type="hidden" name="answers" value={JSON.stringify(answers)} />

      {season && dates.length > 0 ? (
        <section className="grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-heading text-base font-bold tracking-wide uppercase">{season.name} match days</h3>
              <p className="text-xs text-muted-foreground">Tap a date to cycle: available, maybe, can&apos;t play. Captains see this before they bid.</p>
            </div>
            <div className="text-right">
              <div className="font-heading text-2xl leading-none font-bold tabular">
                {summary.total - summary.unanswered}
                <span className="text-muted-foreground">/{summary.total}</span>
              </div>
              <div className="text-[11px] tracking-wide text-muted-foreground uppercase">answered</div>
            </div>
          </div>

          {/* Answer bar */}
          <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className="bg-win transition-all" style={{ width: `${(summary.yes / summary.total) * 100}%` }} />
            <span className="bg-gold transition-all" style={{ width: `${(summary.maybe / summary.total) * 100}%` }} />
            <span className="bg-loss transition-all" style={{ width: `${(summary.no / summary.total) * 100}%` }} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
            <div className="space-y-3">
              <MonthCalendar
                month={month}
                onMonthChange={setMonth}
                minMonth={monthOf(dates[0])}
                maxMonth={monthOf(dates.at(-1)!)}
                renderDay={(day) => {
                  const n = Number(day.slice(8));
                  if (!isMatch.has(day)) return <div className="grid aspect-square place-items-center text-xs text-muted-foreground/40">{n}</div>;
                  const status = answers[day];
                  const past = day < today;
                  return (
                    <button
                      type="button"
                      disabled={past}
                      onClick={() => set(day, nextStatus(status))}
                      title={`${fmtLongDay(day)}${labels.get(day) ? ` · ${labels.get(day)}` : ""}: ${status ? DATE_STATUS[status].label : "not answered"}`}
                      className={cn(
                        "relative grid aspect-square w-full place-items-center rounded-md font-heading text-sm font-bold transition hover:brightness-95 active:scale-95",
                        CELL[status ?? "open"],
                        past && "cursor-not-allowed opacity-40",
                      )}
                    >
                      {n}
                      <span className="absolute top-0.5 right-1 text-[9px] leading-none">{status ? DATE_STATUS[status].symbol : ""}</span>
                    </button>
                  );
                }}
              />
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                {(["yes", "maybe", "no"] as const).map((s) => (
                  <span key={s} className="inline-flex items-center gap-1">
                    <span className={cn("size-3 rounded-[3px]", CELL[s])} /> {DATE_STATUS[s].label}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1">
                  <span className={cn("size-3 rounded-[3px] border", CELL.open)} /> Not answered
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <Button type="button" size="sm" variant="outline" onClick={() => setOpen(() => "yes")} disabled={!open.length}>
                  All available
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setOpen((d) => (days.includes(weekdayOf(d)) ? "yes" : answers[d]))}
                  disabled={!open.length || !days.length}
                  title="Marks dates that fall on your usual days (below) as available"
                >
                  Use my usual week
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(() => undefined)} disabled={!open.length}>
                  Clear
                </Button>
              </div>
              <ul className="max-h-[360px] divide-y overflow-auto rounded-lg border">
                {dates.map((day) => {
                  const status = answers[day];
                  const past = day < today;
                  return (
                    <li key={day} className={cn("flex items-center gap-3 px-3 py-2", past && "opacity-50")}>
                      <div className="w-12 text-center">
                        <div className="font-heading text-[11px] font-bold tracking-wide text-muted-foreground uppercase">{fmtWeekday(day)}</div>
                        <div className="font-heading text-lg leading-none font-bold">{fmtDayMonth(day)}</div>
                      </div>
                      <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{labels.get(day) ?? (past ? "Played" : "")}</div>
                      <div className="flex overflow-hidden rounded-md border" role="radiogroup" aria-label={fmtLongDay(day)}>
                        {(["yes", "maybe", "no"] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            role="radio"
                            aria-checked={status === s}
                            disabled={past}
                            onClick={() => set(day, status === s ? undefined : s)}
                            className={cn(
                              "h-8 border-l px-2.5 text-xs font-semibold transition-colors first:border-l-0 sm:px-3",
                              status === s ? SEG[s] : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                            )}
                          >
                            {DATE_STATUS[s].short}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          When the organizers announce the next season&apos;s match dates, they&apos;ll show up here as a calendar for you to answer.
        </p>
      )}

      <section className="grid gap-4">
        <div>
          <h3 className="font-heading text-base font-bold tracking-wide uppercase">Your usual week</h3>
          <p className="text-xs text-muted-foreground">The days and hours you can normally play.</p>
        </div>
        <Field label="Days you can play">
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d) => (
              <button
                key={d.n}
                type="button"
                onClick={() => toggle(d.n)}
                aria-pressed={days.includes(d.n)}
                className={cn(
                  "h-10 w-12 rounded-md border font-heading text-sm font-bold tracking-wide uppercase transition-colors",
                  days.includes(d.n) ? "border-win bg-win text-white" : "bg-card text-muted-foreground hover:bg-accent",
                )}
              >
                {d.short}
              </button>
            ))}
            <button type="button" onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])} className="h-10 rounded-md px-3 text-xs text-muted-foreground hover:text-foreground">
              Every day
            </button>
          </div>
          {days.map((d) => (
            <input key={d} type="hidden" name="day" value={d} />
          ))}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From">
            <NativeSelect name="time_from" defaultValue={availability?.time_from ?? "20:00"}>
              {TIME_OPTIONS.slice(0, -1).map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Until">
            <NativeSelect name="time_to" defaultValue={availability?.time_to ?? "23:00"}>
              {TIME_OPTIONS.slice(1).map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <TextField label="Note for captains (optional)" name="note" defaultValue={availability?.note ?? ""} maxLength={160} placeholder="e.g. Not available 20–25 Oct, exams" />
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit">Save availability</Button>
        {dirty && <span className="text-xs font-medium text-hot">Unsaved changes</span>}
      </div>
    </ActionForm>
  );
}
