// src/hooks/useWorkoutSettings.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { type Difficulty, type EmphasisKey } from "@/types"; // Adjust path if needed
import { AnalyticsEvents, trackEvent } from "@/utils/analytics";
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
    freestyle: false,
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
  const [readInOrder, setReadInOrderState] = useState(false);
  const [southpawMode, setSouthpawMode] = useState(loadSouthpaw);

  // The callout loop reads this through a ref rather than the state value: it
  // used to sit in `startTechniqueCallouts`'s dependency array, which meant
  // flipping it tore down and restarted the loop mid-round. The ref is updated
  // synchronously with the state so a caller can change ordering between rounds
  // (the roadmap does exactly this) without interrupting callouts.
  const readInOrderRef = useRef(readInOrder);
  const setReadInOrder = useCallback((value: boolean) => {
    const next = Boolean(value);
    readInOrderRef.current = next;
    setReadInOrderState(next);
  }, []);

  // Loosens the gap between callouts into something closer to a real pad round
  // — same average pace, but uneven, with the occasional held beat. A tight
  // metronome is fine when the pool is 30 techniques deep and unpredictable on
  // its own; with a guided level's two or three, it turns into a drum machine.
  // Ref-only (never state) so it can be set at session start without
  // re-creating the callout callback.
  const variedCadenceRef = useRef(false);

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

  const toggleEmphasis = (k: EmphasisKey, source: string = "tile") => {
    setSelectedEmphases((prev) => {
      const isTurningOn = !prev[k];

      // Tracked from inside the updater on purpose: callers may clear the
      // emphases in the same tick (see the Learn drill hand-off), so `prev` is
      // the only place the real before-state is visible.
      try {
        trackEvent(
          isTurningOn
            ? AnalyticsEvents.EmphasisSelect
            : AnalyticsEvents.EmphasisDeselect,
          { emphasis: k, source }
        );
      } catch (e) {}

      if (k === "timer_only" || k === "freestyle") {
        const allOff = {
          timer_only: false,
          freestyle: false,
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
        return { ...allOff, [k]: isTurningOn };
      }
      const next = { ...prev, [k]: isTurningOn };
      if (isTurningOn) {
        next.timer_only = false;
        next.freestyle = false;
      }
      return next;
    });
  };

  const clearAllEmphases = () => {
    setSelectedEmphases({
      timer_only: false,
      freestyle: false,
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
    readInOrderRef,
    variedCadenceRef,
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
