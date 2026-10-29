import type { Tier } from "~/lib/scorecard/schema";

/**
 * Re-spreads the tiers evenly over 0–100 (inclusive, no gaps or overlaps),
 * keeping their order, names and colours. 3 tiers → 0–33, 34–66, 67–100.
 */
export function autoDistributeTiers(tiers: Tier[]): Tier[] {
  const n = Math.min(tiers.length, 101);
  const start = (i: number) => Math.round((i * 101) / n);
  return tiers.slice(0, n).map((t, i) => ({ ...t, min: start(i), max: i === n - 1 ? 100 : start(i + 1) - 1 }));
}

/** A colour for a new tier that isn't already used, cycling through a small palette. */
export const TIER_PALETTE = ["#DC2626", "#D97706", "#059669", "#0D9488", "#2563EB", "#7C3AED", "#DB2777", "#475569"];

export function nextTierColor(tiers: Tier[]): string {
  const used = new Set(tiers.map((t) => t.color.toUpperCase()));
  return TIER_PALETTE.find((c) => !used.has(c)) ?? TIER_PALETTE[tiers.length % TIER_PALETTE.length];
}

/**
 * Adds a tier by splitting the widest range in two (the new tier takes the upper
 * half), so a valid set of tiers stays valid. Returns the tiers unchanged if no
 * tier spans at least two percentage points.
 */
export function addTierBySplitting(tiers: Tier[], create: (min: number, max: number) => Tier): Tier[] {
  if (tiers.length === 0) return [create(0, 100)];
  let widest = -1;
  tiers.forEach((t, i) => {
    if (t.max - t.min >= 1 && (widest < 0 || t.max - t.min > tiers[widest].max - tiers[widest].min)) widest = i;
  });
  if (widest < 0) return tiers;
  const w = tiers[widest];
  const mid = Math.floor((w.min + w.max) / 2);
  const next = [...tiers];
  next.splice(widest, 1, { ...w, max: mid }, create(mid + 1, w.max));
  return next;
}

/** Removes a tier and gives its range to the neighbouring tier below (or above, for the lowest). */
export function removeTierMerging(tiers: Tier[], id: string): Tier[] {
  const target = tiers.find((t) => t.id === id);
  if (!target) return tiers;
  const rest = tiers.filter((t) => t.id !== id);
  const below = rest.filter((t) => t.max < target.min).sort((a, b) => b.max - a.max)[0];
  const above = rest.filter((t) => t.min > target.max).sort((a, b) => a.min - b.min)[0];
  return rest.map((t) => {
    if (below && t.id === below.id && below.max === target.min - 1) return { ...t, max: target.max };
    if (!below && above && t.id === above.id && above.min === target.max + 1) return { ...t, min: target.min };
    return t;
  });
}
