// ===========================================================================
// Drawing real combinations out of the app for a guided level.
// ---------------------------------------------------------------------------
// Hand-authoring a handful of combos per level makes the combination round
// repetitive, and it misses the obvious permutations — "2 3", "1 1", "3 3 3",
// "2 3 2" — that the app already contains across its nineteen style groups.
//
// So instead of writing more, read what is already there and keep only the
// combinations a student has actually been taught: every token in the string
// must resolve to a technique introduced at or before this level.
//
// The filter is deliberately strict. A token that cannot be resolved at all
// ("Step-in", "Clinch", "Feint Teep") rejects the whole combination, because
// the entire point of the path is that nothing arrives uncued. Rejecting a
// usable combo costs variety; admitting an unknown one costs the beginner the
// exact cliff this feature exists to remove.
// ===========================================================================

import { INITIAL_TECHNIQUES } from "@/constants/techniques";
import {
  getEntryForCallout,
  normalizeCallout,
} from "@/features/learn/data/techniqueIndex";

import { cumulativeSingles, type RoadmapPath } from "./data/paths";

/**
 * Split a combination string into the individual techniques it calls.
 *
 * Comma-separated segments are the authored unit ("1 2, Right Body Kick"). A
 * segment that is nothing but digits is shorthand for a run of punches and
 * splits further; anything else is a single named technique and is kept whole,
 * so "3 to the Body" stays one token rather than becoming "3" plus noise.
 */
export function tokenizeCombo(combo: string): string[] {
  return combo
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .flatMap((segment) =>
      /^[0-9]+(\s+[0-9]+)*$/.test(segment) ? segment.split(/\s+/) : [segment]
    );
}

/** Lesson slugs for every technique taught by the end of `levelId`. */
export function taughtSlugs(path: RoadmapPath, levelId: number): Set<string> {
  const slugs = new Set<string>();
  for (const technique of cumulativeSingles(path, levelId)) {
    const entry = getEntryForCallout(technique);
    if (entry) slugs.add(entry.slug);
  }
  return slugs;
}

/**
 * True when every technique in `combo` has been taught by `levelId`.
 * Unresolvable tokens fail closed — see the note at the top of this file.
 */
export function isWithinVocabulary(
  combo: string,
  path: RoadmapPath,
  levelId: number,
  taught = taughtSlugs(path, levelId)
): boolean {
  const tokens = tokenizeCombo(combo);
  if (tokens.length === 0) return false;
  return tokens.every((token) => {
    const entry = getEntryForCallout(token);
    return entry ? taught.has(entry.slug) : false;
  });
}

/** Every distinct combination string the app ships, across all style groups. */
function allAuthoredCombos(): string[] {
  const seen = new Map<string, string>();
  for (const group of Object.values(INITIAL_TECHNIQUES)) {
    for (const combo of group.combos ?? []) {
      const text = typeof combo === "string" ? combo : (combo as any)?.text;
      if (typeof text !== "string" || !text.trim()) continue;
      const key = normalizeCallout(text);
      if (!seen.has(key)) seen.set(key, text.trim());
    }
  }
  return [...seen.values()];
}

// Computed once — the source data is static, and the filter runs per level.
const ALL_COMBOS = allAuthoredCombos();

/**
 * Combinations from the app's own style groups that this level has fully
 * taught, longest-first so the ordering is stable rather than dependent on
 * which group happened to be declared first.
 */
export function drawnCombos(path: RoadmapPath, levelId: number): string[] {
  const taught = taughtSlugs(path, levelId);
  return ALL_COMBOS.filter((combo) =>
    isWithinVocabulary(combo, path, levelId, taught)
  ).sort((a, b) => tokenizeCombo(a).length - tokenizeCombo(b).length || a.localeCompare(b));
}
