import { useEffect, useMemo, useRef, useState } from "react";
import {
  TECHNIQUES_STORAGE_KEY,
  TECHNIQUES_VERSION_KEY,
} from "@/constants/storage";
import { INITIAL_TECHNIQUES } from "@/constants/techniques";
import type { TechniquesShape } from "@/types";
import { normalizeKey } from "@/utils/techniqueUtils";

const TECHNIQUES_VERSION = "v36";

export function useTechniqueData() {
  // 1. Load Data
  const [techniques, setTechniques] = useState<TechniquesShape>(() => {
    try {
      const raw = localStorage.getItem(TECHNIQUES_STORAGE_KEY);
      const ver = localStorage.getItem(TECHNIQUES_VERSION_KEY);
      let loaded = INITIAL_TECHNIQUES;
      if (!raw || ver !== TECHNIQUES_VERSION) {
        localStorage.setItem(
          TECHNIQUES_STORAGE_KEY,
          JSON.stringify(INITIAL_TECHNIQUES)
        );
        localStorage.setItem(TECHNIQUES_VERSION_KEY, TECHNIQUES_VERSION);
      } else {
        loaded = JSON.parse(raw);
      }
      // Ensure timer_only is always present
      if (!loaded["timer_only"]) {
        loaded["timer_only"] = INITIAL_TECHNIQUES["timer_only"]!;
      }
      return loaded;
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
