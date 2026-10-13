import Link from "next/link";
import { cn } from "@/lib/utils";

/** Segmented control. */
export function FilterPills({ options, value }: { options: { value: string; label: string; href: string }[]; value: string }) {
  return (
    <div className="inline-flex rounded-lg bg-muted p-0.5 text-sm">
      {options.map((o) => (
        <Link
          key={o.value}
          href={o.href}
          scroll={false}
          className={cn(
            "rounded-md px-3 py-1 text-muted-foreground transition-colors hover:text-foreground",
            value === o.value && "bg-card text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.06)]",
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
