// ===========================================================================
// Combinations, resolved down to the sheets that can draw them.
// ---------------------------------------------------------------------------
// A lesson page shows one technique thrown from guard and returning to guard.
// That is the honest way to teach a shape and a useless way to answer the
// question the page leaves hanging: fine, now what do I do with it? These are
// the answer — the combinations the guided path already drills, each resolved
// into a run of sheets so a player can walk them end to end.
//
// NOTHING IS AUTHORED HERE. The strings come from the levels in
// `roadmap/data/paths`, the tokens resolve through the same callout matching
// the speaker uses, and the sheets come from `techniqueSprites`. Writing a
// second list of combinations would be a list that drifts; this one cannot say
// anything the app does not already say out loud.
//
// The path's own combos rather than `drawnCombos`, which pulls every
// combination the nineteen style groups contain. Those are drawn to fill a
// round with variety. These were written to teach, they arrive in teaching
// order, and each one knows the level it belongs to.
// ===========================================================================

import { FOUNDATIONS } from "@/features/roadmap/data/paths";
import { tokenizeCombo } from "@/features/roadmap/vocabulary";

import { getEntry, getEntryForCallout, normalizeCallout } from "./techniqueIndex";
import type { TechniqueCategory } from "./techniqueLibrary";
import { spritesFor, type SpriteVariant } from "./techniqueSprites";

/** One technique in a combination — a token, and the sheet that draws it. */
export interface ComboBeat {
  /**
   * The callout, exactly as the app says it: "1", "Left Teep", "Slip".
   *
   * Printed verbatim under the figure, never rewritten into the side the
   * sheet happens to show — see the side resolution below for why that
   * distinction matters.
   */
  token: string;
  /** The lesson this beat teaches. */
  slug: string;
  /** Which of that lesson's sheets, by position in `spritesFor`. */
  variantIndex: number;
  /** The sheet itself, so a player needs no second lookup per frame. */
  variant: SpriteVariant;
}

export interface Combination {
  /** Unique, and stable across renders — the normalized label. */
  key: string;
  /** The authored string: "1 2, Body Kick". */
  label: string;
  /** The level that introduces it. */
  levelId: number;
  bonus: boolean;
  beats: ComboBeat[];
  /**
   * Every category the combination touches, so the shelf's own filter can
   * narrow this row along with the grid under it.
   *
   * A combination belongs to a category if ANY of its techniques does, which
   * is why they overlap — "2 3, Low Kick" is a punching combination and a
   * kicking one, and filtering to either should keep it. The alternative,
   * filing each under one category, would hide the combinations that cross
   * from a category to the very techniques that make them worth showing.
   */
  categories: ReadonlySet<TechniqueCategory>;
}

/**
 * The side named in a callout, if it names one.
 *
 * Word-bounded so "Overhand" does not read as a right and "Lean Back" does not
 * read as a lead.
 */
const SIDE = /\b(left|right|lead|rear)\b/i;

/**
 * The sheet a single callout should draw.
 *
 * Most tokens are easy: the lesson has one sheet and that is the one. The work
 * is in the six lessons shot from both sides, where the token itself says
 * which side — and says it in two different vocabularies.
 *
 * The teep, the check, the knees and the elbows are labelled Lead and Rear,
 * because which leg or arm does the work is the whole content of the pair. The
 * callouts for them are written Left and Right. Resolving one against the
 * other is the one place this file takes a position: THE LIBRARY IS WRITTEN
 * ORTHODOX, so a left teep is the lead teep. That holds for a southpaw too,
 * because they are looking at a mirrored picture under a mirrored name — the
 * lead teep is still the lead teep whichever way you stand, and
 * `mirrorTechnique` flips the words on the way to the screen and the speaker
 * alike. Resolve orthodox, display mirrored; never the other way round.
 *
 * The slip and the roll are labelled Left and Right, because for those the
 * direction IS the technique, and their callouts match straight across.
 *
 * A handful of callouts name a paired lesson and no side at all — "Slip",
 * "Elbow", "Up Elbow". Those fall back to the first sheet, which is a guess.
 * It is a guess the reader is never told is anything else: the beat prints the
 * token it was given, so a combination that says "Slip" says "Slip" under a
 * figure slipping one particular way, rather than claiming a "Slip Left" the
 * app never called.
 */
export function beatFor(token: string): ComboBeat | null {
  const entry = getEntryForCallout(token);
  if (!entry) return null;

  const sheets = spritesFor(entry.slug);
  if (sheets.length === 0) return null;

  const variantIndex = sheets.length === 1 ? 0 : sideIndex(token, sheets);
  const variant = sheets[variantIndex];
  if (!variant) return null;

  return { token, slug: entry.slug, variantIndex, variant };
}

function sideIndex(token: string, sheets: SpriteVariant[]): number {
  const named = token.match(SIDE)?.[1]?.toLowerCase();
  if (!named) return 0;

  // Which vocabulary this pair is labelled in, taken from the sheets rather
  // than from a list of slugs kept in step by hand.
  const wanted =
    sheets[0]?.label === "Lead"
      ? named === "left" || named === "lead"
        ? "Lead"
        : "Rear"
      : named === "left" || named === "lead"
        ? "Left"
        : "Right";

  const found = sheets.findIndex((sheet) => sheet.label === wanted);
  return found < 0 ? 0 : found;
}

/**
 * Every combination the path teaches that can be drawn from end to end.
 *
 * A combination with one unresolvable token is dropped whole rather than drawn
 * with a gap in it. A run of figures with a hole where a technique should be
 * teaches the wrong thing about the combination, and there is no honest way to
 * label the hole.
 *
 * Deduplicated by the callout itself, keeping the earliest level to name it —
 * "1 2" belongs to level one however many later levels drill it again.
 */
export const COMBINATIONS: Combination[] = (() => {
  const byKey = new Map<string, Combination>();

  for (const level of FOUNDATIONS.levels) {
    for (const label of level.combos) {
      const key = normalizeCallout(label);
      if (byKey.has(key)) continue;

      const beats = tokenizeCombo(label).map(beatFor);
      if (beats.length === 0 || beats.some((beat) => beat === null)) continue;

      const drawn = beats as ComboBeat[];
      byKey.set(key, {
        key,
        label,
        levelId: level.id,
        bonus: !!level.bonus,
        beats: drawn,
        categories: new Set(
          drawn
            .map((beat) => getEntry(beat.slug)?.category)
            .filter((category): category is TechniqueCategory => !!category)
        ),
      });
    }
  }

  return [...byKey.values()];
})();
