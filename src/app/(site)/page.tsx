import { redirect } from "next/navigation";
import { EmptyState } from "@/components/page-header";
import { loadCurrentSeason } from "@/lib/data";

export default async function Home() {
  const season = await loadCurrentSeason();
  if (season) redirect(`/s/${season.number}`);
  return (
    <EmptyState title="No seasons yet">
      An organizer can create Season 1 in the admin panel.
    </EmptyState>
  );
}
