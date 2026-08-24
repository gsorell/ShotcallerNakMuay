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
