import React, { createContext, useCallback, useContext } from "react";
import { DEFAULT_REST_MINUTES } from "@/constants/storage";
import { useAndroidAudioDucking, useIOSAudioSession, useWakeLock, useTTSContext, useUIContext } from "../../shared";
import { useCalloutEngine } from "../hooks/useCalloutEngine";
import { useEmphasisList, useTechniqueData } from "../../technique-editor";
import { useHomeStats } from "../../logs";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { useWorkoutSettings } from "../hooks/useWorkoutSettings";
import { useWorkoutTimer } from "../hooks/useWorkoutTimer";
import type { EmphasisKey, TechniqueWithStyle } from "@/types";
import { AnalyticsEvents, trackEvent } from "@/utils/analytics";
import { createWorkoutLogEntry } from "@/utils/logUtils";
import { generateTechniquePool } from "@/utils/techniqueUtils";

// Context for workout-related state
interface WorkoutContextValue {
  // Settings
  settings: ReturnType<typeof useWorkoutSettings>;
  techniques: Record<string, any>;
  techniquesRef: React.MutableRefObject<Record<string, any>>;
  techniqueIndexRef: React.MutableRefObject<any>;
  emphasisList: any[];
  persistTechniques: (techniques: Record<string, any>) => void;

  // Timer
  timer: ReturnType<typeof useWorkoutTimer>;

  // Callout Engine
  calloutEngine: ReturnType<typeof useCalloutEngine>;

  // Audio
  iosAudioSession: ReturnType<typeof useIOSAudioSession>;
  androidAudioDucking: ReturnType<typeof useAndroidAudioDucking>;
  playBell: () => void;
  playWarningSound: () => void;
  ensureMediaUnlocked: () => Promise<void>;

  // Wake Lock
  shouldKeepAwake: boolean;

  // Actions
  getTechniquePool: () => TechniqueWithStyle[];
  hasSelectedEmphasis: boolean;
  startSession: () => void;
  pauseSession: () => void;
  stopSession: () => void;
  resumeWorkout: (logEntry: any) => void;
  viewCompletionScreen: (logEntry: any) => void;

