import { beforeEach, describe, expect, it } from "vitest";

import {
  POST_WORKOUT_PROMPTS_KEY,
  shouldPromptAfterWorkout,
} from "@/features/paywall/postWorkoutPrompt";

// The app runs in a browser; the test runner does not. The prompt store only
// ever does getItem/setItem, so an in-memory stand-in is enough.
function installLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

beforeEach(() => {
  installLocalStorage();
});

describe("post-workout upsell", () => {
  it("prompts after the first workout", () => {
    expect(shouldPromptAfterWorkout(1)).toBe(true);
  });

  it("never prompts twice for the same milestone", () => {
    expect(shouldPromptAfterWorkout(1)).toBe(true);
    expect(shouldPromptAfterWorkout(1)).toBe(false);
    // Re-entering the completed screen must not re-ask either.
    expect(shouldPromptAfterWorkout(1)).toBe(false);
  });

  it("stays quiet on the workout between the two milestones", () => {
    expect(shouldPromptAfterWorkout(1)).toBe(true);
    expect(shouldPromptAfterWorkout(2)).toBe(false);
    expect(shouldPromptAfterWorkout(3)).toBe(true);
  });

  it("asks twice in total, then never again", () => {
    expect(shouldPromptAfterWorkout(1)).toBe(true);
    expect(shouldPromptAfterWorkout(3)).toBe(true);
    for (const count of [4, 5, 10, 50, 200]) {
      expect(shouldPromptAfterWorkout(count), `after ${count}`).toBe(false);
    }
  });

  it("spends both prompts when the count jumps past them", () => {
    // A restore can grow the history by more than one at a time. The user gets
    // the prompt they are due, but not one now and another next session.
    expect(shouldPromptAfterWorkout(9)).toBe(true);
    expect(shouldPromptAfterWorkout(10)).toBe(false);
  });

  it("ignores a count that is not a real workout total", () => {
    expect(shouldPromptAfterWorkout(0)).toBe(false);
    expect(shouldPromptAfterWorkout(-1)).toBe(false);
    expect(shouldPromptAfterWorkout(Number.NaN)).toBe(false);
    // None of those may burn a prompt.
    expect(shouldPromptAfterWorkout(1)).toBe(true);
  });

  it("survives a corrupted flag rather than prompting forever", () => {
    localStorage.setItem(POST_WORKOUT_PROMPTS_KEY, "nonsense,,x");
    expect(shouldPromptAfterWorkout(1)).toBe(true);
    expect(shouldPromptAfterWorkout(1)).toBe(false);
  });
});
