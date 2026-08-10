// ===========================================================================
// Turning a roadmap level into the flat pool the callout engine reads.
// ---------------------------------------------------------------------------
// The engine re-reads `currentPoolRef.current` on every callout, so a level can
// change what it is drilling between rounds without the loop ever restarting.
// That is what makes the three-beat shape possible inside one normal session:
//
//   Round 1  introduction  the new techniques only, called in order
//   Round 2  integration   everything learned so far, randomised
//   Round 3  combinations  this level's combos, in the app's own shorthand
//
// Rounds past the third repeat the combination round, so a level with a longer
// session config degrades sensibly rather than running dry.
// ===========================================================================

import type { TechniqueWithStyle } from "@/types";

import {
  combosForLevel,
  cumulativeSingles,
  type RoadmapLevel,
  type RoadmapPath,
} from "./data/paths";

/**
 * Style tag attached to every roadmap callout. It only reaches
 * `mirrorTechnique`, which uses it to exempt the southpaw style from mirroring
 * — a roadmap callout should mirror normally for a southpaw user.
 */
export const ROADMAP_STYLE_KEY = "roadmap";

export type RoadmapRoundKind = "intro" | "integrate" | "combos";

export function roundKind(round: number): RoadmapRoundKind {
  if (round <= 1) return "intro";
  if (round === 2) return "integrate";
  return "combos";
}

/** The introduction round walks the new techniques in a predictable order. */
export function isSequentialRound(round: number): boolean {
  return roundKind(round) === "intro";
}

const tag = (texts: string[]): TechniqueWithStyle[] =>
  texts.map((text) => ({ text, style: ROADMAP_STYLE_KEY }));

export function poolForRound(
  path: RoadmapPath,
  level: RoadmapLevel,
  round: number
): TechniqueWithStyle[] {
  switch (roundKind(round)) {
    case "intro":
      return tag(level.introduces);
    case "integrate":
      return tag(cumulativeSingles(path, level.id));
    case "combos":
      return tag(combosForLevel(path, level));
  }
}

/** Human-readable round title, shown on the ladder and the level card. */
export function roundTitle(round: number): string {
  switch (roundKind(round)) {
    case "intro":
      return "Introduction";
    case "integrate":
      return "Integration";
    case "combos":
      return "Combinations";
  }
}

export function roundDescription(round: number): string {
  switch (roundKind(round)) {
    case "intro":
      return "The new techniques on their own, called in order and by name. Take the time to find the shape of each one.";
    case "integrate":
      return "The new techniques mixed into everything you already know, in random order. This is the first round that trains reaction.";
    case "combos":
      return "This level's combinations, strung together. From here you are hearing exactly what the rest of the app sounds like.";
  }
}

/**
 * The label a roadmap session writes into the workout log. Sessions are logged
 * so streaks and history keep working, but they carry no emphasis, so this
 * stands in for one — see NON_STYLE_LABEL_PREFIXES in the charm catalog, which
 * keeps it out of the "distinct styles trained" counts.
 */
export const ROADMAP_LABEL_PREFIX = "Start Here";

export function roadmapLogLabel(level: RoadmapLevel): string {
  return `${ROADMAP_LABEL_PREFIX} · Level ${level.id}`;
}
