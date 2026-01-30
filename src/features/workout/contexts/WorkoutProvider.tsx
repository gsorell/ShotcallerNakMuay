import { DEFAULT_REST_MINUTES } from "@/constants/storage";
import type { EmphasisKey, TechniqueWithStyle } from "@/types";
import { AnalyticsEvents, trackEvent } from "@/utils/analytics";
import { createWorkoutLogEntry } from "@/utils/logUtils";
import { generateTechniquePool } from "@/utils/techniqueUtils";
import React, { createContext, useCallback, useContext, useMemo, useState, useRef, useEffect } from "react";
import { useHomeStats } from "../../logs";
import { useAudioSystem, useUIContext, useWakeLock, usePhoneCallDetection } from "../../shared";
import { useEmphasisList, useTechniqueData } from "../../technique-editor";
import { useCalloutEngine } from "../hooks/useCalloutEngine";
import { useWorkoutSettings } from "../hooks/useWorkoutSettings";
import { useWorkoutTimer } from "../hooks/useWorkoutTimer";

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
  tts: any;
  sfx: any;
  platform: any;

  // Wake Lock
  shouldKeepAwake: boolean;

  // Status
  status: "ready" | "running" | "paused" | "resting" | "pre-round";

  // Call Interruption
  isInterruptedByCall: boolean;
  clearCallInterruption: () => void;

  // Actions
  getTechniquePool: () => TechniqueWithStyle[];
  hasSelectedEmphasis: boolean;
  startSession: () => void;
  pauseSession: () => void;
  stopSession: () => void;
  restartSession: (lastWorkout: any) => void;
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
  const { setPage, setLastWorkout, triggerStatsRefresh, statsRefreshTrigger } = useUIContext();

  // Data hooks
  const { techniques, persistTechniques, techniquesRef, techniqueIndexRef } =
    useTechniqueData();
  const emphasisList = useEmphasisList(techniques);
  const settings = useWorkoutSettings(techniques, techniqueIndexRef);

  // Audio hooks
  const { tts, sfx, platform } = useAudioSystem();

  // Call interruption state
  const [isInterruptedByCall, setIsInterruptedByCall] = useState(false);
  const pauseSessionRef = useRef<(() => void) | null>(null);

  // Timer handlers
  const stopSessionCleanup = useCallback(() => {
    // Cleanup when workout session ends
  }, []);

  const handleRoundStart = useCallback(() => {
    sfx.playBell();
  }, [sfx]);

  const handleRoundEnd = useCallback(() => {
    // Immediately stop any ongoing callouts mid-utterance
    if (calloutEngineRef.current?.stopAllNarration) {
      calloutEngineRef.current.stopAllNarration();
    }
    stopSessionCleanup();
    sfx.playBell();
  }, [stopSessionCleanup, sfx]);

  const handleRestWarning = useCallback(() => {
    // 10 seconds warning - just TTS announcement, no bell
    tts.speakSystem("10 seconds", settings.voiceSpeed);
  }, [tts, settings.voiceSpeed]);

  const handleRestBell = useCallback(() => {
    // 5 seconds warning - interval bell (not the big bell)
    sfx.playWarningSound();
  }, [sfx]);

  const handleRestEnd = useCallback(() => {
    // Round starting - big bell
    sfx.playBell();
  }, [sfx]);

  // Create refs to store latest values for workout completion
  const calloutEngineRef = React.useRef<any>(null);
  const settingsRef = React.useRef(settings);
  const timerRef = React.useRef<any>(null);
  const viewCompletionScreenRef = React.useRef<any>(null);

  // Update refs when values change
  settingsRef.current = settings;

  const handleWorkoutComplete = useCallback(() => {
    if (!calloutEngineRef.current || !timerRef.current) return;

    // Save workout log and show completion screen
    const logEntry = createWorkoutLogEntry(
      settingsRef.current,
      timerRef.current,
      calloutEngineRef.current.shotsCalledOutRef.current,
      emphasisList,
      "completed"
    );

    // Trigger stats refresh
    triggerStatsRefresh();

    // Show completion screen
    if (viewCompletionScreenRef.current) {
      viewCompletionScreenRef.current(logEntry);
    }

    // Announce completion
    tts.speakSystem("Workout complete! Great job!", settingsRef.current.voiceSpeed);
  }, [emphasisList, triggerStatsRefresh, tts]);

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
    onWorkoutComplete: handleWorkoutComplete,
  });

  // Store timer in ref
  timerRef.current = timer;

  // Callout Engine
  const calloutEngine = useCalloutEngine({
    timer,
    settings,
    speakWithDuration: tts.speakSystemWithDuration,
  });

  // Store callout engine in ref
  calloutEngineRef.current = calloutEngine;

  // Phone call detection - auto-pause session when call is received
  const handleCallStart = useCallback(() => {
    if (timer.running && !timer.paused) {
      setIsInterruptedByCall(true);
      // Use the ref to call pauseSession to avoid dependency cycle
      if (pauseSessionRef.current) {
        pauseSessionRef.current();
      }
    }
  }, [timer.running, timer.paused]);

  const handleCallEnd = useCallback(() => {
    // Don't auto-resume - let the user manually resume
    // The isInterruptedByCall flag will show the UI notification
  }, []);

  usePhoneCallDetection({
    enabled: timer.running,
    onCallStart: handleCallStart,
    onCallEnd: handleCallEnd,
    debug: false,
  });

  const clearCallInterruption = useCallback(() => {
    setIsInterruptedByCall(false);
  }, []);

  // Status
  const status = useMemo(():
    | "ready"
    | "running"
    | "paused"
    | "resting"
    | "pre-round" => {
    if (timer.isPreRound) return "pre-round";
    if (!timer.running) return "ready";
    if (timer.paused) return "paused";
    if (timer.isResting) return "resting";
    return "running";
  }, [timer.isPreRound, timer.running, timer.paused, timer.isResting]);

  // Wake Lock
  const shouldKeepAwake = (timer.running && !timer.paused) || timer.isPreRound;
  useWakeLock({ enabled: shouldKeepAwake, log: false });

  // Stats
  const homePageStats = useHomeStats(statsRefreshTrigger);
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

  const startSession = useCallback(async () => {
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

    // Unlock audio for iOS Safari (must happen during user gesture)
    // CRITICAL: TTS unlock must be synchronous - no await before it!
    tts.ensureTTSUnlocked();
    await sfx.ensureMediaUnlocked();

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

    tts.speakSystem("Get ready", settings.voiceSpeed);
    timer.startTimer();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [
    hasSelectedEmphasis,
    getTechniquePool,
    settings,
    trackEvent,
    sfx,
    platform,
    calloutEngine,
    tts,
    timer,
  ]);

  const pauseSession = useCallback(() => {
    if (!timer.running) return;

    // If currently paused, we're resuming
    if (timer.paused) {
      timer.pauseTimer(); // Toggle to unpause
      setIsInterruptedByCall(false); // Clear call interruption flag on resume
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.resume();
        } catch {}
      }
    } else {
      // Currently running, so pause
      timer.pauseTimer(); // Toggle to pause
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.pause();
        } catch {}
      }
    }
  }, [timer]);

  // Store pauseSession in ref for phone call detection
  useEffect(() => {
    pauseSessionRef.current = pauseSession;
  }, [pauseSession]);

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

      setTimeout(async () => {
        const pool = getTechniquePool();
        if (!pool.length && !logEntry.settings?.selectedEmphases?.timer_only) {
          alert("Cannot resume: No techniques found.");
          return;
        }
        // Unlock audio for iOS Safari (must happen during user gesture)
        // CRITICAL: TTS unlock must be synchronous - no await before it!
        tts.ensureTTSUnlocked();
        await sfx.ensureMediaUnlocked();

        if (logEntry.settings?.readInOrder) {
          calloutEngine.currentPoolRef.current = pool;
        } else {
          calloutEngine.currentPoolRef.current = pool.sort(
            () => Math.random() - 0.5
          );
        }
        calloutEngine.orderedIndexRef.current = 0;

        timer.resumeTimerState(logEntry);
        tts.speakSystem("Resuming workout. Get ready", settings.voiceSpeed);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 150);
    },
    [settings, calloutEngine, setPage, getTechniquePool, sfx, tts, timer]
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

  // Store viewCompletionScreen in ref for use in handleWorkoutComplete
  viewCompletionScreenRef.current = viewCompletionScreen;

  const restartSession = useCallback(
    (lastWorkout: any) => {
      stopSession();
      // Restore settings
      const emphasisKeys = lastWorkout.emphases
        .map((label: string) => {
          const found = emphasisList.find((e) => e.label === label);
          return found ? found.key : null;
        })
        .filter(Boolean);
      const restoredEmphases: any = {};
      emphasisKeys.forEach((key: string) => {
        restoredEmphases[key] = true;
      });
      settings.setSelectedEmphases(restoredEmphases);
      setPage("timer");
      setTimeout(() => {
        startSession();
      }, 150);
    },
    [stopSession, emphasisList, settings, setPage, startSession]
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
    tts,
    sfx,
    platform,
    shouldKeepAwake,
    status,
    isInterruptedByCall,
    clearCallInterruption,
    getTechniquePool,
    hasSelectedEmphasis,
    startSession,
    pauseSession,
    stopSession,
    restartSession,
    resumeWorkout,
    viewCompletionScreen,
    homePageStats,
    favoriteConfig,
  };

  return (
    <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>
  );
};
