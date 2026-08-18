// ===========================================================================
// Time spent actually working in the current round.
// ---------------------------------------------------------------------------
// Drives the pace ramp, so it has to measure time the round was *running*, not
// wall-clock time since the bell. Pausing to catch your breath must not advance
// the ramp, and resuming must drop you back in where you left off rather than
// at either extreme.
//
// Kept as plain functions over a plain object so the accounting can be tested
// without a React tree — this is exactly the kind of ref juggling that breaks
// silently and only shows up as "the pace feels wrong sometimes".
// ===========================================================================

export interface RoundStopwatch {
  /** Work banked from segments that have already ended. */
  bankedMs: number;
  /**
   * When the current running segment began, or null when not running.
   *
   * Null rather than 0: zero is a legitimate timestamp, and a sentinel that
   * can collide with real data is a bug waiting for the one caller that passes
   * it.
   */
  segmentStartedAt: number | null;
}

export const createRoundStopwatch = (): RoundStopwatch => ({
  bankedMs: 0,
  segmentStartedAt: null,
});

/** Close the current segment, keeping the work it contributed. Idempotent. */
export function bankSegment(sw: RoundStopwatch, now: number): void {
  if (sw.segmentStartedAt === null) return;
  sw.bankedMs += Math.max(0, now - sw.segmentStartedAt);
  sw.segmentStartedAt = null;
}

/** Begin (or resume) running. Banked work is kept. */
export function startSegment(sw: RoundStopwatch, now: number): void {
  bankSegment(sw, now);
  sw.segmentStartedAt = now;
}

/** A new round: throw the banked work away and start counting again. */
export function resetRound(sw: RoundStopwatch, now: number): void {
  sw.bankedMs = 0;
  sw.segmentStartedAt = now;
}

/** Work done in this round so far, excluding any time spent paused. */
export function elapsedMs(sw: RoundStopwatch, now: number): number {
  const live =
    sw.segmentStartedAt === null
      ? 0
      : Math.max(0, now - sw.segmentStartedAt);
  return sw.bankedMs + live;
}
