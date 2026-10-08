/**
 * When to ask for a store rating.
 *
 * The ask is the OS's own rating sheet, not a dialog of ours, and neither
 * store reports back whether it was shown or what the user did with it. So
 * "stop once it has done the job" cannot be detected — it is a budget kept
 * here instead: two asks in the life of an install, a long way apart, and none
 * at all once the user has gone to the store from the menu themselves.
 *
 * The audience is someone who keeps coming back. Five finished workouts on at
 * least two different days is past the paywall asks at workouts 1 and 3, and
 * past the point where the app is still being tried out.
 */

import { WORKOUTS_STORAGE_KEY } from "@/constants/storage";

/** Finished workouts needed before the first ask, and before the second. */
const ASK_AT_COMPLETED_WORKOUTS = [5, 20] as const;
const MIN_TRAINING_DAYS = 2;
const MIN_DAYS_BETWEEN_ASKS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export const REVIEW_PROMPT_KEY = "shotcaller_review_prompt";

interface ReviewPromptState {
  /** When each ask was made, in ms. Its length is the budget spent. */
  askedAt: number[];
  /** The user opened the store's review page themselves; never ask again. */
  done: boolean;
}

function readState(): ReviewPromptState {
  try {
    const parsed = JSON.parse(localStorage.getItem(REVIEW_PROMPT_KEY) ?? "{}");
    return {
      askedAt: Array.isArray(parsed?.askedAt)
        ? parsed.askedAt.filter((n: unknown) => Number.isFinite(n))
        : [],
      done: parsed?.done === true,
    };
  } catch {
    return { askedAt: [], done: false };
  }
}

function writeState(state: ReviewPromptState): void {
  try {
    localStorage.setItem(REVIEW_PROMPT_KEY, JSON.stringify(state));
  } catch {
    /* ignore — a lost flag costs at most one extra ask, and the OS caps those */
  }
}

/**
 * Timestamps of the sessions that were finished rather than stopped early.
 *
 * Entries from before `status` existed are judged the way the Workout Logs
 * judge them: all planned rounds done.
 */
function readFinishedSessions(): number[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(WORKOUTS_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return (parsed as Array<Record<string, unknown> | null>)
      .filter((p) =>
        p?.["status"]
          ? p["status"] === "completed"
          : Number(p?.["roundsCompleted"]) >= Number(p?.["roundsPlanned"])
      )
      .map((p) => new Date(String(p?.["timestamp"])).getTime())
      .filter((t: number) => Number.isFinite(t));
  } catch {
    return [];
  }
}

/**
 * Whether the user is due an ask right now. Reads only; nothing is spent until
 * `markReviewAsked`, so a check that is followed by the user leaving the
 * screen costs them nothing.
 *
 * One threshold per ask rather than every threshold the count satisfies: a
 * long-time user who is already past both still gets the two asks, but the
 * second waits out the gap like anyone else's.
 */
export function shouldAskForReview(now: number = Date.now()): boolean {
  const { askedAt, done } = readState();
  if (done) return false;

  const threshold = ASK_AT_COMPLETED_WORKOUTS[askedAt.length];
  if (threshold === undefined) return false;

  const lastAsk = askedAt[askedAt.length - 1];
  if (lastAsk !== undefined && now - lastAsk < MIN_DAYS_BETWEEN_ASKS * DAY_MS) {
    return false;
  }

  const finished = readFinishedSessions();
  if (finished.length < threshold) return false;

  const trainingDays = new Set(finished.map((t) => new Date(t).toDateString()));
  return trainingDays.size >= MIN_TRAINING_DAYS;
}

export function markReviewAsked(now: number = Date.now()): void {
  const state = readState();
  writeState({ ...state, askedAt: [...state.askedAt, now] });
}

export function markReviewDone(): void {
  writeState({ ...readState(), done: true });
}
