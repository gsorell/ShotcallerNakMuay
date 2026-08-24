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

export interface SpriteVariant {
  /** Sheet path under public/. */
  src: string;
  /** Shown under the figure when a lesson has more than one. */
  label?: string;
}

/** Lessons whose sheet is named after the slug itself. */
const SINGLE = [
  "jab",
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
  "slip",
  "duck",
  "lean-back",
  "roll",
  "pivot",
  "body-punching",
  "lead-uppercut",
  "rear-uppercut",
  "overhand",
  "horizontal-elbow",
  "up-elbow",
] as const;

/**
 * Lessons that show both sides, because the two read differently.
 *
 * Which leg does the work is the entire content of these three. A check with
 * the lead leg and a check with the rear leg are different shapes — the rear
 * one turns the body over to get there — and the path calls them separately,
 * as "Left Check" and "Right Check". One sheet could only ever teach half of
 * it. Contrast the slip, roll and pivot, which really are mirrors, and where a
 * single sheet says everything.
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
