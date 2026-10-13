// Team colours: bold sports palette, distinct defaults, readable text on top.
import type { Team } from "./types";

export const TEAM_PALETTE = [
  { name: "Royal", hex: "#1d428a" },
  { name: "Red", hex: "#c8102e" },
  { name: "Green", hex: "#007a33" },
  { name: "Purple", hex: "#552583" },
  { name: "Orange", hex: "#e8661b" },
  { name: "Teal", hex: "#00788c" },
  { name: "Gold", hex: "#f2b705" },
  { name: "Wine", hex: "#860038" },
  { name: "Sky", hex: "#0077c0" },
  { name: "Black", hex: "#1a1a1a" },
] as const;

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/**
 * Fills missing team colours so teams get different defaults. Teams are handled oldest first, so
 * adding a new team never changes the colour of an existing one.
 */
export function withTeamColors<T extends Team>(teams: T[]): T[] {
  const used = new Set(teams.map((t) => t.color?.toLowerCase()).filter(Boolean));
  const chosen = new Map<string, string>();
  const oldestFirst = [...teams].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id));
  for (const t of oldestFirst) {
    if (t.color) continue;
    let i = hash(t.id) % TEAM_PALETTE.length;
    for (let n = 0; n < TEAM_PALETTE.length && used.has(TEAM_PALETTE[i].hex); n++) i = (i + 1) % TEAM_PALETTE.length;
    used.add(TEAM_PALETTE[i].hex);
    chosen.set(t.id, TEAM_PALETTE[i].hex);
  }
  return teams.map((t) => (t.color ? t : { ...t, color: chosen.get(t.id) ?? null }));
}

export function teamColor(team: Pick<Team, "id" | "name" | "color"> | null | undefined): string {
  if (!team) return "#8a93a6";
  return team.color ?? TEAM_PALETTE[hash(team.id) % TEAM_PALETTE.length].hex;
}

/** White or ink text, whichever reads better on the colour. */
export function onColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? "#0b132b" : "#ffffff";
}
