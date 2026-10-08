import { beforeEach, describe, expect, it } from "vitest";

import { WORKOUTS_STORAGE_KEY } from "@/constants/storage";
import {
  REVIEW_PROMPT_KEY,
  markReviewAsked,
  markReviewDone,
  shouldAskForReview,
} from "@/features/review/reviewPrompt";

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

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-08T18:00:00").getTime();

/** `count` finished workouts, one per day, the latest of them today. */
function finishedWorkouts(count: number, overrides: object = {}) {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(NOW - i * DAY_MS).toISOString(),
    roundsPlanned: 3,
    roundsCompleted: 3,
    status: "completed",
    ...overrides,
  }));
}

function setHistory(logs: object[]) {
  localStorage.setItem(WORKOUTS_STORAGE_KEY, JSON.stringify(logs));
}

beforeEach(() => {
  installLocalStorage();
});

describe("store rating ask", () => {
  it("waits for the fifth finished workout", () => {
    setHistory(finishedWorkouts(4));
    expect(shouldAskForReview(NOW)).toBe(false);
    setHistory(finishedWorkouts(5));
    expect(shouldAskForReview(NOW)).toBe(true);
  });

  it("does not count workouts that were stopped early", () => {
    setHistory([
      ...finishedWorkouts(4),
      ...finishedWorkouts(6, { status: "abandoned", roundsCompleted: 1 }),
    ]);
    expect(shouldAskForReview(NOW)).toBe(false);
  });

  it("judges entries from before status existed by their rounds", () => {
    setHistory(finishedWorkouts(5, { status: undefined }));
    expect(shouldAskForReview(NOW)).toBe(true);
    setHistory(finishedWorkouts(5, { status: undefined, roundsCompleted: 2 }));
    expect(shouldAskForReview(NOW)).toBe(false);
  });

  it("needs more than one day of training", () => {
    const today = new Date(NOW).toISOString();
    setHistory(finishedWorkouts(5).map((w) => ({ ...w, timestamp: today })));
    expect(shouldAskForReview(NOW)).toBe(false);
  });

  it("spends nothing until the ask is actually made", () => {
    setHistory(finishedWorkouts(5));
    expect(shouldAskForReview(NOW)).toBe(true);
    expect(shouldAskForReview(NOW)).toBe(true);
    markReviewAsked(NOW);
    expect(shouldAskForReview(NOW)).toBe(false);
  });

  it("asks a second time only at twenty workouts and sixty days on", () => {
    setHistory(finishedWorkouts(5));
    markReviewAsked(NOW);

    setHistory(finishedWorkouts(19));
    expect(shouldAskForReview(NOW + 90 * DAY_MS)).toBe(false);

    setHistory(finishedWorkouts(20));
    expect(shouldAskForReview(NOW + 59 * DAY_MS)).toBe(false);
    expect(shouldAskForReview(NOW + 60 * DAY_MS)).toBe(true);
  });

  it("asks twice in total, then never again", () => {
    setHistory(finishedWorkouts(200));
    markReviewAsked(NOW);
    markReviewAsked(NOW + 60 * DAY_MS);
    expect(shouldAskForReview(NOW + 1000 * DAY_MS)).toBe(false);
  });

  it("holds a long-time user's second ask back by the same gap", () => {
    // Already past both thresholds on the day the feature ships.
    setHistory(finishedWorkouts(40));
    expect(shouldAskForReview(NOW)).toBe(true);
    markReviewAsked(NOW);
    expect(shouldAskForReview(NOW + DAY_MS)).toBe(false);
    expect(shouldAskForReview(NOW + 60 * DAY_MS)).toBe(true);
  });

  it("never asks once the user has gone to the store themselves", () => {
    setHistory(finishedWorkouts(40));
    markReviewDone();
    expect(shouldAskForReview(NOW)).toBe(false);
    // Marking it done must not lose track of an ask already made.
    markReviewAsked(NOW);
    expect(shouldAskForReview(NOW + 1000 * DAY_MS)).toBe(false);
  });

  it("survives a corrupted flag rather than asking forever", () => {
    setHistory(finishedWorkouts(5));
    localStorage.setItem(REVIEW_PROMPT_KEY, "nonsense");
    expect(shouldAskForReview(NOW)).toBe(true);
    markReviewAsked(NOW);
    expect(shouldAskForReview(NOW)).toBe(false);
  });
});
