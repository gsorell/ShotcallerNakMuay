// ===========================================================================
// START HERE — the guided beginner roadmap.
// ---------------------------------------------------------------------------
// A path is an ordered list of levels; a level is one session. Each level names
// the callout strings it introduces, and everything learned before is drilled
// again alongside them — so the vocabulary only ever grows.
//
// The invariant that keeps this honest: the union of `introduces` across the
// core (non-bonus) levels is EXACTLY the `singles` list of the `newb` style.
// Graduating the path means you now answer to every callout Nak Muay Newb can
// throw at you. `roadmapCoverage.test.ts` fails the build if that drifts.
//
// Callout strings are reused verbatim from `@/constants/techniques` so every
// one of them already resolves to a lesson in the Learn library — a level
// names techniques, and the teaching content resolves itself.
//
// Numbering follows the app's own convention (see the Header glossary):
//   1 = Jab · 2 = Cross · 3 = Left Hook · 4 = Right Hook
//   5 = Left Uppercut · 6 = Right Uppercut
// ===========================================================================

import type { Difficulty, EmphasisKey } from "@/types";

/** Pinned session configuration. A guided path makes these choices, not the user. */
export interface RoadmapSessionConfig {
  roundsCount: number;
  roundMin: number;
  restMinutes: number;
  difficulty: Difficulty;
}

export interface RoadmapLevel {
  /** 1-based and contiguous — also the display number on the ladder. */
  id: number;
  title: string;
  /** The "why this technique, why now" line shown under the title. */
  blurb: string;
  /**
   * Callout strings introduced at this level. Must resolve to a Learn lesson;
   * these drive both the pre-session cards and the introduction round.
   */
  introduces: string[];
  /**
   * This level's combinations, in the app's number shorthand.
   *
   * Always numbers, from level 1. Spelling a combination out —
   * "Jab, Cross, Left Hook" — is slower to hear and slower to act on than
   * "1 2 3", which is the entire reason the numbering exists. Round 2 spends a
   * full round pairing every name with its number so that this round can be
   * read at speed.
   */
  combos: string[];
  /**
   * Extra teaching note on the pre-session card, used where a level extends the
   * number language rather than just adding techniques.
   */
  languageNote?: string;
  /**
   * Bespoke art for this rung, drawn for the specific technique it teaches.
   * Omit and the level falls back to the Learn artwork for its category — the
   * teep and elbow levels still do, so a category picture is the floor, never a
   * missing image.
   */
  art?: string;
  /** Playable without Pro. Exactly one core level carries this. */
  free?: boolean;
  /** Sits past graduation — excluded from the `newb` coverage invariant. */
  bonus?: boolean;
  session: RoadmapSessionConfig;
}

export interface RoadmapPath {
  id: string;
  title: string;
  subtitle: string;
  levels: RoadmapLevel[];
  /** The style the path hands the user at graduation. */
  graduatesTo: EmphasisKey;
}

// One-minute rounds throughout. This is a lesson, not a conditioning session:
// the intro round drills two or three new movements, and stretching that over
// two minutes turns deliberate practice into standing around. Three rounds plus
// rest lands a level at about four minutes, which is short enough to repeat and
// short enough to come back to tomorrow. Real workouts are what graduating into
// Nak Muay Newb is for.
//
// Rest is thirty seconds: long enough to read what the next round asks for,
// short enough that a low-volume lesson does not turn into standing about.
const EARLY: RoadmapSessionConfig = {
  roundsCount: 3,
  roundMin: 1,
  restMinutes: 0.5,
  difficulty: "easy",
};

const MID: RoadmapSessionConfig = {
  roundsCount: 3,
  roundMin: 1,
  restMinutes: 0.5,
  difficulty: "easy",
};

const LATE: RoadmapSessionConfig = {
  roundsCount: 3,
  roundMin: 1,
  restMinutes: 0.5,
  difficulty: "medium",
};

