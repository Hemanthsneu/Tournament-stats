import Link from "next/link";
import { cn } from "@/lib/utils";

export function FilterPills({ options, value }: { options: { value: string; label: string; href: string }[]; value: string }) {
  return (
    <div className="inline-flex rounded-lg border bg-card p-1 text-sm">
      {options.map((o) => (
        <Link
          key={o.value}
          href={o.href}
          scroll={false}
          className={cn(
            "rounded-md px-3 py-1 text-muted-foreground transition hover:text-foreground",
            value === o.value && "bg-primary text-primary-foreground hover:text-primary-foreground",
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
