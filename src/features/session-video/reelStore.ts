import { useSyncExternalStore } from "react";
import { Directory, Filesystem } from "@capacitor/filesystem";

import { forgetThumbs } from "./clipThumbs";
import type { ReelCandidate, SessionTimeline } from "./reelPlan";

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
/** What the full-screen player shows, if it's up — the back button closes it first. */
let viewing: "reel" | "full" | null = null;
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
  if (!reel && viewing === "reel") viewing = null;
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
  full = null;
  viewing = null;
  editing = false;
  setReelEdit(null);
  traceSource = null;
  setSessionReel(null);
};

/**
 * The full session from the session that just ended (see fullSession.ts),
 * for the line on the completion screen that says it is being saved, then
 * that it has been, and plays it once it is.
 */
export interface FullSessionVideo {
  /** Which recording this is, so a late update from an old one is ignored. */
  id: string;
  status: "saving" | "saved" | "failed";
  /** How long it runs once the rests are cut. */
  durationMs: number;
  /** Saved, but the microphone's sound didn't make it in. */
  silent?: boolean;
  /** A copy in the app's cache, to play and share, until the next session. */
  uri?: string;
}

let full: FullSessionVideo | null = null;

export const setFullSession = (f: FullSessionVideo | null): void => {
  full = f;
  if (viewing === "full") viewing = null;
  emit();
};

/** Updates the full session's status, if it is still recording `id`. */
export const patchFullSession = (
  id: string,
  status: FullSessionVideo["status"],
  silent = false,
  uri?: string
): void => {
  if (!full || full.id !== id) return;
  full = { ...full, status, ...(silent ? { silent } : {}), ...(uri ? { uri } : {}) };
  emit();
};

/**
 * The completion screen's line: "Saving your full session…", then "Full
 * session · 14 min · saved to your gallery" ("Photos" on iOS).
 */
export const fullSessionText = (
  f: Pick<FullSessionVideo, "status" | "durationMs" | "silent">,
  platform: string
): string => {
  const gallery = platform === "ios" ? "Photos" : "your gallery";
  if (f.status === "saving") return "Saving your full session…";
  const minutes = Math.max(1, Math.round(f.durationMs / 60000));
  return f.status === "saved"
    ? `Full session · ${minutes} min · saved to ${gallery}${f.silent ? ", without sound" : ""}`
    : `Full session · couldn't save to ${gallery}`;
};

/**
 * The session's recording trace, read when asked (it runs on while the full
 * session is cut and saved): what the full session's line shows when tapped,
 * since on an iPhone there's no other way to read it.
 */
let traceSource: (() => string) | null = null;

export const setSessionTrace = (source: (() => string) | null): void => {
  traceSource = source;
};

export const sessionTrace = (): string => traceSource?.() ?? "";

export const getFullSession = (): FullSessionVideo | null => full;

export const useFullSession = (): FullSessionVideo | null =>
  useSyncExternalStore(subscribe, () => full, () => null);

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

/** Opens the player on the reel, or on the full session once it's saved. */
export const openReelViewer = (which: "reel" | "full" = "reel"): void => {
  if (viewing) return;
  if (which === "reel" ? !current : !full?.uri) return;
  viewing = which;
  emit();
};

/** Switches the open player between the reel and the full session. */
export const showInReelViewer = (which: "reel" | "full"): void => {
  if (!viewing || viewing === which) return;
  viewing = which;
  emit();
};

/**
 * Closes the clip picker if it's up, else the player. Returns whether
 * either was open, for the back button.
 */
export const closeReelViewer = (): boolean => {
  if (editing) {
    editing = false;
    emit();
    return true;
  }
  if (!viewing) return false;
  viewing = null;
  emit();
  return true;
};

export const isReelViewerOpen = (): boolean => viewing !== null;

/** What the player shows: the reel, the full session, or nothing. */
export const useReelViewer = (): "reel" | "full" | null =>
  useSyncExternalStore(subscribe, () => viewing, () => null);

/**
 * What it takes to cut the reel again with other clips (the clip picker):
 * the uncut recording in the app's cache, the session's timeline, and the
 * clips worth offering. The recording is deleted when this is replaced or
 * cleared (the next session), and any left by an earlier launch go at the
 * next launch (pruneReelSources).
 */
export interface ReelEdit {
  /** The uncut recording, indexed: its times are the timeline's. */
  source: string;
  timeline: SessionTimeline;
  /** The shortlist, framing checked, in filmed order. */
  candidates: ReelCandidate[];
  /** The clips in the reel as it stands, by seq. */
  picked: number[];
}

let edit: ReelEdit | null = null;

export const setReelEdit = (e: ReelEdit | null): void => {
  const old = edit;
  edit = e;
  if (!e) editing = false;
  if (old && old.source !== e?.source) {
    forgetThumbs();
    void Filesystem.deleteFile({ path: old.source }).catch(() => undefined);
  }
  emit();
};

export const getReelEdit = (): ReelEdit | null => edit;

export const useReelEdit = (): ReelEdit | null =>
  useSyncExternalStore(subscribe, () => edit, () => null);

/** Uncut recordings kept for the clip picker by an earlier launch. */
export const pruneReelSources = async (): Promise<void> => {
  try {
    const { files } = await Filesystem.readdir({ path: "", directory: Directory.Cache });
    await Promise.all(
      files
        .filter((f) => f.name.endsWith("_reelsrc.mp4") && !edit?.source.endsWith(f.name))
        .map((f) => Filesystem.deleteFile({ path: f.name, directory: Directory.Cache }).catch(() => undefined))
    );
  } catch {
    /* nothing worth surfacing */
  }
};

/** The clip picker, over the player. */
let editing = false;

export const openReelEditor = (): void => {
  if (editing || !edit || viewing !== "reel") return;
  editing = true;
  emit();
};

/** Closes the clip picker only, leaving the player up. */
export const closeReelEditor = (): void => {
  if (!editing) return;
  editing = false;
  emit();
};

export const useReelEditorOpen = (): boolean =>
  useSyncExternalStore(subscribe, () => editing, () => false);
