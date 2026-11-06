/**
 * A tick every time a technique is called.
 *
 * The callout engine's `currentCallout` is state for the screen, and it does
 * not change when the same technique is called twice in a row, so it cannot
 * count callouts. The recorder needs every one, and the engine should not
 * need to know a recorder exists — so the engine rings this and anything
 * interested listens.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export const notifyCallout = (): void => {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* a listener failing must never stop the session calling */
    }
  });
};

export const onCallout = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
