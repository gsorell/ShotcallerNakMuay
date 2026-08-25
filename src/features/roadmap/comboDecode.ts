// ===========================================================================
// Turning a combination string into the figures behind it.
// ---------------------------------------------------------------------------
// The combination round calls "1 2, Head Kick" and expects it to mean
// something. Round 2 spends a full round pairing every name with its number so
// that it can, but a number only becomes a punch once — and until it does, the
// round is asking the student to act on a code they are still decoding.
//
// This is the decode, for the one screen where looking is sanctioned: the rest
// panel before the combination round. Each beat of the combination resolves to
// its lesson, and from there to a single silhouette, so the shorthand and the
// shape sit next to each other.
//
// A beat that will not resolve still gets a slot with its text in it. The
// figure is the bonus; the running order is the point, and dropping a beat
// would silently misrepresent the combination as shorter than it is.
// ===========================================================================

import { getEntryForCallout } from "@/features/learn/data/techniqueIndex";
import {
  spritesFor,
  type SpriteVariant,
} from "@/features/learn/data/techniqueSprites";
import { mirrorTechnique } from "@/utils/textUtils";

import { ROADMAP_STYLE_KEY } from "./session";
import { tokenizeCombo } from "./vocabulary";

/** One technique in a combination, in the order it is thrown. */
export interface ComboBeat {
  /** The token as it will be called — "1", "Head Kick". */
  token: string;
  /** The lesson it resolves to, when it resolves to one. */
  slug?: string;
  /** Lesson name, for the accessible label on the figure. */
  name?: string;
  /**
   * What to print under the figure.
   *
   * A bare number is the thing that needs decoding, so it prints its lesson
   * name: "1" reads out as "Jab". Anything already spoken as words prints as
   * called, because the lesson behind it is often broader than the callout and
   * printing the lesson name throws away the half that matters — "Slip Right"
   * resolves to the Slip lesson, and captioning the figure "Slip" drops the
   * only part of it the student has to act on.
   */
  label: string;
  /** The one sheet to show for this beat. */
  sprite?: SpriteVariant;
}

export interface DecodedCombo {
  /** The combination as the student will hear it, mirrored if southpaw. */
  text: string;
  beats: ComboBeat[];
}

/**
 * Which of a paired lesson's two sheets this beat wants.
 *
 * A lesson card shows both sides because it is teaching the pair. A beat is a
 * single strike and gets a single figure, so the side has to be read out of the
 * callout itself. Sheets are labelled Lead/Rear where the two sides are the
 * same movement off different legs, and Left/Right where they are mirror
 * images; the callouts only ever say Left or Right, so both labellings are
 * matched against.
 *
 * Southpaw resolves correctly by accident of ordering: `decodeCombo` mirrors
 * the text before tokenizing, so a southpaw's "Right Teep" picks the rear
 * sheet, which is the right leg — the correct limb, filmed from the orthodox
 * stance the whole Learn section is written from.
 *
 * A callout with no side in it at all ("Up Elbow") carries no information to
 * choose with, so it takes the first sheet.
 */
function pickVariant(
  token: string,
  variants: SpriteVariant[]
): SpriteVariant | undefined {
  if (variants.length <= 1) return variants[0];

  const wanted = /\bleft\b/i.test(token)
    ? ["left", "lead"]
    : /\bright\b/i.test(token)
      ? ["right", "rear"]
      : undefined;
  if (!wanted) return variants[0];

  return (
    variants.find((v) => v.label && wanted.includes(v.label.toLowerCase())) ??
    variants[0]
  );
}

/**
 * Decode one combination.
 *
 * `southpaw` mirrors first, so everything downstream — the printed text, the
 * beat order, the side of each figure — describes the combination the student
 * will actually be told to throw rather than the one it was authored as. The
 * numbers are left alone by `mirrorTechnique` because they are stance-relative:
 * 3 is the lead hook whichever way you stand.
 */
export function decodeCombo(combo: string, southpaw = false): DecodedCombo {
  const text = southpaw ? mirrorTechnique(combo, ROADMAP_STYLE_KEY) : combo;

  const beats = tokenizeCombo(text).map((token): ComboBeat => {
    const entry = getEntryForCallout(token);
    if (!entry) return { token, label: token };
    return {
      token,
      slug: entry.slug,
      name: entry.name,
      label: /^\d+$/.test(token) ? entry.name : token,
      sprite: pickVariant(token, spritesFor(entry.slug)),
    };
  });

  return { text, beats };
}

/**
 * How many of a level's combinations the rest panel shows.
 *
 * Two, for a hard reason and a soft one.
 *
 * The hard one is vertical space. The rest screen already carries a timer set
 * in 8rem digits, and the Pause and Stop buttons sit below this panel in the
 * document. On a 390x844 phone the decoder has roughly 250px to work in before
 * it pushes Stop off the bottom of the screen, and a row costs about 117px.
 * Being unable to find Stop mid-session is a far worse failure than seeing one
 * fewer combination.
 *
 * The soft one is that thirty seconds of rest is also when you breathe. Six
 * combinations would be asking the student to study rather than glance, on the
 * screen the app spends the rest of the round telling them to look away from.
 */
export const REST_COMBO_COUNT = 2;

/** The combinations to decode for a level, in authored order. */
export function decodeCombos(
  combos: readonly string[],
  southpaw = false,
  count = REST_COMBO_COUNT
): DecodedCombo[] {
  return combos.slice(0, count).map((c) => decodeCombo(c, southpaw));
}
