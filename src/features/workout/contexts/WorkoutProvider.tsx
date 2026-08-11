import { DEFAULT_REST_MINUTES } from "@/constants/storage";
import type { EmphasisKey, TechniqueWithStyle } from "@/types";
// Imported from the roadmap's data modules rather than its barrel on purpose:
// the barrel also exports the roadmap screens, which import this feature back —
// going through it would make the two features a circular import.
import {
  getLevel,
  getPath,
  type RoadmapLevel,
  type RoadmapPath,
} from "@/features/roadmap/data/paths";
import {
  walksPoolInOrder,
  poolForRound,
  roadmapLogLabel,
} from "@/features/roadmap/session";
import {
  isLevelCleared,
  markLevelCleared,
} from "@/features/roadmap/storage";
import { AnalyticsEvents, trackEvent } from "@/utils/analytics";
import { createWorkoutLogEntry, type RoadmapLogRef } from "@/utils/logUtils";
import { generateTechniquePool } from "@/utils/techniqueUtils";
import { scrollContentToTop } from "@/utils/scroll";
import React, { createContext, useCallback, useContext, useMemo, useState, useRef, useEffect } from "react";
import { useHomeStats } from "../../logs";
import { useAudioSystem, useUIContext, useWakeLock, usePhoneCallDetection } from "../../shared";
import { useEmphasisList, useTechniqueData } from "../../technique-editor";
import { useCalloutEngine } from "../hooks/useCalloutEngine";
import { useClackEngine } from "../hooks/useClackEngine";
import { useWorkoutSettings } from "../hooks/useWorkoutSettings";
import {
  applySettings,
  snapshotSettings,
  type ParkedSettings,
} from "../utils/borrowedSettings";
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

  // Guided path
  /** The level currently being drilled, or null for a normal session. */
  activeRoadmap: { path: RoadmapPath; level: RoadmapLevel } | null;
  startRoadmapLevel: (path: RoadmapPath, level: RoadmapLevel) => void;

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

  isFreestyle: boolean;
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

