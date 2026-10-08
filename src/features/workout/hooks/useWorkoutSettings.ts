// src/hooks/useWorkoutSettings.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  reconcileStyleOrder,
  sanitizeRoundStructure,
  type RoundStructure,
} from "../utils/roundPlan";
import { type Difficulty, type EmphasisKey } from "@/types"; // Adjust path if needed
import { AnalyticsEvents, trackEvent } from "@/utils/analytics";
import {
  loadSouthpaw,
  onSouthpawPreferenceChange,
  saveSouthpaw,
} from "@/utils/southpawPreference";
import { normalizeKey } from "@/utils/techniqueUtils"; // Adjust path if needed
import {
  loadUserSettings,
  saveUserSettings,
} from "@/utils/userSettingsManager"; // Adjust path if needed

const ROUND_STRUCTURE_STORAGE_KEY = "round_structure_v1";

const loadRoundStructure = (): RoundStructure => {
  try {
    const stored = localStorage.getItem(ROUND_STRUCTURE_STORAGE_KEY);
    return sanitizeRoundStructure(stored ? JSON.parse(stored) : null);
  } catch {
    return sanitizeRoundStructure(null);
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

  // How the rounds are structured — see utils/roundPlan. Remembered between
  // visits, unlike the style selection: it is a preference about how someone
  // trains rather than a choice about today's session.
  const [roundStructure, setRoundStructureState] =
    useState<RoundStructure>(loadRoundStructure);
  const setRoundStructure = useCallback((value: RoundStructure) => {
    const next = sanitizeRoundStructure(value);
    setRoundStructureState(next);
    try {
      localStorage.setItem(ROUND_STRUCTURE_STORAGE_KEY, JSON.stringify(next));
    } catch { /* a full or blocked store must not break the setting */ }
  }, []);

  // Stretches or tightens the gap between callouts for the round in progress.
  // Ref-only for the same reason as the cadence flag above: it changes at a
  // round boundary and must not re-create the callout callback.
  const paceFactorRef = useRef(1);

  // The selection is a map, which cannot say which style was picked first.
  // "One style per round" runs them in the order they were tapped, so that
  // order is carried here, alongside the selection rather than inside it.
  // Adjusted during render rather than in an effect, so there is never a
  // frame where the order and the selection disagree.
  const [pickedOrder, setPickedOrder] = useState<string[]>([]);
  const styleOrder = useMemo(
    () => reconcileStyleOrder(pickedOrder, selectedEmphases),
    [pickedOrder, selectedEmphases]
  );
  if (styleOrder.join("\n") !== pickedOrder.join("\n")) {
    setPickedOrder(styleOrder);
  }

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
    saveSouthpaw(southpawMode);
    southpawModeRef.current = Boolean(southpawMode);
  }, [southpawMode]);

  // Onboarding asks for the stance from above this provider.
  useEffect(() => onSouthpawPreferenceChange(setSouthpawMode), []);

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
      } catch { /* analytics must never break the selection it measures */ }

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
    roundStructure,
    setRoundStructure,
    paceFactorRef,
    styleOrder,
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
