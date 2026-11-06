import type { CalloutEvent } from "./calloutSignal";

/**
 * When the reel films, decided from the callout engine's timing.
 *
 * A clip should hold one whole combination and little else. People throw on
 * the first word they recognise, not when the voice finishes, so a clip that
 * starts *at* the callout misses the first strike — and resuming a paused
 * recorder takes a moment of its own. So filming starts PREROLL_MS before the
 * callout is due (the engine says when, ahead of time). It stops a short tail
 * after the voice finishes, scaled to how many strikes were called, instead
 * of running on through the standing about before the next call.
 */
export const PREROLL_MS = 600;
/** Backstop for a clip whose end never comes (speech that never finished). */
export const MAX_CLIP_MS = 7000;
/** What a clip usually runs to, for spacing them out. */
export const CLIP_MS = 3500;
/** Roughly how long the finished reel runs: short enough to post. */
export const REEL_TARGET_MS = 30000;

/**
 * How far apart clips must start so the reel's clips are spread across the
 * whole session instead of all landing in round one. Callouts come every few
 * seconds, so taking every one would just record the first half-minute.
 */
export const clipGapMs = (
  plannedWorkMs: number,
  clipMs = CLIP_MS,
  targetMs = REEL_TARGET_MS
): number => {
  const clipsWanted = Math.max(1, Math.round(targetMs / clipMs));
  return Math.max(0, plannedWorkMs / clipsWanted - clipMs);
};

/** Whether a callout due at `now` should get a clip. */
export const shouldStartClip = (s: {
  now: number;
  lastClipEnd: number;
  gapMs: number;
  recordedMs: number;
  /** Hard ceiling, for a session that runs longer than planned. */
  maxMs: number;
}): boolean => s.now - s.lastClipEnd >= s.gapMs && s.recordedMs < s.maxMs;

/** Strikes in a called phrase: "Jab, cross, left kick" is three. */
export const strikesIn = (phrase: string): number =>
  Math.max(1, phrase.split(",").filter((s) => s.trim()).length);

/**
 * How long to keep filming after the voice finishes. The last strike lands
 * a little after its name is said; a longer combination gets a little more,
 * since people fall behind the voice as it goes.
 */
export const tailAfterSpeechMs = (phrase: string): number =>
  Math.min(2500, 900 + 300 * strikesIn(phrase));

/** What the scheduler drives: the recorder, rolling or cut. */
export interface Tape {
  roll(): void;
  cut(): void;
}

export class ClipScheduler {
  recordedMs = 0;
  clips = 0;

  private rolling = false;
  private segmentStart = 0;
  private lastClipEnd = -Infinity;
  /** The next callout is to be filmed. */
  private planned = false;
  /** Rolling ahead of a planned callout that hasn't been called yet. */
  private armed = false;
  /** The clip is following a callout whose voice hasn't finished. */
  private tracking = false;
  private armTimer: ReturnType<typeof setTimeout> | null = null;
  private endTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly gapMs: number;
  private readonly maxMs: number;

  constructor(
    private readonly tape: Tape,
    plannedWorkMs: number,
    private readonly now: () => number = () => performance.now()
  ) {
    this.gapMs = clipGapMs(plannedWorkMs);
    this.maxMs = REEL_TARGET_MS + CLIP_MS * 2;
  }

  event(e: CalloutEvent): void {
    if (e.type === "scheduled") this.onScheduled(e.delayMs);
    else if (e.type === "called") this.onCalled();
    else this.onSpoken(e.phrase);
  }

  /** Paused, resting, or the round ended: stop filming and forget the plan. */
  hold(): void {
    this.clearArm();
    this.armed = false;
    this.planned = false;
    this.tracking = false;
    this.endClip();
  }

  dispose(): void {
    this.clearArm();
    this.clearEnd();
  }

  private onScheduled(delayMs: number): void {
    // Already rolling for this callout and it was pushed back (the voice
    // was still busy): keep rolling; the backstop still stands.
    if (this.armed) return;
    this.clearArm();
    const due = this.now() + delayMs;
    this.planned = this.rolling
      ? // Mid-clip: only a reel with no spacing (a short session) runs on.
        this.gapMs === 0 && this.recordedMs < this.maxMs
      : shouldStartClip({
          now: due,
          lastClipEnd: this.lastClipEnd,
          gapMs: this.gapMs,
          recordedMs: this.recordedMs,
          maxMs: this.maxMs,
        });
    if (!this.planned) return;
    this.armTimer = setTimeout(() => {
      this.armTimer = null;
      this.armed = true;
      if (!this.rolling) this.startClip();
    }, Math.max(0, delayMs - PREROLL_MS));
  }

  private onCalled(): void {
    this.clearArm();
    const wanted = this.planned || this.armed;
    this.planned = false;
    this.armed = false;
    if (this.rolling) {
      if (wanted) {
        // Carry on: this callout is part of the clip.
        this.setEnd(MAX_CLIP_MS);
        this.tracking = true;
      } else {
        // A callout nobody planned to film: the last combination is over.
        this.tracking = false;
        this.endClip();
      }
      return;
    }
    // Planned, but too soon after scheduling for the head start to fire.
    if (wanted) {
      this.startClip();
      this.tracking = true;
    } else {
      this.tracking = false;
    }
  }

  private onSpoken(phrase: string): void {
    if (!this.rolling || !this.tracking) return;
    this.tracking = false;
    this.setEnd(tailAfterSpeechMs(phrase));
  }

  private startClip(): void {
    this.tape.roll();
    this.rolling = true;
    this.segmentStart = this.now();
    this.clips += 1;
    this.setEnd(MAX_CLIP_MS);
  }

  private endClip(): void {
    this.clearEnd();
    if (!this.rolling) return;
    this.tape.cut();
    this.rolling = false;
    this.armed = false;
    const t = this.now();
    this.recordedMs += t - this.segmentStart;
    this.lastClipEnd = t;
  }

  private setEnd(ms: number): void {
    this.clearEnd();
    this.endTimer = setTimeout(() => {
      this.endTimer = null;
      this.endClip();
    }, ms);
  }

  private clearArm(): void {
    if (this.armTimer) clearTimeout(this.armTimer);
    this.armTimer = null;
  }

  private clearEnd(): void {
    if (this.endTimer) clearTimeout(this.endTimer);
    this.endTimer = null;
  }
}
