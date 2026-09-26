import Link from "next/link";
import { notFound } from "next/navigation";
import { SeasonTabs } from "@/components/admin/season-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loadLeague } from "@/lib/data";

export default async function SeasonAdminLayout({ children, params }: LayoutProps<"/admin/seasons/[id]">) {
  const { id } = await params;
  const { idx } = await loadLeague(true);
  const season = idx.seasonById.get(id);
  if (!season) notFound();
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/admin/seasons" className="text-sm text-muted-foreground hover:text-foreground">
          Seasons /
        </Link>
        <h1 className="text-2xl font-bold">{season.name}</h1>
        <Badge variant="outline">{season.status}</Badge>
        {season.status !== "draft" && (
          <Button asChild variant="ghost" size="sm" className="ml-auto">
            <Link href={`/s/${season.number}`}>Open public page →</Link>
          </Button>
        )}
      </div>
      <SeasonTabs seasonId={id} />
      {children}
    </div>
  );
}
