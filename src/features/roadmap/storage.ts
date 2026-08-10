// ===========================================================================
// Guided-path progress.
// ---------------------------------------------------------------------------
// Completion is attendance, not accuracy — the app cannot see the student, so
// a level clears when its session runs to the end. Replays bump `sessions` but
// never move `firstClearedAt`, which is what keeps charms from re-earning.
//
// Local only, like every other store in the app. Reads are defensive: a
// corrupt or hand-edited value degrades to "no progress" rather than throwing
// on the setup screen.
// ===========================================================================

import {
  ROADMAP_BANNER_DISMISSED_KEY,
  ROADMAP_STORAGE_KEY,
} from "@/constants/storage";

import type { RoadmapPath } from "./data/paths";

const PROGRESS_VERSION = 1;

export interface LevelProgress {
  /** ISO timestamp of the first clear. Never overwritten by a replay. */
  firstClearedAt: string;
  /** Total completed sessions for this level, replays included. */
  sessions: number;
}

export interface PathProgress {
  /** Highest level id cleared. 0 means the path has not been started. */
  highestCleared: number;
  levels: Record<string, LevelProgress>;
}

export interface RoadmapProgress {
  version: number;
  paths: Record<string, PathProgress>;
}

const emptyProgress = (): RoadmapProgress => ({
  version: PROGRESS_VERSION,
  paths: {},
});

const emptyPath = (): PathProgress => ({ highestCleared: 0, levels: {} });

export function readProgress(): RoadmapProgress {
  try {
    const raw = localStorage.getItem(ROADMAP_STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyProgress();

    // Normalize rather than trust: everything downstream assumes these shapes.
    const paths: Record<string, PathProgress> = {};
    for (const [pathId, value] of Object.entries((parsed as any).paths ?? {})) {
      const path = value as any;
      const levels: Record<string, LevelProgress> = {};
      for (const [levelId, entry] of Object.entries(path?.levels ?? {})) {
        const level = entry as any;
        if (!level?.firstClearedAt) continue;
        levels[levelId] = {
          firstClearedAt: String(level.firstClearedAt),
          sessions: Number.isFinite(Number(level.sessions))
            ? Number(level.sessions)
            : 1,
        };
      }
      paths[pathId] = {
        highestCleared: Number.isFinite(Number(path?.highestCleared))
          ? Number(path.highestCleared)
          : 0,
        levels,
      };
    }
    return { version: PROGRESS_VERSION, paths };
  } catch {
    return emptyProgress();
  }
}

function writeProgress(progress: RoadmapProgress): void {
  try {
    localStorage.setItem(ROADMAP_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* ignore — progress is a nicety, never worth breaking a session over */
  }
}

export function readPathProgress(pathId: string): PathProgress {
  return readProgress().paths[pathId] ?? emptyPath();
}

export function isLevelCleared(pathId: string, levelId: number): boolean {
  return Boolean(readPathProgress(pathId).levels[String(levelId)]);
}

/**
 * Level 1 is always open; every other level needs the one before it cleared.
 * The bonus levels fall out of the same rule — they sit after the last core
 * level, so clearing it is what opens them.
 */
export function isLevelUnlocked(pathId: string, levelId: number): boolean {
  if (levelId <= 1) return true;
  return isLevelCleared(pathId, levelId - 1);
}

/** The level the ladder should point the user at next. */
export function nextLevelId(path: RoadmapPath): number {
  const progress = readPathProgress(path.id);
  const next = progress.highestCleared + 1;
  const last = path.levels[path.levels.length - 1]?.id ?? 1;
  return Math.min(next, last);
}

export function clearedCount(pathId: string): number {
  return Object.keys(readPathProgress(pathId).levels).length;
}

/** True once every non-bonus level has been cleared. */
export function hasGraduated(path: RoadmapPath): boolean {
  const progress = readPathProgress(path.id);
  return path.levels
    .filter((l) => !l.bonus)
    .every((l) => Boolean(progress.levels[String(l.id)]));
}

/**
 * Record a completed session. Returns true when this was the level's first
 * clear, which is what the ladder animates and the charms key off.
 */
export function markLevelCleared(pathId: string, levelId: number): boolean {
  const progress = readProgress();
  const path = progress.paths[pathId] ?? emptyPath();
  const key = String(levelId);
  const existing = path.levels[key];

  path.levels[key] = existing
    ? { ...existing, sessions: existing.sessions + 1 }
    : { firstClearedAt: new Date().toISOString(), sessions: 1 };
  path.highestCleared = Math.max(path.highestCleared, levelId);

  progress.paths[pathId] = path;
  writeProgress(progress);
  return !existing;
}

// --- setup-screen banner ----------------------------------------------------

export function isBannerDismissed(): boolean {
  try {
    return Boolean(localStorage.getItem(ROADMAP_BANNER_DISMISSED_KEY));
  } catch {
    return false;
  }
}

export function dismissBanner(): void {
  try {
    localStorage.setItem(ROADMAP_BANNER_DISMISSED_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Put the card back on the home screen — offered on the roadmap screen so
 *  hiding it is never a one-way door. */
export function restoreBanner(): void {
  try {
    localStorage.removeItem(ROADMAP_BANNER_DISMISSED_KEY);
  } catch {
    /* ignore */
  }
}