  // Stats
  homePageStats: any;
  favoriteConfig: any;
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

export const useWorkoutContext = () => {
  const context = useContext(WorkoutContext);
  if (!context) {
    throw new Error("useWorkoutContext must be used within WorkoutProvider");
  }
  return context;
};

interface WorkoutProviderProps {
  children: React.ReactNode;
}

export const WorkoutProvider: React.FC<WorkoutProviderProps> = ({
  children,
}) => {
  // Contexts
  const { speakSystem, browserVoice, speak: ttsSpeak } = useTTSContext();
  const { setPage, setLastWorkout, triggerStatsRefresh } = useUIContext();

  // Data hooks
  const { techniques, persistTechniques, techniquesRef, techniqueIndexRef } =
    useTechniqueData();
  const emphasisList = useEmphasisList(techniques);
  const settings = useWorkoutSettings(techniques, techniqueIndexRef);

  // Audio hooks
  const iosAudioSession = useIOSAudioSession();
  const androidAudioDucking = useAndroidAudioDucking();
  const { playBell, playWarningSound, ensureMediaUnlocked } =
    useSoundEffects(iosAudioSession);

  // Timer handlers
  const stopSessionCleanup = useCallback(() => {
    // This will be implemented when we move the logic here
  }, []);

  const handleRoundStart = useCallback(() => {
    playBell();
  }, [playBell]);

  const handleRoundEnd = useCallback(() => {
    stopSessionCleanup();
    playBell();
    // Stop callouts logic will be moved here
  }, [stopSessionCleanup, playBell]);

  const handleRestWarning = useCallback(() => {
    speakSystem("10 seconds", settings.voiceSpeed);
  }, [speakSystem, settings.voiceSpeed]);

  const handleRestBell = useCallback(() => {
    playWarningSound();
  }, [playWarningSound]);

  const handleRestEnd = useCallback(() => {
    playBell();
  }, [playBell]);

  // Timer
  const timer = useWorkoutTimer({
    roundMin: settings.roundMin,
    restMinutes: settings.restMinutes,
    roundsCount: settings.roundsCount,
    onRoundStart: handleRoundStart,
    onRoundEnd: handleRoundEnd,
    onRestWarning: handleRestWarning,
    onRestBell: handleRestBell,
    onRestEnd: handleRestEnd,
    onWorkoutComplete: () => {
      // Handle workout complete
    },
  });

  // Callout Engine
  const calloutEngine = useCalloutEngine({
    timer,
    settings,
    tts: { speakSystemWithDuration: () => Promise.resolve() }, // Placeholder
  });

  // Wake Lock
  const shouldKeepAwake = (timer.running && !timer.paused) || timer.isPreRound;
  useWakeLock({ enabled: shouldKeepAwake, log: false });

  // Stats
  const homePageStats = useHomeStats(0); // Will need refresh trigger
  const favoriteConfig = homePageStats?.mostCommonEmphasis
    ? emphasisList.find(
        (e) =>
          e.label.trim().toLowerCase() ===
          homePageStats.mostCommonEmphasis.trim().toLowerCase()
      )
    : null;

  // Actions
  const getTechniquePool = useCallback((): TechniqueWithStyle[] => {
    return generateTechniquePool(
      techniquesRef.current,
      settings.selectedEmphases,
      settings.addCalisthenics,
      techniqueIndexRef.current
    );
  }, [
    settings.selectedEmphases,
    settings.addCalisthenics,
    techniquesRef,
    techniqueIndexRef,
  ]);

  const hasSelectedEmphasis = Object.values(settings.selectedEmphases).some(
    Boolean
  );

  const startSession = useCallback(() => {
    if (!hasSelectedEmphasis) return;
    const pool = getTechniquePool();
    const timerOnlySelected =
      settings.selectedEmphases.timer_only &&
      Object.values(settings.selectedEmphases).filter(Boolean).length === 1;
    if (!pool.length && !timerOnlySelected) {
      alert("No techniques found for the selected emphasis(es).");
      return;
    }

    // Track analytics
    trackEvent(AnalyticsEvents.WorkoutStart, {
      selected_emphases: Object.keys(settings.selectedEmphases).filter(
        (k) => settings.selectedEmphases[k as EmphasisKey]
      ),
      difficulty: settings.difficulty,
      rounds: settings.roundsCount,
    });

    // Audio setup
    void ensureMediaUnlocked();
    if (androidAudioDucking.isAndroidNative)
      void androidAudioDucking.requestAudioFocus();

    // Init Engine
    if (settings.readInOrder) {
      calloutEngine.currentPoolRef.current = pool;
    } else {
      calloutEngine.currentPoolRef.current = pool.sort(
        () => Math.random() - 0.5
      );
    }
    calloutEngine.orderedIndexRef.current = 0;
    calloutEngine.shotsCalledOutRef.current = 0;

    // Silent speak to init engine
    try {
      ttsSpeak(" ", {
        volume: 0,
        rate: settings.voiceSpeed,
        voice: browserVoice
          ? {
              id: browserVoice.name,
              name: browserVoice.name,
              language: browserVoice.lang,
              browserVoice: browserVoice,
            }
          : null,
      });
    } catch {}

    speakSystem("Get ready", settings.voiceSpeed);
    timer.startTimer();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [
    hasSelectedEmphasis,
    getTechniquePool,
    settings,
    trackEvent,
    ensureMediaUnlocked,
    androidAudioDucking,
    calloutEngine,
    ttsSpeak,
    browserVoice,
    speakSystem,
    timer,
  ]);

  const pauseSession = useCallback(() => {
    if (!timer.running) return;
    timer.pauseTimer();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.pause();
      } catch {}
    }
  }, [timer]);

