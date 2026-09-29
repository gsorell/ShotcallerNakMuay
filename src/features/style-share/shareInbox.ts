import type { TechniqueShape } from "@/utils/techniqueUtils";

type Listener = (raw: string) => void;

const listeners = new Set<Listener>();

/**
 * Push a share code into the same confirmation flow a tapped link uses.
 *
 * The import modal is owned by App, which is the only place that can write to
 * the technique library. This is how a component far from it — the editor's
 * paste box — hands a code over without the modal having to exist twice or the
 * code being threaded through half the tree as props.
 */
export const submitShareCode = (raw: string): void => {
  listeners.forEach((listener) => listener(raw));
};

export const onShareCode = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// --- outgoing -------------------------------------------------------------

type ShareListener = (group: TechniqueShape) => void;

const shareListeners = new Set<ShareListener>();

/**
 * Ask to share a style.
 *
 * Sharing is not just "open the share sheet": it is gated on Pro, and the
 * first one has to confirm the name it will go out under. Both callers — the
 * editor's ↗ and the home screen's quick-edit — raise a request here so that
 * decision lives in exactly one place (ShareStyleFlow) instead of being
 * duplicated, and drifting, at each button.
 */
export const requestShareStyle = (group: TechniqueShape): void => {
  shareListeners.forEach((listener) => listener(group));
};

export const onShareRequest = (listener: ShareListener): (() => void) => {
  shareListeners.add(listener);
  return () => {
    shareListeners.delete(listener);
  };
};
