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
// Where they are near-mirrors (pivot) a single sheet still says it.
// ===========================================================================

import { mirrorTechnique } from "@/utils/textUtils";

export interface SpriteVariant {
  /** Sheet path under public/. */
  src: string;
  /** Shown under the figure when a lesson has more than one. */
  label?: string;
}

/**
 * Sheets whose figure is not centred in its own cell, as a percentage of one
 * cell's width. 50 is centred; these are not.
 *
 * Measured rather than eyeballed: every sheet was decoded and the alpha
 * bounding box of all six cells taken, then the centre of that union compared
 * with the centre of the cell. Thirty of the thirty-five land within four
 * points of centre. These five sit ten to fifteen points LEFT — and left on
 * every frame individually, not just in the union, which is what says the cell
 * was framed that way rather than a punch reaching out of it.
 *
 * Corrected on the way out instead of in the art. The sheets are retouched by
 * hand and re-running the pipeline to move a figure sideways would cost that
 * work; a number here costs nothing and is reversible. If a sheet is ever
 * reshot centred, delete its line.
 */
const INK_CENTRE: Record<string, number> = {
  "jab.webp": 40.2,
  "double-jab.webp": 40.2,
  "cross.webp": 39.6,
  "lead-hook.webp": 35.5,
  "rear-hook.webp": 36.3,
};

/**
 * How far to slide a sheet to bring its figure to the middle, as a percentage
 * of one cell. Zero for everything already centred.
 */
export function inkOffset(src: string): number {
  const centre = INK_CENTRE[src.slice(src.lastIndexOf("/") + 1)];
  return centre === undefined ? 0 : 50 - centre;
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
  "pivot",
  "lead-uppercut",
  "rear-uppercut",
  "overhand",
  // The body shots. The hooks share one sheet and one lesson because the
  // footage is a 4-3 combination rather than an isolated rep — the card is
  // named for what it actually shows.
  "jab-to-body",
  "cross-to-body",
  "body-hooks",
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
 * The slip and the roll are here for a weaker reason. Their two sides are near
 * mirrors, so one sheet was thought to be enough for each; in the event they
 * were thrown differently enough that the two sheets share only half their
 * pixels, and showing both says more than picking one. The pivot stays single,
 * because for that one a single sheet really does say everything.
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
  roll: [
    { src: "/assets/technique/roll-left.webp", label: "Left" },
    { src: "/assets/technique/roll-right.webp", label: "Right" },
  ],
};

const SINGLE_SET: ReadonlySet<string> = new Set(SINGLE);

/**
 * Frames per sheet. The animation steps through exactly this many cells, so it
 * has to match what the pipeline produced — `frames` in the shot manifest.
 */
export const SPRITE_FRAMES = 6;

/**
 * The frame the pipeline puts furthest extension on — the landed punch, the
 * deepest point of a roll. Zero-based, so this is the fourth of six.
 *
 * Anything that needs to hold ONE frame wants this one: the reduced-motion
 * rule, the still figure on the Learn card, and the frame a viewer pauses to.
 */
export const LANDED_FRAME = 3;

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

