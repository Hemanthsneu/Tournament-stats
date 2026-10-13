"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trophy, UserPlus } from "@/components/icons";
import { Field, NativeSelect } from "@/components/admin/fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { clearResult, saveResult } from "@/app/admin/actions";

export interface SidePlayer {
  id: string;
  ign: string;
  note?: string;
}

export interface SideData {
  teamId: string;
  name: string;
  tag: string;
  players: SidePlayer[];
  stats: Record<string, { kills: number; revives: number }>;
}

interface Row {
  played: boolean;
  kills: string;
  revives: string;
}

const SQUAD_SIZES = [2, 3, 4, 5, 6, 7, 8];

export function ResultForm({
  gameId,
  isOfficial,
  weights,
  maps,
  initial,
  sides,
  allPlayers,
  nextHref,
}: {
  gameId: string;
  isOfficial: boolean;
  weights: { kill: number; revive: number };
  maps: { id: string; name: string; total_rounds: number }[];
  initial: {
    map_id: string | null;
    squad_size: number | null;
    team_a_rounds: number | null;
    team_b_rounds: number | null;
    potm_player_id: string | null;
    completed: boolean;
  };
  sides: [SideData, SideData];
  allPlayers: SidePlayer[];
  nextHref: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mapId, setMapId] = useState(initial.map_id ?? maps[0]?.id ?? "");
  const [squad, setSquad] = useState(initial.squad_size ?? 4);
  const [roundsA, setRoundsA] = useState(initial.team_a_rounds?.toString() ?? "");
  const [roundsB, setRoundsB] = useState(initial.team_b_rounds?.toString() ?? "");
  const [potm, setPotm] = useState<string | null>(initial.potm_player_id);
  const [potmTouched, setPotmTouched] = useState(!!initial.potm_player_id);
  const [extra, setExtra] = useState<[SidePlayer[], SidePlayer[]]>([[], []]);
  const [rows, setRows] = useState<Record<string, Row>>(() => {
    const out: Record<string, Row> = {};
    for (const side of sides) {
      for (const p of side.players) {
        const s = side.stats[p.id];
        out[p.id] = { played: !!s, kills: s ? String(s.kills) : "", revives: s ? String(s.revives) : "" };
      }
    }
    return out;
  });

  const map = maps.find((m) => m.id === mapId);
  const a = roundsA === "" ? null : Number(roundsA);
  const b = roundsB === "" ? null : Number(roundsB);
  const winnerSide = a != null && b != null && a !== b ? (a > b ? 0 : 1) : null;
  const sidePlayers = (i: 0 | 1) => [...sides[i].players, ...extra[i]];
  const playedCount = (i: 0 | 1) => sidePlayers(i).filter((p) => rows[p.id]?.played).length;
  const listed = new Set([...sidePlayers(0), ...sidePlayers(1)].map((p) => p.id));

  const score = (id: string) => {
    const r = rows[id];
    return (Number(r?.kills) || 0) * weights.kill + (Number(r?.revives) || 0) * weights.revive;
  };
  const suggested =
    winnerSide == null
      ? null
      : (sidePlayers(winnerSide)
          .filter((p) => rows[p.id]?.played)
          .sort((x, y) => score(y.id) - score(x.id) || (Number(rows[y.id].kills) || 0) - (Number(rows[x.id].kills) || 0))[0]?.id ?? null);
  const potmValue = potmTouched ? potm : suggested;

  const update = (id: string, patch: Partial<Row>) =>
    setRows((r) => ({ ...r, [id]: { ...(r[id] ?? { played: false, kills: "", revives: "" }), ...patch } }));

  const problems: string[] = [];
  if (!map) problems.push("Pick the map.");
  if (a == null || b == null) problems.push("Enter rounds won by both teams.");
  else if (a === b) problems.push("Rounds can't be equal.");
  else if (map && a + b > map.total_rounds) problems.push(`${a + b} rounds entered, but ${map.name} has ${map.total_rounds}.`);
  for (const i of [0, 1] as const) {
    const c = playedCount(i);
    if (c !== squad) problems.push(`${sides[i].tag}: ${c}/${squad} players ticked.`);
  }

  const submit = () => {
    if (problems.length) {
      toast.error(problems[0]);
      return;
    }
    const stats = ([0, 1] as const).flatMap((i) =>
      sidePlayers(i)
        .filter((p) => rows[p.id]?.played)
        .map((p) => ({
          player_id: p.id,
          team_id: sides[i].teamId,
          kills: Number(rows[p.id].kills) || 0,
          revives: Number(rows[p.id].revives) || 0,
        })),
    );
    start(async () => {
      const res = await saveResult(gameId, {
        map_id: mapId,
        squad_size: squad,
        team_a_rounds: a!,
        team_b_rounds: b!,
        potm_player_id: isOfficial ? potmValue : null,
        stats,
      });
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const clear = () => {
    if (!window.confirm("Clear this result? The game goes back to scheduled and all its player stats are removed.")) return;
    start(async () => {
      const res = await clearResult(gameId);
      if (res.ok) {
        toast.success(res.message ?? "Cleared");
        router.refresh();
      } else toast.error(res.error);
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-[1fr_auto_1fr_auto]">
        <Field label="Map played">
          <NativeSelect value={mapId} onChange={(e) => setMapId(e.target.value)}>
            {maps.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.total_rounds} rounds)
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Squad size (each side)">
          <div className="flex gap-1">
            {SQUAD_SIZES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSquad(n)}
                className={cn(
                  "h-9 w-10 rounded-md border text-sm font-medium",
                  squad === n ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                  n < 4 && "text-muted-foreground",
                )}
              >
                {n}v{n}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Rounds won" hint={map ? `${map.name} has ${map.total_rounds} rounds · entered ${(a ?? 0) + (b ?? 0)}` : undefined}>
          <div className="flex items-center gap-2">
            <span className="w-12 truncate text-right text-sm font-medium">{sides[0].tag}</span>
            <Input inputMode="numeric" value={roundsA} onChange={(e) => setRoundsA(e.target.value.replace(/\D/g, ""))} className="w-16 text-center text-lg font-bold" />
            <span className="text-muted-foreground">–</span>
            <Input inputMode="numeric" value={roundsB} onChange={(e) => setRoundsB(e.target.value.replace(/\D/g, ""))} className="w-16 text-center text-lg font-bold" />
            <span className="w-12 truncate text-sm font-medium">{sides[1].tag}</span>
          </div>
        </Field>
        <div className="self-end text-sm">
          {winnerSide != null ? (
            <span className="font-semibold text-win">{sides[winnerSide].name} win</span>
          ) : (
            <span className="text-muted-foreground">No winner yet</span>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {([0, 1] as const).map((i) => {
          const side = sides[i];
          const count = playedCount(i);
          const available = allPlayers.filter((p) => !listed.has(p.id));
          const totalKills = sidePlayers(i).reduce((acc, p) => acc + (rows[p.id]?.played ? Number(rows[p.id].kills) || 0 : 0), 0);
          return (
            <section key={side.teamId} className={cn("rounded-xl border bg-card", winnerSide === i && "border-win/50")}>
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <span className="font-semibold">{side.name}</span>
                <span className={cn("ml-auto text-xs", count === squad ? "text-win" : "text-loss")}>
                  {count}/{squad} played
                </span>
                <span className="text-xs text-muted-foreground">· {totalKills} kills</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 font-heading text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
                    <th className="w-10 px-4 py-2 text-left font-semibold">Played</th>
                    <th className="px-2 py-2 text-left font-semibold">Player</th>
                    <th className="w-20 px-2 py-2 text-center font-semibold">Kills</th>
                    <th className="w-20 px-4 py-2 text-center font-semibold">Revives</th>
                  </tr>
                </thead>
                <tbody>
                  {sidePlayers(i).map((p) => {
                    const r = rows[p.id] ?? { played: false, kills: "", revives: "" };
                    return (
                      <tr key={p.id} className={cn("border-b last:border-0", !r.played && "opacity-60")}>
                        <td className="px-4 py-1.5">
                          <Checkbox checked={r.played} onCheckedChange={(v) => update(p.id, { played: v === true })} aria-label={`${p.ign} played`} />
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="font-medium">{p.ign}</span>
                          {p.note && <span className="ml-2 text-[11px] text-muted-foreground">{p.note}</span>}
                          {isOfficial && potmValue === p.id && <Trophy className="ml-1 inline size-3.5 text-primary" />}
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            inputMode="numeric"
                            value={r.kills}
                            placeholder="0"
                            onChange={(e) => update(p.id, { kills: e.target.value.replace(/\D/g, ""), played: true })}
                            className="h-8 text-center"
                          />
                        </td>
                        <td className="px-4 py-1.5">
                          <Input
                            inputMode="numeric"
                            value={r.revives}
                            placeholder="0"
                            onChange={(e) => update(p.id, { revives: e.target.value.replace(/\D/g, ""), played: true })}
                            className="h-8 text-center"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center gap-2 border-t px-4 py-2">
                <UserPlus className="size-4 text-muted-foreground" />
                <NativeSelect
                  value=""
                  className="h-8 text-xs"
                  onChange={(e) => {
                    const p = allPlayers.find((x) => x.id === e.target.value);
                    if (!p) return;
                    setExtra((ex) => {
                      const next: [SidePlayer[], SidePlayer[]] = [[...ex[0]], [...ex[1]]];
                      next[i].push({ ...p, note: "stand-in" });
                      return next;
                    });
                    update(p.id, { played: true });
                  }}
                >
                  <option value="">Add a stand-in (not on this roster)…</option>
                  {available.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.ign}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </section>
          );
        })}
      </div>

      {isOfficial && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-5">
          <Field label="Player of the Match" hint={suggested ? `Suggested: top MVP score on the winning team` : "Enter rounds and stats to get a suggestion"}>
            <NativeSelect
              value={potmValue ?? ""}
              onChange={(e) => {
                setPotmTouched(true);
                setPotm(e.target.value || null);
              }}
              className="w-64"
            >
              <option value="">None</option>
              {([0, 1] as const).flatMap((i) =>
                sidePlayers(i)
                  .filter((p) => rows[p.id]?.played)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.ign} ({sides[i].tag}) · {score(p.id)} pts
                    </option>
                  )),
              )}
            </NativeSelect>
          </Field>
          {potmTouched && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setPotmTouched(false)}>
              Use suggestion
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="lg" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : initial.completed ? "Update result" : "Publish result"}
        </Button>
        {initial.completed && (
          <Button type="button" variant="outline" onClick={clear} disabled={pending} className="text-loss">
            Clear result
          </Button>
        )}
        {nextHref && (
          <Button asChild variant="ghost">
            <a href={nextHref}>Next game →</a>
          </Button>
        )}
        {problems.length > 0 && <span className="text-sm text-muted-foreground">{problems.join(" ")}</span>}
      </div>
    </div>
  );
}