export const FOUNDATIONS: RoadmapPath = {
  id: "foundations",
  title: "Start Here",
  subtitle:
    "Ten levels from your first jab to every callout in Nak Muay Newb.",
  graduatesTo: "newb",
  levels: [
    {
      id: 1,
      title: "Stance & the Two Numbers",
      blurb:
        "Guard, stance, and the two punches every combination in the app is built on. This is where 1 and 2 stop being noise.",
      introduces: ["Jab", "Cross"],
      combos: ["1 2", "1 1 2", "1 2 1"],
      art: "/assets/icon_stance.png",
      languageNote:
        "Muay Thai counts its punches: the jab is 1, the cross is 2. Round 2 calls both the name and the number for the same punch — listen for them meaning the same thing — and round 3 uses the numbers alone, because they are far quicker to act on inside a combination.",
      free: true,
      session: EARLY,
    },
    {
      id: 2,
      title: "The Hooks",
      blurb:
        "Turning the hips into a punch for the first time. Your lead hook is the shot that catches what the straights miss.",
      introduces: ["Left Hook", "Right Hook"],
      combos: ["1 2 3", "3 2", "1 2 3 2"],
      art: "/assets/icon_left_hook.png",
      languageNote:
        "Two more numbers: 3 is your left hook, 4 your right. So 1 2 3 is jab, cross, left hook — one syllable each, which is why combinations are called this way.",
      session: EARLY,
    },
    {
      id: 3,
      title: "Owning the Distance",
      blurb:
        "The teep before any round kick: it is the safest thing your leg can do, and it teaches the range every kick after this depends on.",
      introduces: ["Left Teep", "Right Teep"],
      combos: [
        "1, Left Teep",
        "Right Teep, 2",
        "1 2, Left Teep",
        "Left Teep, 1 2",
      ],
      session: EARLY,
    },
    {
      id: 4,
      title: "The Round Kick",
      blurb:
        "The signature technique of the sport — shin, turnover, and the switch. Three heights of the same mechanic, drilled together.",
      introduces: ["Low Kick", "Body Kick", "Switch Kick"],
      combos: [
        "1 2, Body Kick",
        "2 3, Low Kick",
        "1 2, Switch Kick",
        "1 2 3, Low Kick",
      ],
      art: "/assets/icon_round_kick.png",
      session: EARLY,
    },
    {
      id: 5,
      title: "Don't Get Hit",
      blurb:
        "Straight after kicks on purpose: the moment you can kick, you can be kicked. Checking is not an advanced idea, it is the price of throwing.",
      introduces: ["Left Check", "Right Check", "High Guard Block", "Long Guard"],
      combos: [
        "Left Check, 1 2",
        "Right Check, 2 3",
        "High Guard Block, 2, Low Kick",
        "Long Guard, 2 3",
        "Right Check, Low Kick",
      ],
      art: "/assets/icon_check.png",
      session: MID,
    },
    {
      id: 6,
      title: "Move Your Head",
      blurb:
        "A block stops the shot; movement means it was never there. These are also the openings the counter styles are built on.",
      introduces: ["Slip Left", "Slip Right", "Duck", "Lean Back"],
      combos: [
        "1, Slip Right, 2",
        "Slip Left, 2 3",
        "Duck, 3 2",
        "Lean Back, 2, Low Kick",
        "1 2, Slip Right, 2",
      ],
      art: "/assets/icon_slip.png",
      session: LATE,
    },
    {
      id: 7,
      title: "Roll & Angle",
      blurb:
        "Evasion that ends somewhere useful. Pivots are the first idea in the path that is neither strike nor shield — this is ring craft.",
      introduces: ["Roll Left", "Roll Right", "Pivot Left", "Pivot Right"],
      combos: [
        "1 2, Roll Right, 2 3",
        "2 3, Roll Left, 3 2",
        "1 2 3, Pivot Left",
        "Left Teep, Pivot Right, 2",
        "Slip Left, 2, Pivot Left",
      ],
      art: "/assets/icon_pivot.png",
      session: LATE,
    },
    {
      id: 8,
      title: "Knees",
      blurb:
        "Khao — the weapon that makes this Muay Thai and not kickboxing. Held until you can close the distance without getting hit on the way in.",
      introduces: ["Left Knee", "Right Knee"],
      combos: [
        "1, Right Knee",
        "2, Left Knee",
        "1 2, Right Knee",
        "Long Guard, Right Knee, Left Knee",
      ],
      art: "/assets/icon_knee.png",
      session: LATE,
    },
    {
      id: 9,
      title: "Go to the Body",
      blurb:
        "The same four punches, a new target and a new level change. Cheap to add once the hands are automatic, and it doubles what a combination can do.",
      introduces: [
        "Jab to the Body",
        "Cross to the Body",
        "Left Hook to the Body",
        "Right Hook to the Body",
      ],
      combos: [
        "1, 2 to the Body",
        "1 2, 3 to the Body",
        "1 to the Body, 2 3",
        "1 2, 3 to the Body, 3 to the Head",
        "2 3, 4 to the Body",
      ],
      art: "/assets/icon_body_shot.png",
      languageNote:
        "The numbers pick up a suffix here. \"3 to the body\" is your left hook downstairs, \"3 to the head\" the same punch upstairs — same number, different floor.",
      session: LATE,
    },
    {
      id: 10,
      title: "The Committed Shots",
      blurb:
        "Everything that leaves you exposed when the fundamentals are not there: uppercuts on the inside, the overhand over a high guard, and the head kick.",
      introduces: [
        "Left Uppercut",
        "Right Uppercut",
        "Overhand",
        "Inside Leg Kick",
        "Head Kick",
      ],
      combos: [
        "1 2 5 2",
        "Slip Right, 6 3",
        "Overhand, Low Kick",
        "Inside Leg Kick, 2 3",
        "1 2, Head Kick",
        "2 3, Low Kick, Head Kick",
      ],
      art: "/assets/icon_uppercut.png",
      languageNote:
        "Two numbers left: 5 is your left uppercut, 6 your right. That completes the hand numbering — every punch the app calls now has a number you know.",
      session: LATE,
    },
    {
      id: 11,
      title: "Bonus: Elbows",
      blurb:
        "Past the finish line. Sok is the shortest, sharpest weapon in the art, and the reason Muay Thai cuts — a taste of what Muay Sok drills in full.",
      introduces: ["Left Elbow", "Right Elbow", "Up Elbow"],
      combos: [
        "1 2, Right Elbow",
        "3, Right Elbow",
        "2, Up Elbow",
        "1 2, Left Elbow, Right Elbow",
      ],
      bonus: true,
      session: LATE,
    },
  ],
};