  const stopSession = useCallback(() => {
    stopSessionCleanup();
    calloutEngine.stopAllNarration();

    // Auto-log partially completed workout
    createWorkoutLogEntry(
      settings,
      timer,
      calloutEngine.shotsCalledOutRef.current,
      emphasisList,
      "abandoned"
    );
    triggerStatsRefresh();
    timer.stopTimer();
    calloutEngine.setCurrentCallout("");
  }, [
    stopSessionCleanup,
    calloutEngine,
    settings,
    timer,
    emphasisList,
    triggerStatsRefresh,
  ]);

  const resumeWorkout = useCallback(
    (logEntry: any) => {
      if (logEntry.settings) {
        settings.setSelectedEmphases(logEntry.settings.selectedEmphases);
        settings.setAddCalisthenics(logEntry.settings.addCalisthenics);
        settings.setReadInOrder(logEntry.settings.readInOrder);
        settings.setSouthpawMode(logEntry.settings.southpawMode);
      }
      settings.setRoundsCount(logEntry.roundsPlanned);
      settings.setRoundMin(logEntry.roundLengthMin);
      settings.setRestMinutes(logEntry.restMinutes || DEFAULT_REST_MINUTES);
      settings.setDifficulty(logEntry.difficulty || "medium");
      calloutEngine.shotsCalledOutRef.current = logEntry.shotsCalledOut || 0;
      setPage("timer");

      setTimeout(() => {
        const pool = getTechniquePool();
        if (!pool.length && !logEntry.settings?.selectedEmphases?.timer_only) {
          alert("Cannot resume: No techniques found.");
          return;
        }
        void ensureMediaUnlocked();
        if (logEntry.settings?.readInOrder) {
          calloutEngine.currentPoolRef.current = pool;
        } else {
          calloutEngine.currentPoolRef.current = pool.sort(
            () => Math.random() - 0.5
          );
        }
        calloutEngine.orderedIndexRef.current = 0;

        try {
          ttsSpeak(" ", {
            volume: 0,
            rate: settings.voiceSpeed,
            voice: browserVoice
              ? {
                  id: browserVoice.name,
                  name: browserVoice.name,
                  language: browserVoice.lang,
                  browserVoice: browserVoice,
                }
              : null,
          });
        } catch {}

        timer.resumeTimerState(logEntry);
        speakSystem("Resuming workout. Get ready", settings.voiceSpeed);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 150);
    },
    [
      settings,
      calloutEngine,
      setPage,
      getTechniquePool,
      ensureMediaUnlocked,
      ttsSpeak,
      browserVoice,
      timer,
      speakSystem,
    ]
  );

  const viewCompletionScreen = useCallback(
    (logEntry: any) => {
      setLastWorkout({
        timestamp: logEntry.timestamp,
        emphases: logEntry.emphases,
        difficulty: logEntry.difficulty,
        shotsCalledOut: logEntry.shotsCalledOut,
        roundsCompleted: logEntry.roundsCompleted,
        roundsPlanned: logEntry.roundsPlanned,
        roundLengthMin: logEntry.roundLengthMin,
        suggestInstall: false,
      });
      setPage("completed");
    },
    [setLastWorkout, setPage]
  );

  const value: WorkoutContextValue = {
    settings,
    techniques,
    techniquesRef,
    techniqueIndexRef,
    emphasisList,
    persistTechniques,
    timer,
    calloutEngine,
    iosAudioSession,
    androidAudioDucking,
    playBell,
    playWarningSound,
    ensureMediaUnlocked,
    shouldKeepAwake,
    getTechniquePool,
    hasSelectedEmphasis,
    startSession,
    pauseSession,
    stopSession,
    resumeWorkout,
    viewCompletionScreen,
    homePageStats,
    favoriteConfig,
  };

  return (
    <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>
  );
};
