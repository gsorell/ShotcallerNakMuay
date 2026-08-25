// ===========================================================================
// Which lessons have a technique sprite, and where it lives.
// ---------------------------------------------------------------------------
// Sprites are cut from the court footage by `scripts/technique-sprites.mjs`
// (see docs/TECHNIQUE_SHOT_LIST.md). Not every lesson has one yet, so this
// list is what stops a card reaching for a file that is not there. Add the
// slug here when a sheet lands in public/assets/technique.
//
// A lesson can carry MORE THAN ONE sheet. Several lessons cover a mirrored
// pair — "Left Teep" and "Right Teep" are one card — and where the two sides
// look meaningfully different, showing both teaches more than picking one.
// Where they are near-mirrors (slip, roll, pivot) a single sheet still says it.
// ===========================================================================

import { mirrorTechnique } from "@/utils/textUtils";

export interface SpriteVariant {
  /** Sheet path under public/. */
  src: string;
  /** Shown under the figure when a lesson has more than one. */
  label?: string;
}

/** Lessons whose sheet is named after the slug itself. */
const SINGLE = [
  "jab",
  // Not shot: cut from the jab's own cells, because a double jab is a jab and
  // then another one. See DERIVED in scripts/technique-sprites.mjs for the bar
  // that trick has to clear.
  "double-jab",
  "cross",
  "lead-hook",
  "rear-hook",
  "roundhouse-kick",
  "low-kick",
  "switch-kick",
  "head-kick",
  "inside-low-kick",
  "high-guard",
  "long-guard",
  "duck",
  "lean-back",
  "roll",
  "pivot",
  "body-punching",
  "lead-uppercut",
  "rear-uppercut",
  "overhand",
] as const;

/**
 * Lessons that show both sides, because the two read differently.
 *
 * Which side does the work is the entire content of most of these. A check
 * with the lead leg and a check with the rear leg are different shapes — the
 * rear one turns the body over to get there — and the path calls them
 * separately, as "Left Check" and "Right Check". One sheet could only ever
 * teach half of it.
 *
 * The slip is here for a weaker reason. Its two sides are near mirrors, so one
 * sheet was thought to be enough; in the event they were thrown differently
 * enough that the two sheets share only half their pixels, and showing both
 * says more than picking one. The roll and pivot stay single, because for
 * those a single sheet really does say everything.
 */
const PAIRED: Record<string, SpriteVariant[]> = {
  teep: [
    { src: "/assets/technique/teep-lead.webp", label: "Lead" },
    { src: "/assets/technique/teep-rear.webp", label: "Rear" },
  ],
  check: [
    { src: "/assets/technique/check-lead.webp", label: "Lead" },
    { src: "/assets/technique/check-rear.webp", label: "Rear" },
  ],
  "straight-knee": [
    { src: "/assets/technique/straight-knee-lead.webp", label: "Lead" },
    { src: "/assets/technique/straight-knee-rear.webp", label: "Rear" },
  ],
  "up-elbow": [
    { src: "/assets/technique/up-elbow-lead.webp", label: "Lead" },
    { src: "/assets/technique/up-elbow-rear.webp", label: "Rear" },
  ],
  "horizontal-elbow": [
    { src: "/assets/technique/horizontal-elbow-lead.webp", label: "Lead" },
    { src: "/assets/technique/horizontal-elbow-rear.webp", label: "Rear" },
  ],
  slip: [
    { src: "/assets/technique/slip-left.webp", label: "Left" },
    { src: "/assets/technique/slip-right.webp", label: "Right" },
  ],
};

const SINGLE_SET: ReadonlySet<string> = new Set(SINGLE);

/**
 * Frames per sheet. The animation steps through exactly this many cells, so it
 * has to match what the pipeline produced — `frames` in the shot manifest.
 */
export const SPRITE_FRAMES = 6;

/** Every sheet for a lesson. Empty when that lesson has not been shot. */
export function spritesFor(slug: string): SpriteVariant[] {
  if (PAIRED[slug]) return PAIRED[slug];
  if (SINGLE_SET.has(slug)) return [{ src: `/assets/technique/${slug}.webp` }];
  return [];
}

/**
 * A technique name as a southpaw should read it.
 *
 * "Left Hook" is the lead hook, written from orthodox like the whole library.
 * A southpaw leads with the right, so their lead hook is a right hook — and it
 * is still number 3, because the numbers are stance-relative. A tile reading
 * "Right Hook · 3" is correct for them, and matches what the callout engine
 * already says out loud.
 *
 * NAMES ONLY. Never run this over lesson prose: the copy is written in lead and
 * rear precisely so it needs no flipping, and the few stray "right"s in it are
 * English rather than directions — one lesson has "right before it stops being
 * harmless", which this would turn into "left before it stops being harmless".
 * Anatomy would not survive it either; the liver is on one side of a body
 * whichever way the puncher stands.
 */
export function displayName(name: string, southpaw: boolean): string {
  return southpaw ? mirrorTechnique(name) : name;
}

/**
 * The side label to print under a mirrored figure.
 *
 * The sheets are shot orthodox, so a southpaw sees them flipped — and a label
 * that names a DIRECTION has to flip with the picture or it contradicts it. A
 * "Slip Left" sheet mirrored shows a slip to the figure's right, which is also
 * what the callout engine will say out loud: `mirrorTechnique` swaps Left and
 * Right on the way to the speaker.
 *
 * Lead and Rear do not move. They are stance-relative — the lead leg is the
 * lead leg whichever way you stand — so the mirrored figure is still the lead
 * teep, and swapping the label would make it wrong.
 */
export function sideLabel(
  label: string | undefined,
  southpaw: boolean
): string | undefined {
  if (!label || !southpaw) return label;
  if (label === "Left") return "Right";
  if (label === "Right") return "Left";
  return label;
}
