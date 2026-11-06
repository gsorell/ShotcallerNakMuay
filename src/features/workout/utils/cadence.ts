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

// ---------------------------------------------------------------------------
// The rest after a callout on a steady-pace round.
//
// A callout's measured duration runs from speak() to the voice's `onend`, and
// that is not all speech: desktop voices hold on to the end of everything they
// say — the Microsoft voices in Chrome for close to a second, so a bare
// "Check" measures 1.3s. Sized straight off that duration, a single elbow
// earned more than two seconds of rest on top of the second of silence the
// voice had already left, and read as the app having hung.
//
// So the tail is measured — from single-word callouts, which are almost all
// tail — and taken out twice: from the duration before it is counted as work,
// and from the rest, because the user has already heard it as silence.
// ---------------------------------------------------------------------------

/** About how long a single short word takes to say. */
export const SPOKEN_WORD_MS = 400;
/** The most tail ever assumed, so one stalled `onend` cannot skew the pace. */
const MAX_VOICE_TAIL_MS = 1200;
/** The least time between `onend` and the next callout. */
export const MIN_REST_AFTER_SPEECH_MS = 250;

/**
 * The silence a voice leaves after it has finished speaking, from the shortest
 * single-word callout it has said. Null — nothing measured yet — assumes none.
 */
export function voiceTailMs(shortestWordMs: number | null): number {
  if (shortestWordMs == null || !Number.isFinite(shortestWordMs)) return 0;
  return Math.min(
    MAX_VOICE_TAIL_MS,
    Math.max(0, shortestWordMs - SPOKEN_WORD_MS)
  );
}

/**
 * How long to wait after a callout's `onend` before the next one.
 *
 * The silence the user hears is the voice's tail plus this wait. That silence
 * starts at a single technique's rest and grows by half of whatever was said
 * beyond one word, so a long combination gets time to be thrown — up to a
 * ceiling short of the difficulty's interval. `pace` stretches or tightens it,
 * as `paceFactors` in utils/roundPlan sets per round.
 */
export function restAfterCalloutMs({
  durationMs,
  tailMs,
  baseDelayMs,
  pace = 1,
}: {
  durationMs: number;
  tailMs: number;
  baseDelayMs: number;
  pace?: number;
}): number {
  const work = Math.max(0, durationMs - tailMs - SPOKEN_WORD_MS);
  const silence = Math.min(
    baseDelayMs * 0.85,
    baseDelayMs * 0.45 + work * 0.5
  );
  const scaled = Number.isFinite(pace) && pace > 0 ? silence * pace : silence;
  const rest = Math.round(scaled - tailMs);
  // Guarded like rampedIntervalMs: a NaN delay fires at once and runs away.
  return Number.isFinite(rest)
    ? Math.max(MIN_REST_AFTER_SPEECH_MS, rest)
    : MIN_REST_AFTER_SPEECH_MS;
}
