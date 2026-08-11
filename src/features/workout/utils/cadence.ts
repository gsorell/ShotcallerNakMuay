// ===========================================================================
// How fast callouts come.
// ---------------------------------------------------------------------------
// One table, so the pace a difficulty means, the floor nothing may fall below,
// and the ramp a guided round follows can never drift apart.
// ===========================================================================

/** Callouts per minute at each difficulty. */
export const CADENCE_PER_MIN = { easy: 20, medium: 26, hard: 42 } as const;

/**
 * The slowest a callout may ever be scheduled on a varied-cadence round.
 * Novice is the floor of the app's own scale, and dead air reads as the app
 * having stopped — especially inside a one-minute guided round.
 */
export const SLOWEST_INTERVAL_MS = Math.round(60000 / CADENCE_PER_MIN.easy);

/**
 * Interval between callouts a given fraction of the way through a guided round.
 *
 * Each round opens at novice pace and finishes near amateur. Inside a single
 * minute that arc does the teaching by itself: slow enough at the bell to think
 * about the shape of the movement, brisk enough by the end that you are
 * reacting rather than composing. It also gives a one-minute round somewhere to
 * go, which a flat pace does not.
 *
 * Progress is clamped, so it never runs past amateur however long a round is.
 */
export function rampedIntervalMs(progress: number): number {
  // Clamped defensively rather than optimistically: Math.min/max propagate NaN,
  // and a NaN interval becomes setTimeout(NaN), which fires immediately and
  // turns the callout chain into a runaway loop.
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const cadence =
    CADENCE_PER_MIN.easy + (CADENCE_PER_MIN.medium - CADENCE_PER_MIN.easy) * p;
  return 60000 / cadence;
}
