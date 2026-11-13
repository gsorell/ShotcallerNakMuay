import { useSyncExternalStore } from "react";

export interface SessionReel {
  blob: Blob;
  url: string;
  /** "mp4" or "webm", for the file name. */
  ext: string;
  durationMs: number;
  clips: number;
  /** The reel written to the app's cache, once it has been (native only). */
  fileUri?: string;
  /**
   * The automatic save to the phone's gallery. Absent where there is no
   * gallery to save to (the browser build).
   */
  gallery?: "saving" | "saved" | "failed";
}

/**
 * The reel from the session that just ended. On a phone it is also saved to
 * the gallery as soon as the session ends (see saveToGallery); this copy is
 * what the completion screen plays, and it is gone on the next session or
 * the next launch.
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
  if (current && current.url !== reel?.url) URL.revokeObjectURL(current.url);
  current = reel;
  if (!reel) viewerOpen = false;
  emit();
};

/** Updates the current reel, if it is still `reel` (not a newer session's). */
export const patchSessionReel = (
  reel: SessionReel,
  patch: Partial<Pick<SessionReel, "fileUri" | "gallery">>
): SessionReel | null => {
  if (!current || current.url !== reel.url) return null;
  current = { ...current, ...patch };
  emit();
  return current;
};

export const clearSessionReel = (): void => {
  failure = null;
  setSessionReel(null);
};

export const getSessionReel = (): SessionReel | null => current;

export const useSessionReel = (): SessionReel | null =>
  useSyncExternalStore(subscribe, () => current, () => null);

/**
 * Why the session that just ended has no reel when it should have: a short
 * reason, and the pipeline's trace for "Details" (on iOS nothing else can be
 * read). Null when a reel came out, or none was due.
 */
export interface ReelFailure {
  reason: string;
  trace: string;
}

let failure: ReelFailure | null = null;

export const setReelFailure = (f: ReelFailure | null): void => {
  if (failure === f) return;
  failure = f;
  emit();
};

export const useReelFailure = (): ReelFailure | null =>
  useSyncExternalStore(subscribe, () => failure, () => null);

/** The last round's clips are still being assembled into the reel. */
let building = false;

export const setReelBuilding = (on: boolean): void => {
  if (building === on) return;
  building = on;
  emit();
};

export const useReelBuilding = (): boolean =>
  useSyncExternalStore(subscribe, () => building, () => false);

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
