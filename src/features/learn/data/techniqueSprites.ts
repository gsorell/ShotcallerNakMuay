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

import type { TechniqueCategory } from "./techniqueLibrary";

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

// ---------------------------------------------------------------------------
// Which figure stands for a whole category on the Learn shelf.
// ---------------------------------------------------------------------------

/**
 * The technique whose silhouette represents its category.
 *
 * Three categories are missing on purpose. Nothing in the clinch, the feints,
 * or the conditioning list has been shot, so those cards keep the neon icon
 * they have always had — the same two-tier arrangement the roadmap ladder uses,
 * where bespoke art leads and category art is the floor rather than a gap.
 *
 * Each pick is the technique someone would name if asked what the category is:
 * the jab, the round kick, the straight knee, the horizontal elbow. Defence
 * takes the slip because a guard is a position and reads as a still, while the
 * slip is a movement and is the only one of them that gains anything from being
 * animated on a shelf.
 */
const CATEGORY_HERO: Partial<Record<TechniqueCategory, string>> = {
  punches: "jab",
  kicks: "roundhouse-kick",
  knees: "straight-knee",
  elbows: "horizontal-elbow",
  defense: "slip",
};

/** The sheet to show on a category card, if that category has one. */
export function categoryHero(
  category: TechniqueCategory
): SpriteVariant | undefined {
  const slug = CATEGORY_HERO[category];
  return slug ? spritesFor(slug)[0] : undefined;
}

// ---------------------------------------------------------------------------
// How the gallery groups the figures.
// ---------------------------------------------------------------------------

export interface SpriteGroup {
  key: string;
  label: string;
  categories: TechniqueCategory[];
}

/**
 * Filters for the gallery, which are NOT the library's own categories.
 *
 * Knees and elbows have one and two sheets between them; as separate filters
 * they would be two chips that barely change the grid. Paired up they make a
 * third of a reasonable size, and "what you hit with up close" is how someone
 * would group them anyway. The categories with nothing shot never appear here
 * at all, so no filter can ever come back empty.
 */
export const SPRITE_GROUPS: SpriteGroup[] = [
  { key: "punches", label: "Punches", categories: ["punches"] },
  { key: "kicks", label: "Kicks", categories: ["kicks"] },
  { key: "close", label: "Knees & Elbows", categories: ["knees", "elbows"] },
  { key: "defense", label: "Defence", categories: ["defense"] },
];
