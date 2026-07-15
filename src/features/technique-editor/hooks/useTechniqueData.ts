import { useEffect, useMemo, useRef, useState } from "react";
import {
  TECHNIQUES_BASELINE_KEY,
  TECHNIQUES_STORAGE_KEY,
  TECHNIQUES_VERSION_KEY,
} from "@/constants/storage";
import { INITIAL_TECHNIQUES } from "@/constants/techniques";
import type { TechniquesShape } from "@/types";
import { normalizeKey } from "@/utils/techniqueUtils";

const TECHNIQUES_VERSION = "v37";

type GroupMap = Record<string, any>;

const sameGroup = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * Reconcile saved techniques against the shipped defaults on a version bump.
 *
 * For each core group: absent from the user's data means it's newly shipped, so
 * add it. Identical to the baseline means the user never touched it, so take
 * the latest content. Anything else is a customization and wins over the
 * default — `resetToDefault` / `resetGroupToDefault` remain the way back.
 * User-created groups are never core, so they always survive untouched.
 */
export const mergeTechniques = (
  stored: GroupMap,
  baseline: GroupMap | null
): GroupMap => {
  const merged: GroupMap = { ...stored };
  for (const [key, shipped] of Object.entries(
    INITIAL_TECHNIQUES as GroupMap
  )) {
    const userCopy = stored[key];
    if (!userCopy) {
      merged[key] = shipped;
      continue;
    }
    // No baseline (first run of this migration): assume the copy is customized
    // and keep it. Defaults haven't changed since the last forced reset, so an
    // untouched group already equals `shipped` and loses nothing.
    if (baseline && sameGroup(userCopy, baseline[key])) {
      merged[key] = shipped;
    }
  }
  return merged;
};

export function useTechniqueData() {
  // 1. Load Data
  const [techniques, setTechniques] = useState<TechniquesShape>(() => {
    try {
      const raw = localStorage.getItem(TECHNIQUES_STORAGE_KEY);
      const ver = localStorage.getItem(TECHNIQUES_VERSION_KEY);
      let loaded: GroupMap = INITIAL_TECHNIQUES;
      if (!raw) {
        // Fresh install.
        localStorage.setItem(
          TECHNIQUES_STORAGE_KEY,
          JSON.stringify(INITIAL_TECHNIQUES)
        );
        localStorage.setItem(TECHNIQUES_VERSION_KEY, TECHNIQUES_VERSION);
        localStorage.setItem(
          TECHNIQUES_BASELINE_KEY,
          JSON.stringify(INITIAL_TECHNIQUES)
        );
      } else if (ver !== TECHNIQUES_VERSION) {
        let baseline: GroupMap | null = null;
        try {
          const rawBaseline = localStorage.getItem(TECHNIQUES_BASELINE_KEY);
          if (rawBaseline) baseline = JSON.parse(rawBaseline);
        } catch {
          baseline = null;
        }
        loaded = mergeTechniques(JSON.parse(raw), baseline);
        localStorage.setItem(TECHNIQUES_STORAGE_KEY, JSON.stringify(loaded));
        localStorage.setItem(TECHNIQUES_VERSION_KEY, TECHNIQUES_VERSION);
        localStorage.setItem(
          TECHNIQUES_BASELINE_KEY,
          JSON.stringify(INITIAL_TECHNIQUES)
        );
      } else {
        loaded = JSON.parse(raw);
      }
      // Ensure timer_only is always present
      if (!loaded["timer_only"]) {
        loaded["timer_only"] = INITIAL_TECHNIQUES["timer_only"]!;
      }
      return loaded as TechniquesShape;
    } catch {
      return INITIAL_TECHNIQUES;
    }
  });

  // 2. Build Index (Memoized)
  const techniqueIndex = useMemo(() => {
    const idx: Record<string, string> = {};
    Object.keys(techniques || {}).forEach((k) => {
      idx[k] = k;
      idx[normalizeKey(k)] = k;
    });
    return idx;
  }, [techniques]);

  // 3. Create Refs (for use in timers/callbacks)
  // These are declared before persistTechniques so they can be updated synchronously
  const techniquesRef = useRef<TechniquesShape>(techniques);
  const techniqueIndexRef = useRef<Record<string, string>>(techniqueIndex);

  // Keep refs in sync via effects (for normal state updates)
  useEffect(() => {
    techniquesRef.current = techniques;
  }, [techniques]);

  useEffect(() => {
    techniqueIndexRef.current = techniqueIndex;
  }, [techniqueIndex]);

  // 4. Persist Data
  const persistTechniques = (next: TechniquesShape) => {
    try {
      setTechniques(next);
      localStorage.setItem(TECHNIQUES_STORAGE_KEY, JSON.stringify(next));
      localStorage.setItem(TECHNIQUES_VERSION_KEY, TECHNIQUES_VERSION);

      // Immediately update refs so new groups work without needing app restart
      // This ensures refs are current before the next render cycle
      techniquesRef.current = next;

      // Rebuild the index synchronously
      const idx: Record<string, string> = {};
      Object.keys(next || {}).forEach((k) => {
        idx[k] = k;
        idx[normalizeKey(k)] = k;
      });
      techniqueIndexRef.current = idx;
    } catch (err) {
      console.error("Failed to persist techniques", err);
    }
  };

  return {
    techniques,
    persistTechniques,
    techniqueIndex,
    techniquesRef,
    techniqueIndexRef,
  };
}
