import type { CalloutEvent } from "./calloutSignal";

/**
 * Films every callout as a clip of its own, for the reel to choose from.
 *
 * Choosing *which* callouts to film in advance was the old design, and it
 * kept whatever the camera saw whether or not anything happened. Now every
 * callout is filmed; motion decides afterwards what is kept (see motion.ts
 * and highlights.ts). Clips are generous on purpose — trimming is the
 * picker's job:
 *
 *   starts  PREROLL_MS before its callout (people throw on the first word,
 *           and a recorder takes a moment to start)
 *   ends    OVERLAP_MS after the next clip has started, so the handover
 *           loses nothing; or at MAX_SEGMENT_MS if no next callout comes
 */
export const PREROLL_MS = 600;
export const OVERLAP_MS = 900;
export const MAX_SEGMENT_MS = 9000;

/** One clip being filmed. The scheduler only opens and closes it. */
export interface SegmentHandle {
  close(): void;
}

export type OpenSegment = () => SegmentHandle | null;

export class SegmentScheduler {
  private current: SegmentHandle | null = null;
  /** The current clip was opened ahead of a callout that hasn't come yet. */
  private armed = false;
  private armTimer: ReturnType<typeof setTimeout> | null = null;
  private capTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    private readonly open: OpenSegment,
    private readonly onRecordingChange: (recording: boolean) => void = () => {}
  ) {}

  event(e: CalloutEvent): void {
    if (this.stopped) return;
    if (e.type === "scheduled") this.onScheduled(e.delayMs);
    else this.onCalled();
  }

  /** Paused, resting, or the round ended: close the clip, cancel the next. */
  hold(): void {
    this.clearArm();
    this.armed = false;
    this.closeCurrent();
    this.onRecordingChange(false);
  }

  /** The session is over; nothing more opens. */
  stop(): void {
    this.hold();
    this.stopped = true;
  }

  private onScheduled(delayMs: number): void {
    // Already rolling for this callout and it was pushed back (the voice
    // was still busy): keep rolling.
    if (this.armed) return;
    this.clearArm();
    this.armTimer = setTimeout(() => {
      this.armTimer = null;
      this.openNext();
      this.armed = true;
    }, Math.max(0, delayMs - PREROLL_MS));
  }

  private onCalled(): void {
    this.clearArm();
    // Called with no head start (the schedule never came, or came late).
    if (!this.armed) this.openNext();
    this.armed = false;
  }

  private openNext(): void {
    const previous = this.current;
    if (previous) {
      // Both run for a moment, so the handover drops nothing.
      setTimeout(() => previous.close(), OVERLAP_MS);
    }
    this.current = this.open();
    this.clearCap();
    if (this.current) {
      this.onRecordingChange(true);
      const opened = this.current;
      this.capTimer = setTimeout(() => {
        if (this.current === opened) this.closeCurrent();
      }, MAX_SEGMENT_MS);
    }
  }

  private closeCurrent(): void {
    this.clearCap();
    const c = this.current;
    this.current = null;
    c?.close();
  }

  private clearArm(): void {
    if (this.armTimer) clearTimeout(this.armTimer);
    this.armTimer = null;
  }

  private clearCap(): void {
    if (this.capTimer) clearTimeout(this.capTimer);
    this.capTimer = null;
  }
}
