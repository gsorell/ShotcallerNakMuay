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
 * offered on the completion screen, shared or saved from there, and gone on
 * the next session or the next launch. Keeping videos would need storage
 * management nobody has asked for.
 */
let current: SessionReel | null = null;
/** Whether the full-screen player is up — the back button closes it first. */
let viewerOpen = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export const setSessionReel = (reel: SessionReel | null): void => {
  if (current && current !== reel) URL.revokeObjectURL(current.url);
  current = reel;
  if (!reel) viewerOpen = false;
  emit();
};

export const clearSessionReel = (): void => setSessionReel(null);

export const getSessionReel = (): SessionReel | null => current;

export const useSessionReel = (): SessionReel | null =>
  useSyncExternalStore(subscribe, () => current, () => null);

export const openReelViewer = (): void => {
  if (!current || viewerOpen) return;
  viewerOpen = true;
  emit();
};

/** Closes the player. Returns whether it was open, for the back button. */
export const closeReelViewer = (): boolean => {
  if (!viewerOpen) return false;
  viewerOpen = false;
  emit();
  return true;
};

export const isReelViewerOpen = (): boolean => viewerOpen;

export const useReelViewerOpen = (): boolean =>
  useSyncExternalStore(subscribe, () => viewerOpen, () => false);
