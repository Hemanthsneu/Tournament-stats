"use client";

import { useState } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { Field, NativeSelect, TextField } from "@/components/admin/fields";
import { Button } from "@/components/ui/button";
import { DAYS, TIME_OPTIONS } from "@/lib/availability";
import { cn } from "@/lib/utils";
import type { PlayerAvailability } from "@/lib/types";
import { saveAvailability } from "@/app/(site)/me/actions";

export function AvailabilityForm({ availability }: { availability: PlayerAvailability | null }) {
  const [days, setDays] = useState<number[]>(availability?.days ?? []);
  const toggle = (n: number) => setDays((d) => (d.includes(n) ? d.filter((x) => x !== n) : [...d, n]));
  return (
    <ActionForm action={saveAvailability} className="grid gap-4">
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
      <Button type="submit" className="justify-self-start">
        Save availability
      </Button>
    </ActionForm>
  );
}
