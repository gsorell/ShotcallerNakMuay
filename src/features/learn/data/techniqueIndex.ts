// ===========================================================================
// Derived lookups over the technique library.
// ---------------------------------------------------------------------------
// Everything here is computed from TECHNIQUE_LIBRARY + INITIAL_TECHNIQUES at
// module load, so the "which styles drill this?" answer can never drift out of
// sync with the actual callout data. `findUncoveredCallouts()` is the guard: a
// test fails if someone adds a technique to a style without a lesson for it.
// ===========================================================================

import { INITIAL_TECHNIQUES, techniqueText } from "@/constants/techniques";
import { BASE_EMPHASIS_CONFIG } from "@/emphasisConfig";

import { spritesFor } from "./techniqueSprites";
import {
  CATEGORY_META,
  TECHNIQUE_LIBRARY,
  type LearnEntry,
  type TechniqueCategory,
} from "./techniqueLibrary";

/**
 * Callout strings are authored by hand across 19 styles, so casing and spacing
 * vary ("Left teep" vs "Left Teep"). Normalize before matching.
 */
export function normalizeCallout(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

// --- callout → lesson ------------------------------------------------------

const CALLOUT_TO_SLUG = new Map<string, string>();
for (const entry of TECHNIQUE_LIBRARY) {
  for (const match of entry.matches) {
    CALLOUT_TO_SLUG.set(normalizeCallout(match), entry.slug);
  }
}

const BY_SLUG = new Map<string, LearnEntry>(
  TECHNIQUE_LIBRARY.map((e) => [e.slug, e])
);

/**
 * Every lesson that has a silhouette, in library order.
 *
 * Derived rather than listed, so the gallery cannot drift from the sheets that
 * actually exist: adding a slug to `techniqueSprites` is the only step.
 */
export const SPRITED_ENTRIES: readonly LearnEntry[] = TECHNIQUE_LIBRARY.filter(
  (entry) => spritesFor(entry.slug).length > 0
);

export function getEntry(slug: string): LearnEntry | undefined {
  return BY_SLUG.get(slug);
}

/** Resolve any raw callout string (e.g. "Left teep", "1") to its lesson. */
export function getEntryForCallout(callout: string): LearnEntry | undefined {
  const slug = CALLOUT_TO_SLUG.get(normalizeCallout(callout));
  return slug ? BY_SLUG.get(slug) : undefined;
}

// --- category grouping -----------------------------------------------------

export const ENTRIES_BY_CATEGORY: Record<TechniqueCategory, LearnEntry[]> =
  CATEGORY_META.reduce(
    (acc, meta) => {
      acc[meta.key] = TECHNIQUE_LIBRARY.filter((e) => e.category === meta.key);
      return acc;
    },
    {} as Record<TechniqueCategory, LearnEntry[]>
  );

export function countInCategory(category: TechniqueCategory): number {
  return ENTRIES_BY_CATEGORY[category]?.length ?? 0;
}

// --- lesson → styles that drill it -----------------------------------------

export interface StyleRef {
  key: string;
  label: string;
}

/**
 * Which styles call this technique out. Derived from the `singles` lists in
 * INITIAL_TECHNIQUES — combos are excluded because a combo string like
 * "1 2, Right Body Kick" is a sequence, not a single technique, and matching
 * against it would attribute the lesson to nearly every style.
 */
/**
 * Style keys that exist in the technique data but are NOT selectable tiles.
 * `calisthenics` is mixed in via the "Add Calisthenics" advanced setting
 * rather than chosen as an emphasis (see `useEmphasisList`), so offering it as
 * a "drill this" target would select a style the user has no tile for.
 */
const NON_SELECTABLE_STYLES = new Set(["calisthenics"]);

const STYLES_BY_SLUG: Map<string, StyleRef[]> = (() => {
  const map = new Map<string, StyleRef[]>();

  for (const [styleKey, style] of Object.entries(INITIAL_TECHNIQUES)) {
    if (NON_SELECTABLE_STYLES.has(styleKey)) continue;

    const label =
      style.title ?? BASE_EMPHASIS_CONFIG[styleKey]?.label ?? styleKey;

    // A style may hit the same lesson via several callouts ("Left Teep" and
    // "Right Teep" both map to `teep`) — only list the style once.
    const slugs = new Set<string>();
    for (const single of style.singles ?? []) {
      const slug = CALLOUT_TO_SLUG.get(normalizeCallout(techniqueText(single)));
      if (slug) slugs.add(slug);
    }

    for (const slug of slugs) {
      const list = map.get(slug);
      if (list) list.push({ key: styleKey, label });
      else map.set(slug, [{ key: styleKey, label }]);
    }
  }

  return map;
})();

/** Selectable styles that drill this technique. */
export function getStylesForEntry(slug: string): StyleRef[] {
  return STYLES_BY_SLUG.get(slug) ?? [];
}

/**
 * True when the only place this technique appears is the calisthenics pool —
 * i.e. it cannot be drilled by picking a style, only by enabling the
 * "Add Calisthenics" advanced setting.
 */
export function isCalisthenicsOnly(slug: string): boolean {
  if (getStylesForEntry(slug).length > 0) return false;

  const entry = BY_SLUG.get(slug);
  if (!entry) return false;

  const wanted = new Set(entry.matches.map(normalizeCallout));
  const pool = INITIAL_TECHNIQUES["calisthenics"]?.singles ?? [];
  return pool.some((single) => wanted.has(normalizeCallout(techniqueText(single))));
}

// --- coverage guard --------------------------------------------------------

/**
 * Every `singles` callout across every style that no library entry explains.
 * Should always be empty — see `learnCoverage.test.ts`.
 */
export function findUncoveredCallouts(): string[] {
  const uncovered = new Set<string>();

  for (const style of Object.values(INITIAL_TECHNIQUES)) {
    for (const single of style.singles ?? []) {
      const text = techniqueText(single);
      if (!CALLOUT_TO_SLUG.has(normalizeCallout(text))) {
        uncovered.add(text);
      }
    }
  }

  return [...uncovered].sort();
}

/**
 * Library entries whose `matches` never appear in any style's `singles`.
 * Not an error on its own (a lesson can be ahead of the callout data), but a
 * useful signal that a `matches` string has a typo.
 */
export function findOrphanedEntries(): string[] {
  const used = new Set<string>();
  for (const style of Object.values(INITIAL_TECHNIQUES)) {
    for (const single of style.singles ?? []) {
      const slug = CALLOUT_TO_SLUG.get(normalizeCallout(techniqueText(single)));
      if (slug) used.add(slug);
    }
  }
  return TECHNIQUE_LIBRARY.filter((e) => !used.has(e.slug))
    .map((e) => e.slug)
    .sort();
}

export const TOTAL_LESSON_COUNT = TECHNIQUE_LIBRARY.length;
