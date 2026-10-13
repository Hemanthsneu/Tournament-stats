"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { TEAM_PALETTE } from "@/lib/team-colors";
import { cn } from "@/lib/utils";

/** Team colour: one-tap sports palette plus a custom picker. Submits as name="color". */
export function ColorField({ defaultValue, label = "Team colour" }: { defaultValue?: string | null; label?: string }) {
  const [color, setColor] = useState(defaultValue ?? TEAM_PALETTE[0].hex);
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        {TEAM_PALETTE.map((p) => (
          <button
            key={p.hex}
            type="button"
            title={p.name}
            aria-label={p.name}
            onClick={() => setColor(p.hex)}
            className={cn("size-6 rounded-[5px] ring-offset-2 ring-offset-card transition", color.toLowerCase() === p.hex && "ring-2 ring-foreground")}
            style={{ background: p.hex }}
          />
        ))}
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="size-6 cursor-pointer rounded-[5px] border bg-transparent p-0"
          title="Custom colour"
          aria-label="Custom colour"
        />
        <input type="hidden" name="color" value={color} />
      </div>
    </div>
  );
}
