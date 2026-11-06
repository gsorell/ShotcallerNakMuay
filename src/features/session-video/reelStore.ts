import { useSyncExternalStore } from "react";

export interface SessionReel {
  blob: Blob;
  url: string;
  /** "mp4" or "webm", for the file name. */
  ext: string;
  durationMs: number;
  clips: number;
}

/**
 * The reel from the session that just ended. Held in memory only: it is
 * shown once on the completion screen, shared or saved from there, and gone
 * on the next session or the next launch. Keeping videos would need storage
 * management nobody has asked for.
 */
let current: SessionReel | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export const setSessionReel = (reel: SessionReel | null): void => {
  if (current && current !== reel) URL.revokeObjectURL(current.url);
  current = reel;
  emit();
};

export const clearSessionReel = (): void => setSessionReel(null);

export const getSessionReel = (): SessionReel | null => current;

export const useSessionReel = (): SessionReel | null =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null
  );
