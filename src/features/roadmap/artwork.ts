// ===========================================================================
// Artwork for a roadmap level.
// ---------------------------------------------------------------------------
// Two tiers, and the order matters.
//
// Most levels now carry `art`: a picture drawn for the one technique that level
// teaches, so the ladder reads as a curriculum — a stance, a hook, a check, a
// knee — rather than ten rungs sharing four category pictures.
//
// Levels without one fall back to the derived category art: the picture the
// Learn section already uses for whichever category most of the level's new
// techniques belong to. That keeps the floor safe — a level added tomorrow gets
// a sensible image with no art commissioned and no missing file — and it is
// still what the teep and elbow levels use today.
//
// The emoji fallback always comes from the category, since it is a last resort
// for a 404 and only ever needs to be roughly right.
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
  const meta = CATEGORY_META.find((m) => m.key === category) ?? FALLBACK;
  return level.art ? { ...meta, iconPath: level.art } : meta;
}
