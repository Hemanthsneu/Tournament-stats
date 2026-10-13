"use client";

import { ArrowRight } from "@/components/icons";
import { addMonths, fmtMonth, monthCells } from "@/lib/availability";
import { cn } from "@/lib/utils";

const HEAD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Month grid (Monday first) with prev/next; the caller renders each day cell. */
export function MonthCalendar({
  month,
  onMonthChange,
  minMonth,
  maxMonth,
  renderDay,
  className,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  minMonth?: string;
  maxMonth?: string;
  renderDay: (day: string) => React.ReactNode;
  className?: string;
}) {
  const canPrev = !minMonth || month > minMonth;
  const canNext = !maxMonth || month < maxMonth;
  const nav = "grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30";
  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-2 py-1.5">
        <button type="button" className={nav} disabled={!canPrev} onClick={() => onMonthChange(addMonths(month, -1))} aria-label="Previous month">
          <ArrowRight className="size-4 rotate-180" />
        </button>
        <div className="font-heading text-base font-bold tracking-wide uppercase" aria-live="polite">
          {fmtMonth(month)}
        </div>
        <button type="button" className={nav} disabled={!canNext} onClick={() => onMonthChange(addMonths(month, 1))} aria-label="Next month">
          <ArrowRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 p-2" role="grid">
        {HEAD.map((d) => (
          <div key={d} className="pb-1 text-center font-heading text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            <span className="sm:hidden">{d[0]}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
        {monthCells(month).map((day, i) => (day ? <div key={day}>{renderDay(day)}</div> : <div key={`pad-${i}`} aria-hidden />))}
      </div>
    </div>
  );
}
