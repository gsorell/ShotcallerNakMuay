import { useEffect, useMemo, useRef, useState } from "react";
import {
  TECHNIQUES_STORAGE_KEY,
  TECHNIQUES_VERSION_KEY,
} from "@/constants/storage";
import { INITIAL_TECHNIQUES } from "@/constants/techniques";
import type { TechniquesShape } from "@/types";
import { normalizeKey } from "@/utils/techniqueUtils";

const TECHNIQUES_VERSION = "v35";

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

  // 2. Persist Data
  const persistTechniques = (next: TechniquesShape) => {
    try {
      setTechniques(next);
      localStorage.setItem(TECHNIQUES_STORAGE_KEY, JSON.stringify(next));
      localStorage.setItem(TECHNIQUES_VERSION_KEY, TECHNIQUES_VERSION);
    } catch (err) {
      console.error("Failed to persist techniques", err);
    }
  };

  // 3. Build Index (Memoized)
  const techniqueIndex = useMemo(() => {
    const idx: Record<string, string> = {};
    Object.keys(techniques || {}).forEach((k) => {
      idx[k] = k;
      idx[normalizeKey(k)] = k;
    });
    return idx;
  }, [techniques]);

  // 4. Create Refs (for use in timers/callbacks inside App.tsx)
  const techniquesRef = useRef<TechniquesShape>(techniques);
  const techniqueIndexRef = useRef<Record<string, string>>(techniqueIndex);

  useEffect(() => {
    techniquesRef.current = techniques;
  }, [techniques]);

  useEffect(() => {
    techniqueIndexRef.current = techniqueIndex;
  }, [techniqueIndex]);

  return {
    techniques,
    persistTechniques,
    techniqueIndex,
    techniquesRef,
    techniqueIndexRef,
  };
}
