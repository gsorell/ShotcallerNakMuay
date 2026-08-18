import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  BORROWED_SETTING_KEYS,
  applySettings,
  snapshotSettings,
  type BorrowableSettings,
} from "@/features/workout/utils/borrowedSettings";

function fakeSettings(): BorrowableSettings {
  const state: any = {
    selectedEmphases: { mat: true, tae: true },
    addCalisthenics: true,
    readInOrder: false,
    difficulty: "hard",
    roundsCount: 5,
    roundMin: 3,
    restMinutes: 2,
  };
  return {
    ...state,
    get selectedEmphases() {
      return state.selectedEmphases;
    },
    setSelectedEmphases: (v: any) => (state.selectedEmphases = v),
    setAddCalisthenics: (v: any) => (state.addCalisthenics = v),
    setReadInOrder: (v: any) => (state.readInOrder = v),
    setDifficulty: (v: any) => (state.difficulty = v),
    setRoundsCount: (v: any) => (state.roundsCount = v),
    setRoundMin: (v: any) => (state.roundMin = v),
    setRestMinutes: (v: any) => (state.restMinutes = v),
    _state: state,
  } as any;
}

describe("settings a guided level borrows", () => {
  it("hands back everything a level overwrites", () => {
    const s = fakeSettings();
    const parked = snapshotSettings(s);

    // What startRoadmapLevel does to the user's configuration.
    s.setSelectedEmphases({} as any);
    s.setAddCalisthenics(false);
    s.setReadInOrder(true);
    s.setDifficulty("easy");
    s.setRoundsCount(3);
    s.setRoundMin(1);
    s.setRestMinutes(1);

    applySettings(s, parked);

    const after = (s as any)._state;
    expect(after.selectedEmphases).toEqual({ mat: true, tae: true });
    expect(after.addCalisthenics).toBe(true);
    expect(after.readInOrder).toBe(false);
    expect(after.difficulty).toBe("hard");
    // The three that persist to localStorage — the ones that would otherwise
    // permanently replace the user's saved setup with the level's.
    expect(after.roundsCount).toBe(5);
    expect(after.roundMin).toBe(3);
    expect(after.restMinutes).toBe(2);
  });

  it("copies the emphasis map rather than holding a reference to it", () => {
    const s = fakeSettings();
    const parked = snapshotSettings(s);
    // A level clears the live selection; the snapshot must not follow.
    (s as any)._state.selectedEmphases.mat = false;
    expect(parked.selectedEmphases.mat).toBe(true);
  });

  it("parks every setting the provider actually pins", () => {
    // The failure this guards: someone adds a pinned setting to
    // startRoadmapLevel and forgets to park it, so it leaks out of the level.
    const provider = readFileSync(
      resolve(
        __dirname,
        "../features/workout/contexts/WorkoutProvider.tsx"
      ),
      "utf8"
    );
    // `const pauseSession =` rather than `const pauseSession`, which would
    // match the `pauseSessionRef` declared far earlier and slice backwards.
    const from = provider.indexOf("const startRoadmapLevel");
    const to = provider.indexOf("const pauseSession =");
    expect(from, "startRoadmapLevel not found").toBeGreaterThan(-1);
    expect(to, "pauseSession not found after it").toBeGreaterThan(from);
    const launcher = provider.slice(from, to);

    const setterToKey: Record<string, string> = {
      setSelectedEmphases: "selectedEmphases",
      clearAllEmphases: "selectedEmphases",
      setAddCalisthenics: "addCalisthenics",
      setReadInOrder: "readInOrder",
      setDifficulty: "difficulty",
      setRoundsCount: "roundsCount",
      setRoundMin: "roundMin",
      setRestMinutes: "restMinutes",
      setVoiceSpeed: "voiceSpeed",
      setSouthpawMode: "southpawMode",
    };

    const unparked = Object.entries(setterToKey)
      .filter(([setter]) => launcher.includes(`settings.${setter}(`))
      .map(([, key]) => key)
      .filter((key) => !BORROWED_SETTING_KEYS.includes(key as never));

    expect(
      [...new Set(unparked)],
      "these are pinned by a guided level but never restored afterwards"
    ).toEqual([]);
  });
});
