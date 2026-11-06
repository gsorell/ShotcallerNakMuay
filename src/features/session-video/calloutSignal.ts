/**
 * What the callout engine tells the session reel about its timing.
 *
 * The engine's `currentCallout` is state for the screen; it does not change
 * when the same technique is called twice, and it says nothing about when
 * the next call is due. The recorder needs both — to start filming just
 * *before* a call (people throw on the first word) and stop when the next
 * one begins — and the engine should not need to know a recorder exists. So the engine rings these and anything
 * interested listens.
 */
export type CalloutEvent =
  /** The next callout is due in `delayMs`. Replaces any earlier schedule. */
  | { type: "scheduled"; delayMs: number }
  /** A technique is being called, now. */
  | { type: "called" };

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

export const notifyCalloutScheduled = (delayMs: number): void =>
  emit({ type: "scheduled", delayMs });

export const notifyCallout = (): void => emit({ type: "called" });

export const onCalloutEvent = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
