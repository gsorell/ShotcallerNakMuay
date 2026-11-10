/**
 * What the callout engine tells the session reel.
 *
 * The engine's `currentCallout` is state for the screen; it does not change
 * when the same technique is called twice, and it says nothing about when
 * the next call is due. The recorder needs both — to start filming just
 * *before* a call (people throw on the first word) — and it needs to know
 * *what* was called, because a four-strike combination makes a better clip
 * than a check, and the video alone can't tell them apart. The engine should
 * not need to know a recorder exists, so it rings these and anything
 * interested listens.
 */
export interface CallInfo {
  /** The technique as written, e.g. "Jab, Cross, Left Kick". */
  text: string;
  /**
   * A single word slipped in after a combination ("Check"), from the
   * session's "between callouts" setting. It belongs to the combination
   * before it, not a clip of its own.
   */
  between: boolean;
  combo: boolean;
}

export type CalloutEvent =
  /**
   * The next callout is due in `delayMs`; replaces any earlier schedule.
   * `nextIsBetween`: it will be a between-call, which joins the clip in
   * progress rather than starting one.
   */
  | { type: "scheduled"; delayMs: number; nextIsBetween: boolean }
  /** A technique is being called, now. */
  | { type: "called"; call: CallInfo }
  /**
   * The voice just finished saying it. Between "called" and this, a crack
   * the microphone hears may be the app's own voice, not a strike.
   */
  | { type: "spoken" }
  /**
   * The app played one of its own sounds (a bell, a beep) lasting about
   * `durationMs`. A bell's strike is as sharp as a pad's: what the microphone
   * hears meanwhile isn't evidence of a strike.
   */
  | { type: "sound"; durationMs: number };

type Listener = (event: CalloutEvent) => void;

const listeners = new Set<Listener>();

const emit = (event: CalloutEvent): void => {
  listeners.forEach((l) => {
    try {
      l(event);
    } catch {
      /* a listener failing must never stop the session calling */
    }
  });
};

export const notifyCalloutScheduled = (
  delayMs: number,
  nextIsBetween = false
): void => emit({ type: "scheduled", delayMs, nextIsBetween });

export const notifyCallout = (call: CallInfo): void =>
  emit({ type: "called", call });

export const notifyCalloutSpoken = (): void => emit({ type: "spoken" });

export const notifyAppSound = (durationMs: number): void =>
  emit({ type: "sound", durationMs });

export const onCalloutEvent =(listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
