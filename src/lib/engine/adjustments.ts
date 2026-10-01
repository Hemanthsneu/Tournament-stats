/**
 * Manual kill bonuses, keyed by IGN (case-insensitive). Added to a player's official kill totals
 * only; they are not tied to any game, so team kills, NKR and the points table are unaffected.
 */
const KILL_BONUS: Record<string, number> = {
  spraygod: 100,
};

export function killBonus(ign: string): number {
  return KILL_BONUS[ign.trim().toLowerCase()] ?? 0;
}