export const ROADMAP_PATHS: readonly RoadmapPath[] = [FOUNDATIONS] as const;

// --- lookups ---------------------------------------------------------------

export function getPath(pathId: string): RoadmapPath | undefined {
  return ROADMAP_PATHS.find((p) => p.id === pathId);
}

export function getLevel(
  pathId: string,
  levelId: number
): RoadmapLevel | undefined {
  return getPath(pathId)?.levels.find((l) => l.id === levelId);
}

/** Levels that count toward graduation — everything up to the bonus rungs. */
export function coreLevels(path: RoadmapPath): RoadmapLevel[] {
  return path.levels.filter((l) => !l.bonus);
}

/**
 * Every technique known by the end of this level — the level's own plus all
 * those introduced before it. Derived, never stored, so the coverage invariant
 * cannot be satisfied by a stale copy.
 */
export function cumulativeSingles(
  path: RoadmapPath,
  levelId: number
): string[] {
  const seen = new Set<string>();
  for (const level of path.levels) {
    if (level.id > levelId) break;
    for (const technique of level.introduces) seen.add(technique);
  }
  return [...seen];
}

/** How many techniques the path teaches in total, for progress display. */
export function totalTechniqueCount(path: RoadmapPath): number {
  return coreLevels(path).reduce((sum, l) => sum + l.introduces.length, 0);
}
