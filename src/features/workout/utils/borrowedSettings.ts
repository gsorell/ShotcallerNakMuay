// ===========================================================================
// Settings a guided level borrows from the user.
// ---------------------------------------------------------------------------
// A roadmap level pins its own rounds, round length, rest, cadence, ordering
// and (lack of) style selection. Three of those — roundsCount, roundMin,
// restMinutes — are written straight through to localStorage by
// `useWorkoutSettings`, so overwriting them without putting them back does not
// just affect the current session: it permanently replaces the user's saved
// setup with the level's.
//
// Keeping the list in one place is the point. The failure mode is somebody
// adding a new pinned setting to `startRoadmapLevel` and forgetting to park it;
// `borrowedSettings.test.ts` compares this list against what the provider
// actually overwrites, so that omission fails the build instead of quietly
// eating someone's round length.
// ===========================================================================

import type { Difficulty, EmphasisKey } from "@/types";

export interface ParkedSettings {
  selectedEmphases: Record<EmphasisKey, boolean>;
  addCalisthenics: boolean;
  readInOrder: boolean;
  difficulty: Difficulty;
  roundsCount: number;
  roundMin: number;
  restMinutes: number;
}

/** Every setting a guided level is allowed to borrow. */
export const BORROWED_SETTING_KEYS = [
  "selectedEmphases",
  "addCalisthenics",
  "readInOrder",
  "difficulty",
  "roundsCount",
  "roundMin",
  "restMinutes",
] as const;

/** Minimal shape of `useWorkoutSettings` that these two functions touch. */
export interface BorrowableSettings {
  selectedEmphases: Record<EmphasisKey, boolean>;
  addCalisthenics: boolean;
  readInOrder: boolean;
  difficulty: Difficulty;
  roundsCount: number;
  roundMin: number;
  restMinutes: number;
  setSelectedEmphases: (v: Record<EmphasisKey, boolean>) => void;
  setAddCalisthenics: (v: boolean) => void;
  setReadInOrder: (v: boolean) => void;
  setDifficulty: (v: Difficulty) => void;
  setRoundsCount: (v: number) => void;
  setRoundMin: (v: number) => void;
  setRestMinutes: (v: number) => void;
}

export function snapshotSettings(s: BorrowableSettings): ParkedSettings {
  return {
    // Copied, not referenced: the live object is mutated as the level runs.
    selectedEmphases: { ...s.selectedEmphases },
    addCalisthenics: s.addCalisthenics,
    readInOrder: s.readInOrder,
    difficulty: s.difficulty,
    roundsCount: s.roundsCount,
    roundMin: s.roundMin,
    restMinutes: s.restMinutes,
  };
}

export function applySettings(
  s: BorrowableSettings,
  parked: ParkedSettings
): void {
  s.setSelectedEmphases(parked.selectedEmphases);
  s.setAddCalisthenics(parked.addCalisthenics);
  s.setReadInOrder(parked.readInOrder);
  s.setDifficulty(parked.difficulty);
  s.setRoundsCount(parked.roundsCount);
  s.setRoundMin(parked.roundMin);
  s.setRestMinutes(parked.restMinutes);
}
