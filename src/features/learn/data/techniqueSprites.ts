// ===========================================================================
// Which lessons have a technique sprite, and where it lives.
// ---------------------------------------------------------------------------
// Sprites are cut from the court footage by `scripts/technique-sprites.mjs`
// (see docs/TECHNIQUE_SHOT_LIST.md). Not every lesson has one yet — 22 of the
// 63 are shot — so this list is what stops a card reaching for a file that is
// not there. Add the slug here when a sheet lands in public/assets/technique.
//
// One sprite per LESSON, not per callout. Several lessons cover a mirrored
// pair — "Left Teep" and "Right Teep" are one card — so one sheet serves both.
// ===========================================================================

/** Lessons with a sheet in `public/assets/technique`. */
const WITH_SPRITE = new Set([
  "jab",
  "cross",
  "lead-hook",
  "rear-hook",
  "teep",
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
  "straight-knee",
  "body-punching",
  "lead-uppercut",
  "rear-uppercut",
  "horizontal-elbow",
  "up-elbow",
]);

/**
 * Frames per sheet. The animation steps through exactly this many cells, so it
 * has to match what the pipeline produced — `frames` in the shot manifest.
 */
export const SPRITE_FRAMES = 6;

/** The sheet for a lesson, or undefined when that lesson has not been shot. */
export function spriteFor(slug: string): string | undefined {
  return WITH_SPRITE.has(slug) ? `/assets/technique/${slug}.webp` : undefined;
}
