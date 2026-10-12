import Link from "next/link";
import { Swords } from "lucide-react";
import { NativeSelect } from "@/components/admin/fields";
import { EmptyState, PageHeader, SectionTitle } from "@/components/page-header";
import { TeamLink, TeamLogo } from "@/components/team";
import { Button } from "@/components/ui/button";
import { loadCommunity, profileMap } from "@/lib/community";
import { loadLeague } from "@/lib/data";
import { playerCareer, type Career } from "@/lib/engine/players";
import { cn } from "@/lib/utils";

export const metadata = { title: "Head-to-head" };

export default async function ComparePage({ searchParams }: PageProps<"/compare">) {
  const sp = await searchParams;
  const [{ idx }, community] = await Promise.all([loadLeague(), loadCommunity()]);
  const players = [...idx.data.players].sort((a, b) => a.ign.localeCompare(b.ign));
  const aId = typeof sp.a === "string" ? sp.a : "";
  const bId = typeof sp.b === "string" ? sp.b : "";
  const A = aId ? playerCareer(idx, aId, "official") : null;
  const B = bId ? playerCareer(idx, bId, "official") : null;
  const photos = profileMap(community);

  return (
    <div className="space-y-8">
      <PageHeader title="Head-to-head" subtitle="Compare any two players across every season (official games)" />
      <form className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        <NativeSelect name="a" defaultValue={aId} className="w-56">
          <option value="">Pick a player…</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.ign}
            </option>
          ))}
        </NativeSelect>
        <Swords className="size-5 text-primary" />
        <NativeSelect name="b" defaultValue={bId} className="w-56">
          <option value="">Pick a player…</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.ign}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit">Compare</Button>
      </form>

      {!A || !B ? (
        <EmptyState title="Pick two players to compare" />
      ) : (
        <Comparison A={A} B={B} photoA={photos.get(A.player.id)?.photo_url ?? null} photoB={photos.get(B.player.id)?.photo_url ?? null} />
      )}
    </div>
  );
}

