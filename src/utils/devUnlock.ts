// ===========================================================================
// Dev-only review switch.
// ---------------------------------------------------------------------------
// Reviewing the Learn and roadmap content means walking every lesson and every
// level, which the real gating deliberately prevents: lessons are Pro, and a
// level opens only once the one before it is cleared. Clearing ten levels to
// look at level ten is not a review, it is a workout.
//
// `import.meta.env.DEV` is a literal that Vite replaces at build time, so this
// whole branch is dead code in a production bundle — it cannot ship enabled.
//
// To check the REAL gating while in dev, run this in the console and reload:
//   localStorage.setItem("nmsc-dev-respect-locks", "1")
// ===========================================================================

const RESPECT_LOCKS_KEY = "nmsc-dev-respect-locks";

function respectingLocks(): boolean {
  try {
    return localStorage.getItem(RESPECT_LOCKS_KEY) === "1";
  } catch {
    // Private mode, blocked storage: fall back to unlocking, since the only
    // context this runs in at all is a developer's own machine.
    return false;
  }
}

/**
 * True when dev should ignore Pro gating and level locks.
 *
 * Vitest also runs with DEV set, and the suite asserts the real rules — that
 * only level one starts open, and that clearing a level opens the next. An
 * unlock-everything switch turns those assertions green for the wrong reason,
 * so test mode is excluded explicitly.
 */
export function devUnlockAll(): boolean {
  if (import.meta.env.MODE === "test") return false;
  return import.meta.env.DEV && !respectingLocks();
}

// ---------------------------------------------------------------------------

const FAST_ROUNDS_KEY = "nmsc-dev-fast-rounds";

/**
 * True when a guided level should run short rounds.
 *
 * Reviewing the screens BETWEEN rounds means training through the rounds
 * first: the rest panel that shows what the combination round holds does not
 * appear until two full minutes in, which is a slow way to look at a panel and
 * a slower way to change one.
 *
 * Only the rounds shrink. Rest stays at its real thirty seconds, because rest
 * is usually the thing being reviewed and "can this be read in the time
 * available" is most of the question.
 *
 * Opt in from the console and start a level:
 *   localStorage.setItem("nmsc-dev-fast-rounds", "1")
 *
 * Dev-only, like devUnlockAll — `import.meta.env.DEV` is a build-time literal,
 * so this cannot ship enabled.
 */
export function devFastRounds(): boolean {
  if (import.meta.env.MODE === "test") return false;
  if (!import.meta.env.DEV) return false;
  try {
    return localStorage.getItem(FAST_ROUNDS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Round length in minutes for a guided level, honouring the dev switch. */
export function devRoundMin(roundMin: number): number {
  return devFastRounds() ? 0.15 : roundMin;
}
