import { PLAYOFF_FORMAT_LIST, type PlayoffFormat } from "@/lib/playoff-formats";
import { cn } from "@/lib/utils";

/** Radio cards for a season's playoff format; formats needing more teams than the season has are disabled. */
export function PlayoffFormatChoice({ current, teamCount }: { current: PlayoffFormat; teamCount: number }) {
  const fits = (q: number) => q <= teamCount;
  const selected = fits(PLAYOFF_FORMAT_LIST.find((f) => f.id === current)?.qualify ?? 0) ? current : (PLAYOFF_FORMAT_LIST.find((f) => fits(f.qualify))?.id ?? "none");
  return (
    <fieldset className="grid w-full gap-2 sm:grid-cols-2">
      <legend className="mb-1.5 text-xs text-muted-foreground">Playoffs</legend>
      {PLAYOFF_FORMAT_LIST.map((f) => {
        const disabled = !fits(f.qualify);
        return (
          <label
            key={f.id}
            className={cn(
              "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors has-[:checked]:border-hot has-[:checked]:bg-hot/5",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <input type="radio" name="playoff_format" value={f.id} defaultChecked={f.id === selected} disabled={disabled} className="mt-1 accent-[var(--hot)]" />
            <span>
              <span className="block text-sm font-semibold">{f.label}</span>
              <span className="block text-xs text-muted-foreground">
                {f.description}
                {disabled ? ` Needs ${f.qualify} teams.` : ""}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
