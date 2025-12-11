// src/hooks/useWorkoutSettings.ts
import { useEffect, useRef, useState } from "react";
import { type Difficulty, type EmphasisKey } from "@/types"; // Adjust path if needed
import { normalizeKey } from "@/utils/techniqueUtils"; // Adjust path if needed
import {
  loadUserSettings,
  saveUserSettings,
} from "@/utils/userSettingsManager"; // Adjust path if needed

// Helper to load southpaw mode safely
const loadSouthpaw = () => {
  try {
    const stored = localStorage.getItem("southpaw_mode");
    if (!stored) return false;
    return Boolean(JSON.parse(stored));
  } catch {
    return false;
  }
};

export function useWorkoutSettings(
  techniques: Record<string, any>,
  techniqueIndexRef: React.MutableRefObject<any>
) {
  const persistedSettings = loadUserSettings();

  // --- State ---
  const [selectedEmphases, setSelectedEmphases] = useState<
    Record<EmphasisKey, boolean>
  >({
    timer_only: false,
    khao: false,
    mat: false,
    tae: false,
    femur: false,
    sok: false,
    boxing: false,
    newb: false,
    two_piece: false,
    southpaw: false,
  });

  const [addCalisthenics, setAddCalisthenics] = useState(false);
  const [readInOrder, setReadInOrder] = useState(false);
  const [southpawMode, setSouthpawMode] = useState(loadSouthpaw);

  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [roundsCount, setRoundsCount] = useState(persistedSettings.roundsCount);
  const [roundMin, setRoundMin] = useState(persistedSettings.roundMin);
  const [restMinutes, setRestMinutes] = useState(persistedSettings.restMinutes);
  const [voiceSpeed, setVoiceSpeed] = useState<number>(
    persistedSettings.voiceSpeed
  );

  // --- Refs for access inside timeouts ---
  const southpawModeRef = useRef(southpawMode);
  const voiceSpeedRef = useRef(voiceSpeed);

  // --- Effects ---

  // Persist Settings
  useEffect(() => saveUserSettings({ roundMin }), [roundMin]);
  useEffect(() => saveUserSettings({ restMinutes }), [restMinutes]);
  useEffect(() => saveUserSettings({ voiceSpeed }), [voiceSpeed]);
  useEffect(() => saveUserSettings({ roundsCount }), [roundsCount]);

  // Persist Southpaw
  useEffect(() => {
    localStorage.setItem("southpaw_mode", JSON.stringify(southpawMode));
    southpawModeRef.current = Boolean(southpawMode);
  }, [southpawMode]);

  // Adjust Speed based on difficulty
  useEffect(() => {
    if (difficulty === "hard") setVoiceSpeed(1.4);
    else setVoiceSpeed(1);
  }, [difficulty]);

  // Sync ref
  useEffect(() => {
    voiceSpeedRef.current = voiceSpeed;
  }, [voiceSpeed]);

  // Auto-cleanup emphases if techniques are deleted
  useEffect(() => {
    setSelectedEmphases((prev) => {
      const curr = techniques || {};
      const next = { ...prev };
      for (const k of Object.keys(prev) as (keyof typeof prev)[]) {
        if (prev[k]) {
          const exists =
            Object.prototype.hasOwnProperty.call(curr, k) ||
            Boolean(
              techniqueIndexRef.current &&
                techniqueIndexRef.current[normalizeKey(String(k))]
            ) ||
            Boolean(
              Object.keys(curr).find(
                (c) => normalizeKey(c) === normalizeKey(String(k))
              )
            );
          if (!exists) next[k] = false;
        }
      }
      return next;
    });
  }, [techniques, techniqueIndexRef]);

  // --- Actions ---

  const toggleEmphasis = (k: EmphasisKey, trackEvent?: Function) => {
    setSelectedEmphases((prev) => {
      const isTurningOn = !prev[k];

      // Optional analytics tracking
      if (trackEvent) {
        try {
          trackEvent(isTurningOn ? "emphasis_select" : "emphasis_deselect", {
            emphasis: k,
          });
        } catch (e) {}
      }

      if (k === "timer_only") {
        const allOff = {
          timer_only: false,
          khao: false,
          mat: false,
          tae: false,
          femur: false,
          sok: false,
          boxing: false,
          newb: false,
          two_piece: false,
          southpaw: false,
        };
        return { ...allOff, timer_only: isTurningOn };
      }
      const next = { ...prev, [k]: isTurningOn };
      if (isTurningOn) next.timer_only = false;
      return next;
    });
  };

  const clearAllEmphases = () => {
    setSelectedEmphases({
      timer_only: false,
      khao: false,
      mat: false,
      tae: false,
      femur: false,
      sok: false,
      boxing: false,
      newb: false,
      two_piece: false,
      southpaw: false,
    });
  };

  return {
    selectedEmphases,
    setSelectedEmphases,
    addCalisthenics,
    setAddCalisthenics,
    readInOrder,
    setReadInOrder,
    southpawMode,
    setSouthpawMode,
    southpawModeRef,
    difficulty,
    setDifficulty,
    roundsCount,
    setRoundsCount,
    roundMin,
    setRoundMin,
    restMinutes,
    setRestMinutes,
    voiceSpeed,
    setVoiceSpeed,
    voiceSpeedRef,
    toggleEmphasis,
    clearAllEmphases,
  };
}