function Comparison({ A, B, photoA, photoB }: { A: Career; B: Career; photoA: string | null; photoB: string | null }) {
  const per = (c: Career, n: number) => (c.totals.games ? n / c.totals.games : 0);
  const wins = (c: Career) => c.log.filter((l) => l.won).length;
  const rows: { label: string; a: number; b: number; fmt?: (n: number) => string }[] = [
    { label: "Games", a: A.totals.games, b: B.totals.games },
    { label: "Win %", a: per(A, wins(A)) * 100, b: per(B, wins(B)) * 100, fmt: (n) => `${n.toFixed(0)}%` },
    { label: "Kills", a: A.totals.kills, b: B.totals.kills },
    { label: "Kills / game", a: per(A, A.totals.kills), b: per(B, B.totals.kills), fmt: (n) => n.toFixed(2) },
    { label: "Revives", a: A.totals.revives, b: B.totals.revives },
    { label: "Revives / game", a: per(A, A.totals.revives), b: per(B, B.totals.revives), fmt: (n) => n.toFixed(2) },
    { label: "MVP points", a: A.totals.mvp, b: B.totals.mvp, fmt: (n) => n.toFixed(0) },
    { label: "Player of the Match", a: A.totals.potm, b: B.totals.potm },
    { label: "Titles", a: A.totals.titles, b: B.totals.titles },
  ];

  // Games where they were on opposite sides, and games as teammates.
  const bGames = new Map(B.log.map((l) => [l.view.game.id, l]));
  const versus = A.log.filter((l) => bGames.has(l.view.game.id) && bGames.get(l.view.game.id)!.stat.team_id !== l.stat.team_id);
  const together = A.log.filter((l) => bGames.has(l.view.game.id) && bGames.get(l.view.game.id)!.stat.team_id === l.stat.team_id);
  const vsWinsA = versus.filter((l) => l.won).length;
  const vsKillsA = versus.reduce((s, l) => s + l.stat.kills, 0);
  const vsKillsB = versus.reduce((s, l) => s + bGames.get(l.view.game.id)!.stat.kills, 0);
  const seasons = [...new Map([...A.seasons, ...B.seasons].map((s) => [s.season.id, s.season])).values()].sort((x, y) => y.number - x.number);

  return (
    <>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <Header career={A} photo={photoA} align="left" />
        <span className="font-heading text-3xl font-extrabold text-muted-foreground">vs</span>
        <Header career={B} photo={photoB} align="right" />
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        {rows.map((r) => {
          const max = Math.max(r.a, r.b, 1e-9);
          const fmt = r.fmt ?? ((n: number) => String(Math.round(n)));
          return (
            <div key={r.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b px-4 py-2.5 last:border-0">
              <div className="flex items-center justify-end gap-3">
                <span className={cn("tabular font-semibold", r.a > r.b && "text-primary")}>{fmt(r.a)}</span>
                <div className="h-2 w-full max-w-48 overflow-hidden rounded-full bg-muted">
                  <div className={cn("ml-auto h-full rounded-full", r.a >= r.b ? "bg-primary" : "bg-muted-foreground/50")} style={{ width: `${(r.a / max) * 100}%` }} />
                </div>
              </div>
              <span className="w-36 text-center text-xs uppercase tracking-wide text-muted-foreground">{r.label}</span>
              <div className="flex items-center gap-3">
                <div className="h-2 w-full max-w-48 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", r.b >= r.a ? "bg-primary" : "bg-muted-foreground/50")} style={{ width: `${(r.b / max) * 100}%` }} />
                </div>
                <span className={cn("tabular font-semibold", r.b > r.a && "text-primary")}>{fmt(r.b)}</span>
              </div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <SectionTitle>When they faced each other</SectionTitle>
          {versus.length === 0 ? (
            <p className="text-sm text-muted-foreground">They haven&apos;t played against each other yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label={`${A.player.ign} wins`} value={vsWinsA} />
              <Stat label="Games" value={versus.length} />
              <Stat label={`${B.player.ign} wins`} value={versus.length - vsWinsA} />
              <Stat label={`${A.player.ign} kills`} value={vsKillsA} />
              <span />
              <Stat label={`${B.player.ign} kills`} value={vsKillsB} />
            </div>
          )}
        </div>
        <div className="rounded-xl border bg-card p-5">
          <SectionTitle>As teammates</SectionTitle>
          {together.length === 0 ? (
            <p className="text-sm text-muted-foreground">Never on the same side.</p>
          ) : (
            <p className="text-sm">
              <b>{together.length}</b> games together, won <b>{together.filter((l) => l.won).length}</b>.
            </p>
          )}
        </div>
      </section>

      <section>
        <SectionTitle>Season by season</SectionTitle>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-max text-sm tabular">
            <thead>
              <tr className="border-b text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Season</th>
                <th className="px-4 py-2.5 text-left font-medium">{A.player.ign}</th>
                <th className="px-4 py-2.5 text-left font-medium">{B.player.ign}</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map((s) => {
                const sa = A.seasons.find((x) => x.season.id === s.id);
                const sb = B.seasons.find((x) => x.season.id === s.id);
                const cell = (x: typeof sa) =>
                  x && x.games ? `${x.games} G · ${x.kills} K · ${x.revives} R${x.finish ? ` · ${x.finish}` : ""}` : "–";
                return (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium">{s.name}</td>
                    <td className="px-4 py-2.5">{cell(sa)}</td>
                    <td className="px-4 py-2.5">{cell(sb)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Header({ career, photo, align }: { career: Career; photo: string | null; align: "left" | "right" }) {
  return (
    <div className={cn("flex items-center gap-4", align === "right" && "flex-row-reverse text-right")}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="size-16 rounded-xl border object-cover sm:size-20" />
      ) : (
        <TeamLogo team={career.currentTeam} size="xl" />
      )}
      <div className="min-w-0">
        <Link href={`/players/${career.player.id}`} className="block truncate font-heading text-xl font-extrabold hover:text-primary sm:text-3xl">
          {career.player.ign}
        </Link>
        {career.currentTeam && <TeamLink team={career.currentTeam} size="xs" />}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-heading text-2xl font-bold">{value}</div>
      <div className="truncate text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
