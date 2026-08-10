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
// The index module, not the learn barrel — the barrel exports LearnSection,
// which imports the workout feature and would make this a circular import.
import { getEntryForCallout } from "@/features/learn/data/techniqueIndex";

import {
  combosForLevel,
  cumulativeSingles,
  type RoadmapLevel,
  type RoadmapPath,
} from "./data/paths";
import { drawnCombos } from "./vocabulary";

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

/**
 * Pair a single technique with its number for the screen, whichever of the two
 * is being spoken. The voice keeps calling both forms — over half the
 * curriculum (kicks, knees, elbows, checks, slips) has no number at all, so a
 * student who only ever heard numbers would freeze the first time a round
 * calls "Left Check" — but a glance at the screen always shows both.
 */
function tagWithReference(technique: string): TechniqueWithStyle {
  const alias = numericAlias(technique);
  if (!alias) return { text: technique, style: ROADMAP_STYLE_KEY };
  return {
    text: technique,
    style: ROADMAP_STYLE_KEY,
    display: `${alias} · ${technique}`,
  };
}

function tagAlias(alias: string, technique: string): TechniqueWithStyle {
  return {
    text: alias,
    style: ROADMAP_STYLE_KEY,
    display: `${alias} · ${technique}`,
  };
}

/**
 * The number a technique is also called by, where it has one — taken from the
 * lesson library so there is no second copy of the numbering to drift.
 *
 * Multi-number shorthands are rejected: "1 1" is a double jab, a combination
 * rather than another name for the jab, and calling it as a single would be
 * telling the student to throw the wrong thing.
 */
function numericAlias(technique: string): string | undefined {
  const numbering = getEntryForCallout(technique)?.numbering;
  if (!numbering || /\s/.test(numbering)) return undefined;
  return numbering;
}

export function poolForRound(
  path: RoadmapPath,
  level: RoadmapLevel,
  round: number
): TechniqueWithStyle[] {
  switch (roundKind(round)) {
    case "intro":
      return tag(level.introduces);
    case "integrate": {
      // Both names and numbers for the same technique, which is how a coach
      // actually calls a round — "jab" and "one" have to mean the same thing
      // by reflex before the combination round starts calling "1 2".
      const singles = cumulativeSingles(path, level.id);
      const pool: TechniqueWithStyle[] = [];
      for (const single of singles) {
        pool.push(tagWithReference(single));
        const alias = numericAlias(single);
        if (alias) pool.push(tagAlias(alias, single));
      }
      return pool;
    }
    case "combos": {
      // The level's own combinations guarantee the new technique gets worked.
      // Everything else is drawn from the app's nineteen style groups and
      // filtered to what this level has taught, which is where the variety
      // comes from — "2 3", "1 1", "3 3 3", "1 2 3 2" and the rest are already
      // written, they were just never being read.
      //
      // Single shots go in too: a real round is not an unbroken run of
      // combinations, and mixing them keeps the student reading each call
      // rather than settling into a pattern.
      const seen = new Set<string>();
      const pool: TechniqueWithStyle[] = [];
      const add = (text: string, entry: TechniqueWithStyle) => {
        const key = text.trim().toLowerCase().replace(/\s+/g, " ");
        if (!key || seen.has(key)) return;
        seen.add(key);
        pool.push(entry);
      };

      for (const combo of combosForLevel(path, level)) {
        add(combo, { text: combo, style: ROADMAP_STYLE_KEY });
      }
      for (const combo of drawnCombos(path, level.id)) {
        add(combo, { text: combo, style: ROADMAP_STYLE_KEY });
      }
      for (const single of cumulativeSingles(path, level.id)) {
        add(single, tagWithReference(single));
      }
      return pool;
    }
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

/**
 * What this round will actually ask of you, in one line.
 *
 * Level-aware because the rounds genuinely differ between levels: the
 * combination round speaks names early on and numbers later, and saying
 * otherwise on the rest screen would set the student up to freeze.
 */
export function roundDescription(
  path: RoadmapPath,
  level: RoadmapLevel,
  round: number
): string {
  switch (roundKind(round)) {
    case "intro":
      return "Just the new techniques, in order and by name. Find the shape of each one.";
    case "integrate":
      return "Everything you know so far, shuffled — and now called by number as well as by name.";
    case "combos":
      return level.id >= path.numbersFromLevel
        ? "Combinations and single shots, mixed and called by number — the way the rest of the app talks."
        : "Short combinations and single shots, still called by name.";
  }
}

/**
 * Rest read the way a person would say it. Guided levels rest for half a
 * minute, and "0.5 min rest" is not something anyone says out loud.
 */
export function formatRest(restMinutes: number): string {
  const seconds = Math.round(restMinutes * 60);
  return seconds < 60 ? `${seconds} sec rest` : `${restMinutes} min rest`;
}

/** Compact one-liner for the collapsed session summary. */
export function roundHeadline(round: number): string {
  switch (roundKind(round)) {
    case "intro":
      return "New techniques, in order";
    case "integrate":
      return "Everything so far, names and numbers";
    case "combos":
      return "Combinations and singles";
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
