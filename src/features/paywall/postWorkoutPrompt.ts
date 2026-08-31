/**
 * When to ask a free user to go Pro after a workout.
 *
 * The onboarding ask lands before the user has thrown a single punch, which is
 * the weakest possible moment: nothing has been demonstrated yet, so the offer
 * is abstract. The strongest moment is the end of a workout — the product just
 * did its job, and the charm they can't claim is on screen.
 *
 * Two prompts, at workout 1 and workout 3, each fired once ever. One is too
 * few to catch someone who wasn't ready; a prompt after every session is how a
 * training app becomes one the user deletes.
 */

const PROMPT_AT_WORKOUT_COUNTS = [1, 3] as const;

/** Which prompts have already fired, as a comma-separated list of counts. */
export const POST_WORKOUT_PROMPTS_KEY = "shotcaller_post_workout_prompts";

function readFired(): number[] {
  try {
    const raw = localStorage.getItem(POST_WORKOUT_PROMPTS_KEY);
    if (!raw) return [];
    return raw
      .split(",")
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n));
  } catch {
    return [];
  }
}

function markFired(count: number): void {
  try {
    const next = Array.from(new Set([...readFired(), count]));
    localStorage.setItem(POST_WORKOUT_PROMPTS_KEY, next.join(","));
  } catch {
    /* ignore — a lost flag costs at most one extra prompt */
  }
}

/**
 * Whether to open the paywall now, given how many workouts the user has
 * completed in total (including the one just finished).
 *
 * Uses `>=` rather than `===` so a user whose count jumps past a threshold
 * still gets the prompt: histories can grow by more than one at a time after a
 * restore, and a missed milestone would otherwise mean no prompt at all.
 */
export function shouldPromptAfterWorkout(workoutCount: number): boolean {
  if (!Number.isFinite(workoutCount) || workoutCount < 1) return false;
  const fired = readFired();
  const due = PROMPT_AT_WORKOUT_COUNTS.filter(
    (threshold) => workoutCount >= threshold && !fired.includes(threshold)
  );
  if (due.length === 0) return false;
  // Claim every threshold this workout satisfies, not just the first, so a
  // jump from 0 to 4 workouts spends both prompts rather than firing one now
  // and another on the very next session.
  due.forEach(markFired);
  return true;
}
