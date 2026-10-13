import { cn } from "@/lib/utils";

/** Bold sports-style page title. */
export function PageHeader({
  title,
  subtitle,
  children,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b pb-6", className)}>
      <div className="min-w-0">
        <h1 className="text-4xl leading-none sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Section heading with the red accent bar. */
export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2.5 font-heading text-xl font-bold tracking-wide uppercase">
        <span className="h-5 w-1 bg-hot" aria-hidden />
        {children}
      </h2>
      {action}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed bg-card px-6 py-14 text-center">
      <p className="font-heading text-2xl font-bold uppercase">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

/** Label + big condensed number. */
export function Stat({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="font-heading text-3xl leading-none font-bold tabular">{value}</div>
      <div className="mt-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</div>
    </div>
  );
}