/** The marker a guided session writes into its workout log entry. */
const roadmapLogRef = (
  path: RoadmapPath,
  level: RoadmapLevel
): RoadmapLogRef => ({
  pathId: path.id,
  levelId: level.id,
  label: roadmapLogLabel(level),
});

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

  // --- Guided path state ---
  // The ref is what the timer callbacks read (they must not re-create on every
  // level change); the state copy is only there for the UI.
  const [activeRoadmap, setActiveRoadmap] = useState<{
    path: RoadmapPath;
    level: RoadmapLevel;
  } | null>(null);
  const activeRoadmapRef = useRef<{
    path: RoadmapPath;
    level: RoadmapLevel;
  } | null>(null);
  // Which round of the level we are on. Tracked here rather than read from the
  // timer because `onRestEnd` fires in the same tick as its own
  // `setCurrentRound`, so `timer.currentRound` is still the previous value.
  const roadmapRoundRef = useRef(1);

  /**
   * The user's own session configuration, parked while a guided level borrows
   * it. A level pins its own rounds, length, rest, cadence and ordering, and
   * three of those (`roundsCount`, `roundMin`, `restMinutes`) are written
   * straight through to localStorage — so without this, training one level
   * would permanently replace someone's 5×3min setup with the level's 3×1min
   * and leave "Read Techniques in Order" switched on behind them.
   */
  const parkedSettingsRef = useRef<ParkedSettings | null>(null);

  const parkUserSettings = useCallback(() => {
    // Never overwrite an existing snapshot: restarting or resuming a level
    // mid-path would otherwise park the level's own pinned values as if they
    // were the user's.
    if (parkedSettingsRef.current) return;
    parkedSettingsRef.current = snapshotSettings(settingsRef.current);
  }, []);

  /** Hand the user their own settings back once a guided level is over. */
  const restoreUserSettings = useCallback(() => {
    const parked = parkedSettingsRef.current;
    if (!parked) return;
    parkedSettingsRef.current = null;
    applySettings(settingsRef.current, parked);
    settingsRef.current.variedCadenceRef.current = false;
  }, []);

  /**
   * Point the callout engine at the pool for a given round of the active level.
   * Safe to call mid-session: the engine re-reads the pool ref on every callout,
   * and ordering now goes through a ref too, so nothing restarts the loop.
   */
  const applyRoadmapRound = useCallback((round: number) => {
    const active = activeRoadmapRef.current;
    const engine = calloutEngineRef.current;
    if (!active || !engine) return;
    engine.currentPoolRef.current = poolForRound(
      active.path,
      active.level,
      round
    );
    engine.orderedIndexRef.current = 0;
    settingsRef.current.setReadInOrder(walksPoolInOrder(round));
  }, []);

  // Timer handlers
  const stopSessionCleanup = useCallback(() => {
    // Cleanup when workout session ends
  }, []);

  const handleRoundStart = useCallback(() => {
    // Fires once, when the pre-round countdown ends. Every later round arrives
    // through onRestEnd instead. The round counter is set by whoever started
    // the session (level 1 for a fresh start, mid-level for a resume), so this
    // applies it rather than assuming round 1.
    if (activeRoadmapRef.current) applyRoadmapRound(roadmapRoundRef.current);
    sfx.playBell();
  }, [sfx, applyRoadmapRound]);

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
    // Rest is over, so a new round is starting — advance the level's own round
    // counter and swap in that round's pool before the first callout lands.
    if (activeRoadmapRef.current) {
      roadmapRoundRef.current += 1;
      applyRoadmapRound(roadmapRoundRef.current);
    }
    // Round starting - big bell
    sfx.playBell();
  }, [sfx, applyRoadmapRound]);

  // Create refs to store latest values for workout completion
  const calloutEngineRef = React.useRef<any>(null);
  const settingsRef = React.useRef(settings);
  const timerRef = React.useRef<any>(null);
  const viewCompletionScreenRef = React.useRef<any>(null);

  // Update refs when values change
  settingsRef.current = settings;

  const handleWorkoutComplete = useCallback(() => {
    if (!calloutEngineRef.current || !timerRef.current) return;

    const active = activeRoadmapRef.current;

    // Save workout log and show completion screen
    const logEntry = createWorkoutLogEntry(
      settingsRef.current,
      timerRef.current,
      calloutEngineRef.current.shotsCalledOutRef.current,
      emphasisList,
      "completed",
      active ? roadmapLogRef(active.path, active.level) : null
    );

    // A guided level clears by being finished — the app cannot see the student,
    // so attendance is the only honest measure. Replays bump the session count
    // but never re-earn the charm; see features/roadmap/storage.
    if (active) {
      const firstClear = markLevelCleared(active.path.id, active.level.id);
      trackEvent(AnalyticsEvents.RoadmapLevelComplete, {
        path: active.path.id,
        level: active.level.id,
        replay: !firstClear,
      });
      activeRoadmapRef.current = null;
      setActiveRoadmap(null);
      restoreUserSettings();
    }

    // Trigger stats refresh
    triggerStatsRefresh();

    // Show completion screen
    if (viewCompletionScreenRef.current) {
      viewCompletionScreenRef.current(logEntry);
    }

    // Announce completion
    tts.speakSystem("Workout complete! Great job!", settingsRef.current.voiceSpeed);
  }, [emphasisList, triggerStatsRefresh, tts, restoreUserSettings]);

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

  // Freestyle clack engine
  const isFreestyle = settings.selectedEmphases.freestyle &&
    Object.values(settings.selectedEmphases).filter(Boolean).length === 1;

  const clackEngine = useClackEngine({
    timer,
    difficulty: settings.difficulty,
    isFreestyle,
    playClack: sfx.playClack,
  });

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
    // Normal sessions keep the steady cadence; only guided levels loosen it.
    settings.variedCadenceRef.current = false;
    const pool = getTechniquePool();
    const noTechniqueMode =
      (settings.selectedEmphases.timer_only || settings.selectedEmphases.freestyle) &&
      Object.values(settings.selectedEmphases).filter(Boolean).length === 1;
    if (!pool.length && !noTechniqueMode) {
      alert("No techniques found for the selected emphasis(es).");
      return;
    }

    // Track analytics
    // GA4 event params only accept scalars — an array here is dropped on the
    // way out, so send a joined string plus a count we can segment on.
    const activeEmphases = Object.keys(settings.selectedEmphases).filter(
      (k) => settings.selectedEmphases[k as EmphasisKey]
    );
    trackEvent(AnalyticsEvents.WorkoutStart, {
      selected_emphases: activeEmphases.join(","),
      emphasis_count: activeEmphases.length,
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
    scrollContentToTop();
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

  /**
   * Start a guided level. Unlike `startSession` this ignores the emphasis
   * selection entirely and drives the callout pool itself, one pool per round.
   */
  const startRoadmapLevel = useCallback(
    (path: RoadmapPath, level: RoadmapLevel) => {
      // Must run inside the tap, before any await — iOS only unlocks audio
      // during a user gesture.
      tts.ensureTTSUnlocked();

      const replay = isLevelCleared(path.id, level.id);

      // Borrow the user's configuration, don't consume it.
      parkUserSettings();

      // A guided session has no emphasis; clear any leftover selection so the
      // setup screen isn't showing a style the session never used.
      settings.clearAllEmphases();
      settings.setAddCalisthenics(false);
      settings.setRoundsCount(level.session.roundsCount);
      settings.setRoundMin(level.session.roundMin);
      settings.setRestMinutes(level.session.restMinutes);
      settings.setDifficulty(level.session.difficulty);
      settings.setReadInOrder(walksPoolInOrder(1));
      // A guided pool is small by design, so an even cadence reads as a drum
      // machine. Loosen it into something closer to a real pad round.
      settings.variedCadenceRef.current = true;

      activeRoadmapRef.current = { path, level };
      setActiveRoadmap({ path, level });
      roadmapRoundRef.current = 1;

      trackEvent(AnalyticsEvents.RoadmapLevelStart, {
        path: path.id,
        level: level.id,
        replay,
      });

      setPage("timer");

      // The timer reads round and rest length from the settings above, which
      // only land on the next render — start on the far side of that, the same
      // hand-off `resumeWorkout` uses.
      setTimeout(async () => {
        await sfx.ensureMediaUnlocked();
        calloutEngine.currentPoolRef.current = poolForRound(path, level, 1);
        calloutEngine.orderedIndexRef.current = 0;
        calloutEngine.shotsCalledOutRef.current = 0;
        tts.speakSystem("Get ready", settingsRef.current.voiceSpeed);
        timer.startTimer();
        scrollContentToTop();
      }, 150);
    },
    [settings, calloutEngine, tts, sfx, timer, setPage, parkUserSettings]
  );

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
    clackEngine.stopClacks();

    // Auto-log partially completed workout. A quit guided level still gets the
    // marker so it can be resumed from history, but it is not marked cleared.
    const active = activeRoadmapRef.current;
    createWorkoutLogEntry(
      settings,
      timer,
      calloutEngine.shotsCalledOutRef.current,
      emphasisList,
      "abandoned",
      active ? roadmapLogRef(active.path, active.level) : null
    );
    if (active) {
      activeRoadmapRef.current = null;
      setActiveRoadmap(null);
      // Quitting a level hands the settings back just the same as finishing it.
      restoreUserSettings();
    }
    triggerStatsRefresh();
    timer.stopTimer();
    calloutEngine.setCurrentCallout("");
  }, [
    stopSessionCleanup,
    calloutEngine,
    clackEngine,
    settings,
    timer,
    emphasisList,
    triggerStatsRefresh,
  ]);

  const resumeWorkout = useCallback(
    (logEntry: any) => {
      // A guided level cannot be rebuilt from emphasis labels the way a normal
      // session is — it has none. Re-enter the level instead, picking up at the
      // round after the last one completed.
      const ref = logEntry?.roadmap;
      if (ref) {
        const path = getPath(ref.pathId);
        const level = getLevel(ref.pathId, ref.levelId);
        if (!path || !level) {
          alert("Cannot resume: that level is no longer part of the path.");
          return;
        }
        tts.ensureTTSUnlocked();

        parkUserSettings();
        settings.clearAllEmphases();
        settings.setAddCalisthenics(false);
        settings.setRoundsCount(level.session.roundsCount);
        settings.setRoundMin(level.session.roundMin);
        settings.setRestMinutes(level.session.restMinutes);
        settings.setDifficulty(level.session.difficulty);

        const resumeRound = (logEntry.roundsCompleted || 0) + 1;
        settings.setReadInOrder(walksPoolInOrder(resumeRound));
        settings.variedCadenceRef.current = true;
        activeRoadmapRef.current = { path, level };
        setActiveRoadmap({ path, level });
        roadmapRoundRef.current = resumeRound;
        calloutEngine.shotsCalledOutRef.current = logEntry.shotsCalledOut || 0;
        setPage("timer");

        setTimeout(async () => {
          await sfx.ensureMediaUnlocked();
          calloutEngine.currentPoolRef.current = poolForRound(
            path,
            level,
            resumeRound
          );
          calloutEngine.orderedIndexRef.current = 0;
          timer.resumeTimerState(logEntry);
          tts.speakSystem(
            "Resuming your level. Get ready",
            settingsRef.current.voiceSpeed
          );
          scrollContentToTop();
        }, 150);
        return;
      }

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
        if (!pool.length && !logEntry.settings?.selectedEmphases?.timer_only && !logEntry.settings?.selectedEmphases?.freestyle) {
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
        scrollContentToTop();
      }, 150);
    },
    [
      settings,
      calloutEngine,
      setPage,
      getTechniquePool,
      sfx,
      tts,
      timer,
      parkUserSettings,
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
        roadmap: logEntry.roadmap,
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

      // "Go again" on a guided level replays the level itself.
      const ref = lastWorkout?.roadmap;
      if (ref) {
        const path = getPath(ref.pathId);
        const level = getLevel(ref.pathId, ref.levelId);
        if (path && level) {
          setTimeout(() => startRoadmapLevel(path, level), 150);
          return;
        }
      }

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
    [stopSession, emphasisList, settings, setPage, startSession, startRoadmapLevel]
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
    activeRoadmap,
    startRoadmapLevel,
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
    isFreestyle,
  };

  return (
    <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>
  );
};
