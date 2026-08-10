// ===========================================================================
// Artwork for a roadmap level.
// ---------------------------------------------------------------------------
// Derived rather than assigned: a level's picture is the one the Learn section
// already uses for whichever category most of its new techniques belong to. So
// the hooks level wears the boxing glove, the teep and round-kick levels wear
// the Muay Tae art, the elbow level wears Muay Sok — with no second mapping to
// keep in sync, and no way for a curriculum change to leave a level pointing
// at the wrong picture.
// ===========================================================================

import { getEntryForCallout } from "@/features/learn/data/techniqueIndex";
import {
  CATEGORY_META,
  type CategoryMeta,
  type TechniqueCategory,
} from "@/features/learn/data/techniqueLibrary";

import type { RoadmapLevel } from "./data/paths";

/** Nothing resolved — fall back to the hands, where every path starts. */
const FALLBACK: CategoryMeta =
  CATEGORY_META.find((m) => m.key === "punches") ?? CATEGORY_META[0]!;

/**
 * The category most of this level's new techniques belong to. Ties go to
 * whichever appeared first in `introduces`, which is the order a level teaches
 * them in — so the technique the level leads with decides its picture.
 */
export function categoryForLevel(level: RoadmapLevel): TechniqueCategory {
  const counts = new Map<TechniqueCategory, number>();
  const firstSeen = new Map<TechniqueCategory, number>();

  level.introduces.forEach((technique, index) => {
    const category = getEntryForCallout(technique)?.category;
    if (!category) return;
    counts.set(category, (counts.get(category) ?? 0) + 1);
    if (!firstSeen.has(category)) firstSeen.set(category, index);
  });

  let best: TechniqueCategory | undefined;
  for (const [category, count] of counts) {
    if (!best) {
      best = category;
      continue;
    }
    const bestCount = counts.get(best)!;
    if (
      count > bestCount ||
      (count === bestCount && firstSeen.get(category)! < firstSeen.get(best)!)
    ) {
      best = category;
    }
  }

  return best ?? FALLBACK.key;
}

export function artworkForLevel(level: RoadmapLevel): CategoryMeta {
  const category = categoryForLevel(level);
  return CATEGORY_META.find((m) => m.key === category) ?? FALLBACK;
}
