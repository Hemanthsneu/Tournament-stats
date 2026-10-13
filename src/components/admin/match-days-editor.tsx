"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { X } from "@/components/icons";
import { MonthCalendar } from "@/components/match-calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/admin";
import { fmtDayMonth, fmtWeekday, monthOf } from "@/lib/availability";
import { cn } from "@/lib/utils";

/** Organizer picks the season's match dates on a calendar; players then answer each one. */
export function MatchDaysEditor({
  action,
  initial,
  scheduleDays,
  answerCounts,
  today,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  initial: { day: string; label: string | null }[];
  /** Dates that already have scheduled games, offered as a one-click fill. */
  scheduleDays: string[];
  /** day → number of players who answered it (to warn before removing). */
  answerCounts: Record<string, number>;
  today: string;
}) {
  const [days, setDays] = useState<Map<string, string>>(() => new Map(initial.map((d) => [d.day, d.label ?? ""])));
  const [month, setMonth] = useState(monthOf(initial.find((d) => d.day >= today)?.day ?? initial[0]?.day ?? today));
  const sorted = [...days.keys()].sort();
  const missingFromSchedule = scheduleDays.filter((d) => !days.has(d));
  const removedWithAnswers = useMemo(() => initial.filter((d) => !days.has(d.day) && answerCounts[d.day]), [initial, days, answerCounts]);

  const toggle = (day: string) =>
    setDays((m) => {
      const next = new Map(m);
      if (next.has(day)) next.delete(day);
      else next.set(day, "");
      return next;
    });

  return (
    <ActionForm
      action={action}
      className="grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr]"
      confirm={removedWithAnswers.length ? `Remove ${removedWithAnswers.length} date(s) that players already answered? Their answers for those dates are deleted.` : undefined}
    >
      {sorted.map((d) => (
        <input key={d} type="hidden" name="day" value={d} />
      ))}
      <div className="space-y-2">
        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          renderDay={(day) => {
            const on = days.has(day);
            return (
              <button
                type="button"
                onClick={() => toggle(day)}
                aria-pressed={on}
                className={cn(
                  "grid aspect-square w-full place-items-center rounded-md text-sm transition active:scale-95",
                  on ? "bg-hot font-heading font-bold text-white" : "text-foreground hover:bg-accent",
                  day === today && !on && "ring-1 ring-border",
                  day < today && !on && "text-muted-foreground/50",
                )}
                title={on ? "Remove match day" : "Add as match day"}
              >
                {Number(day.slice(8))}
              </button>
            );
          }}
        />
        <p className="text-[11px] text-muted-foreground">Click dates to add or remove them. Red dates are match days.</p>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-heading text-sm font-bold tracking-wide uppercase">
            {sorted.length} match day{sorted.length === 1 ? "" : "s"}
          </span>
          {missingFromSchedule.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDays((m) => new Map([...m, ...missingFromSchedule.map((d) => [d, ""] as [string, string])]))}
            >
              Add {missingFromSchedule.length} date{missingFromSchedule.length === 1 ? "" : "s"} from the schedule
            </Button>
          )}
          {sorted.length > 0 && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setDays(new Map())}>
              Clear all
            </Button>
          )}
        </div>
        {sorted.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Pick the dates the tournament will be played on.</p>
        ) : (
          <ul className="max-h-[340px] divide-y overflow-auto rounded-lg border">
            {sorted.map((d) => (
              <li key={d} className="flex items-center gap-3 px-3 py-1.5">
                <div className="w-20 shrink-0">
                  <span className="font-heading text-xs font-bold text-muted-foreground uppercase">{fmtWeekday(d)}</span>{" "}
                  <span className="font-heading text-base font-bold">{fmtDayMonth(d)}</span>
                </div>
                <Input
                  name={`label_${d}`}
                  value={days.get(d) ?? ""}
                  onChange={(e) => setDays((m) => new Map(m).set(d, e.target.value))}
                  placeholder="Label (optional), e.g. Week 1, Playoffs"
                  maxLength={40}
                  className="h-8 text-xs"
                />
                {answerCounts[d] ? <span className="shrink-0 text-[11px] text-muted-foreground">{answerCounts[d]} answered</span> : null}
                <button type="button" onClick={() => toggle(d)} className="shrink-0 text-muted-foreground hover:text-loss" aria-label={`Remove ${d}`}>
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex items-center gap-3">
          <Button type="submit">Save match days</Button>
          {removedWithAnswers.length > 0 && <span className="text-xs text-loss">Removing dates deletes players&apos; answers for them.</span>}
        </div>
      </div>
    </ActionForm>
  );
}
