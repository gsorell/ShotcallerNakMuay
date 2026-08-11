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

/**
 * Roughly how many callouts a one-minute round gets through, with headroom.
 * The introduction bag is built to this length so a round never runs off the
 * end of it and starts repeating the same shuffle.
 */
const INTRO_BAG_LENGTH = 30;

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * The new techniques, shuffled — but shuffled in complete blocks, so each one
 * still gets an even share of a very short round.
 *
 * Strict rotation over two techniques is perfectly predictable, and a callout
 * you can predict is one you stop listening to. Pure random fixes that and
 * breaks something else: level 10 introduces five techniques inside about
 * twenty callouts, and pure random could spend that round calling one of them
 * twice and another eight times — in the round whose whole job is introducing
 * them. Dealing complete shuffled blocks gives unpredictable order and even
 * coverage at the same time.
 */
function shuffledBag(items: string[], length: number): string[] {
  if (items.length === 0) return [];
  const bag: string[] = [];
  while (bag.length < length) bag.push(...shuffle(items));
  return bag;
}

export function roundKind(round: number): RoadmapRoundKind {
  if (round <= 1) return "intro";
  if (round === 2) return "integrate";
  return "combos";
}

/**
 * Whether this round walks its pool front to back rather than picking at
 * random. Only the introduction round does — and precisely *because* its pool
 * is a pre-shuffled bag of complete blocks. Walking it in order is what keeps
 * every new technique evenly covered; random-picking the same bag would undo
 * the balance it exists to provide.
 */
export function walksPoolInOrder(round: number): boolean {
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
      return tag(shuffledBag(level.introduces, INTRO_BAG_LENGTH));
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
      return "Just the new techniques, on their own and by name, in no fixed order. Find the shape of each one.";
    case "integrate":
      return "Everything you know so far, shuffled — and now called by number as well as by name.";
    case "combos":
      // Both forms are genuinely in this round at every level: the drawn
      // combinations come out of the app's own style groups and are written in
      // numbers, while single shots are always called by name. Saying "by name"
      // or "by number" alone would set the student up to freeze on the other.
      return level.id >= path.numbersFromLevel
        ? "Combinations by number, single shots by name — the way the rest of the app talks."
        : "Short combinations and single shots — mostly by name, with the numbers you just learned mixed in.";
  }
}

/**
 * A few entries from a round, spread across the pool rather than taken off the
 * front. The level's own combinations are added first, so showing the first
 * three would only ever show those — and at level 1 that hides the fact that
 * numbers are called at all.
 */
export function poolPreview(pool: string[], count = 3): string[] {
  if (pool.length <= count) return pool;
  const step = Math.floor(pool.length / count);
  return Array.from({ length: count }, (_, i) => pool[i * step]!);
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
      return "New techniques only";
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
