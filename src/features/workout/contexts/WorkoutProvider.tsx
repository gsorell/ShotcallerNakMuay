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
import { generateTechniquePool, humanizeKey } from "@/utils/techniqueUtils";
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
import { useEntitlement } from "@/features/entitlement";
import {
  BETWEEN_CALLOUT_TEXT,
  DEFAULT_ROUND_STRUCTURE,
  buildRoundPool,
  calisthenicsPool,
  describeRound,
  finisherSeconds,
  isDefaultStructure,
  planRounds,
  planVaries,
  poolKey,
  reconcileStyleOrder,
  sanitizeRoundStructure,
  type PlannedRound,
  type RoundStructure,
} from "../utils/roundPlan";

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

  // Round structure
  /** One entry per round of the session in progress; null on a guided level. */
  sessionPlan: PlannedRound[] | null;

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

/**
 * Which way round the user stands, for anything that only needs that.
 *
 * Deliberately does not throw outside the provider, where `useWorkoutContext`
 * does. A component whose whole job is drawing a figure should still render in
 * isolation — in a test, or on a screen mounted outside the session tree — and
 * "not southpaw" is the right answer when there is no session state to read.
 */
export const useSouthpaw = (): boolean =>
  Boolean(useContext(WorkoutContext)?.settings?.southpawMode);

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
  const { setPage, setLastWorkout, triggerStatsRefresh, statsRefreshTrigger, setRoadmapFocusLevel } =
    useUIContext();

  // Data hooks
  const { techniques, persistTechniques, techniquesRef, techniqueIndexRef } =
    useTechniqueData();
  const emphasisList = useEmphasisList(techniques);
  const settings = useWorkoutSettings(techniques, techniqueIndexRef);

  // Audio hooks
  const { tts, sfx, platform } = useAudioSystem();

  // Structuring rounds is a Pro feature. Read here as well as in the sheet
  // that edits it, so a lapsed subscription falls back to a standard session
  // rather than keeping a structure it can no longer change.
  const { isPro } = useEntitlement();

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

  // --- Round structure ---
  // The plan for a normal session, one entry per round. Same split as the
  // guided path above: the ref is what the timer callbacks read, the state
  // copy is for the UI.
  const sessionPlanRef = useRef<PlannedRound[] | null>(null);
  const [sessionPlan, setSessionPlan] = useState<PlannedRound[] | null>(null);
  // What the plan was built from, so the log entry records the structure the
  // session actually ran rather than whatever the setting says by then.
  const sessionStructureRef = useRef<{
    structure: RoundStructure;
    styleOrder: string[];
  } | null>(null);
  // Tracked here for the same reason as `roadmapRoundRef`.
  const planRoundRef = useRef(1);
  // Where an in-order walk had got to in each pool. A style that comes round
  // again picks up where it left off instead of starting over, and a session
  // whose rounds all share one pool walks straight through as it always has.
  const planPoolKeyRef = useRef("");
  const orderedIndexByPoolRef = useRef(new Map<string, number>());
  // The round whose calisthenics finisher has already been switched in.
  const finisherRoundRef = useRef(0);

  const switchPoolKey = useCallback((key: string) => {
    const engine = calloutEngineRef.current;
    if (!engine || key === planPoolKeyRef.current) return;
    orderedIndexByPoolRef.current.set(
      planPoolKeyRef.current,
      engine.orderedIndexRef.current
    );
    engine.orderedIndexRef.current =
      orderedIndexByPoolRef.current.get(key) ?? 0;
    planPoolKeyRef.current = key;
  }, []);

  const beginSessionPlan = useCallback(
    (input: {
      structure: RoundStructure;
      styleOrder: string[];
      roundsCount: number;
      addCalisthenics: boolean;
    }) => {
      const plan = planRounds({
        structure: input.structure,
        styles: input.styleOrder,
        roundsCount: input.roundsCount,
        addCalisthenics: input.addCalisthenics,
      });
      sessionPlanRef.current = plan;
      setSessionPlan(plan);
      sessionStructureRef.current = {
        structure: input.structure,
        styleOrder: input.styleOrder,
      };
      planRoundRef.current = 1;
      planPoolKeyRef.current = "";
      orderedIndexByPoolRef.current.clear();
      finisherRoundRef.current = 0;
    },
    []
  );

  /** Drop the plan — for sessions that have none, and when one ends. */
  const clearSessionPlan = useCallback(() => {
    sessionPlanRef.current = null;
    setSessionPlan(null);
    sessionStructureRef.current = null;
    settingsRef.current.paceFactorRef.current = 1;
    if (calloutEngineRef.current) {
      calloutEngineRef.current.poolSharesRef.current = null;
      calloutEngineRef.current.betweenCalloutRef.current = null;
    }
  }, []);

  /** Point the callout engine at the planned pool for a given round. */
  const applyPlannedRound = useCallback(
    (round: number) => {
      const plan = sessionPlanRef.current;
      const engine = calloutEngineRef.current;
      if (!plan || !engine) return;
      const planned = plan[Math.min(Math.max(round, 1), plan.length) - 1];
      if (!planned) return;

      let built = buildRoundPool(
        techniquesRef.current,
        planned,
        techniqueIndexRef.current
      );
      // A round with nothing to call — a style emptied in the editor, say —
      // falls back to the whole selection rather than running in silence.
      if (!built.flat.length) {
        built = {
          flat: generateTechniquePool(
            techniquesRef.current,
            settingsRef.current.selectedEmphases,
            settingsRef.current.addCalisthenics,
            techniqueIndexRef.current
          ),
          shares: null,
        };
      }
      engine.currentPoolRef.current = built.flat;
      engine.poolSharesRef.current = built.shares;
      // Nobody jabs between burpees: a calisthenics round goes without.
      const between = sessionStructureRef.current?.structure.between ?? "off";
      engine.betweenCalloutRef.current =
        between === "off" || planned.calisthenics === "only"
          ? null
          : BETWEEN_CALLOUT_TEXT[between];
      switchPoolKey(poolKey(planned));
      settingsRef.current.paceFactorRef.current = planned.paceFactor;
    },
    [techniquesRef, techniqueIndexRef, switchPoolKey]
  );

  /** Settings as the log should record them for the session in progress. */
  const settingsForLog = (s: ReturnType<typeof useWorkoutSettings>) => ({
    ...s,
    roundStructure: sessionStructureRef.current?.structure,
    styleOrder: sessionStructureRef.current?.styleOrder,
  });

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
    else applyPlannedRound(planRoundRef.current);
    // A genuine round boundary — start the pace ramp over. Pausing does not
    // come through here, which is what lets a resume pick the ramp back up
    // where it was rather than at the beginning.
    calloutEngineRef.current?.resetRoundPace?.();
    sfx.playBell();
  }, [sfx, applyRoadmapRound, applyPlannedRound]);

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
    let line = "10 seconds";
    // When the rounds differ, say what is coming. It rides on this warning
    // because rest is the one place nothing else is being called: spoken at
    // the bell, it would land on top of the round's first callout.
    const plan = sessionPlanRef.current;
    const next =
      plan && !activeRoadmapRef.current && planVaries(plan)
        ? plan[planRoundRef.current]
        : undefined;
    if (next) {
      const { labels } = describeRound(next, (key) => {
        const found = emphasisList.find((e) => e.key === key);
        return found ? found.label : humanizeKey(key);
      });
      line +=
        labels.length <= 2
          ? `. Next, ${labels.join(" and ")}`
          : ". Next, a mixed round";
    }
    tts.speakSystem(line, settings.voiceSpeed);
  }, [tts, settings.voiceSpeed, emphasisList]);

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
    } else {
      planRoundRef.current += 1;
      applyPlannedRound(planRoundRef.current);
    }
    calloutEngineRef.current?.resetRoundPace?.();
    // Round starting - big bell
    sfx.playBell();
  }, [sfx, applyRoadmapRound, applyPlannedRound]);

  // Create refs to store latest values for workout completion
  const calloutEngineRef = React.useRef<any>(null);
  const settingsRef = React.useRef(settings);
  const timerRef = React.useRef<any>(null);
  const viewCompletionScreenRef = React.useRef<any>(null);

  // Update refs when values change
  settingsRef.current = settings;

  const handleWorkoutComplete = useCallback(() => {
    if (!calloutEngineRef.current || !timerRef.current) return;

    // The audio keepalive is deliberately left running — see useSoundEffects.
    // Releasing it here cost a pop at every session end and another ~30s later.

    const active = activeRoadmapRef.current;

    // Save workout log and show completion screen
    const logEntry = createWorkoutLogEntry(
      settingsForLog(settingsRef.current),
      timerRef.current,
      calloutEngineRef.current.shotsCalledOutRef.current,
      emphasisList,
      "completed",
      active ? roadmapLogRef(active.path, active.level) : null
    );

    // The counterpart to WorkoutStart, which has been firing alone: the event
    // existed in AnalyticsEvents but nothing ever sent it, so GA4 recorded
    // every round that began and none that finished, and the completion rate
    // was unanswerable. Params mirror WorkoutStart so the two can be compared
    // on the same cuts — style, difficulty, round count.
    const finishedEmphases = Object.keys(settingsRef.current.selectedEmphases)
      .filter((k) => settingsRef.current.selectedEmphases[k as EmphasisKey]);
    trackEvent(AnalyticsEvents.WorkoutComplete, {
      selected_emphases: finishedEmphases.join(","),
      emphasis_count: finishedEmphases.length,
      difficulty: settingsRef.current.difficulty,
      rounds: settingsRef.current.roundsCount,
      guided: active != null,
    });

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
    clearSessionPlan();

    // Trigger stats refresh
    triggerStatsRefresh();

    // Show completion screen
    if (viewCompletionScreenRef.current) {
      viewCompletionScreenRef.current(logEntry);
    }

    // Announce completion
    tts.speakSystem("Workout complete! Great job!", settingsRef.current.voiceSpeed);
  }, [emphasisList, triggerStatsRefresh, tts, restoreUserSettings, clearSessionPlan]);

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

  // Calisthenics finisher: inside the last stretch of a round, swap the pool
  // for the calisthenics list. The engine reads its pool on every callout, so
  // the round carries straight on. The next round's own pool goes back in at
  // its boundary, and pausing inside the finisher leaves it in place.
  useEffect(() => {
    const plan = sessionPlanRef.current;
    const engine = calloutEngineRef.current;
    if (!plan || !engine || activeRoadmapRef.current) return;
    if (!timer.running || timer.isResting || timer.timeLeft <= 0) return;
    const round = planRoundRef.current;
    if (finisherRoundRef.current === round) return;
    const planned = plan[Math.min(round, plan.length) - 1];
    if (planned?.calisthenics !== "finisher") return;
    const windowSec = finisherSeconds(settings.roundMin);
    if (!windowSec || timer.timeLeft > windowSec) return;

    finisherRoundRef.current = round;
    const cal = calisthenicsPool(
      techniquesRef.current,
      techniqueIndexRef.current
    );
    if (!cal.length) return;
    engine.currentPoolRef.current = cal;
    engine.poolSharesRef.current = null;
    engine.betweenCalloutRef.current = null;
    switchPoolKey("finisher");
    // Mark the switch. A sound rather than a spoken cue, which would land on
    // top of a callout; the interval bell rather than the big one, which
    // means a round has started or ended.
    sfx.playWarningSound();
  }, [
    sfx,
    timer.timeLeft,
    timer.running,
    timer.isResting,
    settings.roundMin,
    techniquesRef,
    techniqueIndexRef,
    switchPoolKey,
  ]);

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
    // A paused countdown has to say so. Otherwise it reads as "Get Ready!"
    // above a number that has stopped moving — which is indistinguishable
    // from the freeze this pause was added to give people a way out of.
    if (timer.isPreRound) return timer.paused ? "paused" : "pre-round";
    if (!timer.running) return "ready";
    if (timer.paused) return "paused";
    if (timer.isResting) return "resting";
    return "running";
  }, [timer.isPreRound, timer.running, timer.paused, timer.isResting]);

  // Wake Lock
  const shouldKeepAwake =
    (timer.running || timer.isPreRound) && !timer.paused;
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
    // A structure needs techniques to arrange, and Pro to have been chosen.
    const structure =
      isPro && !noTechniqueMode
        ? settings.roundStructure
        : DEFAULT_ROUND_STRUCTURE;
    trackEvent(AnalyticsEvents.WorkoutStart, {
      selected_emphases: activeEmphases.join(","),
      emphasis_count: activeEmphases.length,
      difficulty: settings.difficulty,
      rounds: settings.roundsCount,
      mix_mode: structure.mixMode,
      structured: !isDefaultStructure(structure),
    });

    // Unlock audio for iOS Safari (must happen during user gesture)
    // CRITICAL: TTS unlock must be synchronous - no await before it!
    tts.ensureTTSUnlocked();
    await sfx.ensureMediaUnlocked();
    // Hold the output path open until the session ends, so the bell at each
    // round boundary is not powering the speaker back up from standby.
    void sfx.startKeepAlive();

    // Init Engine
    calloutEngine.currentPoolRef.current = pool;
    calloutEngine.orderedIndexRef.current = 0;
    calloutEngine.shotsCalledOutRef.current = 0;
    if (noTechniqueMode) {
      clearSessionPlan();
    } else {
      // Every technique session runs off a plan, including the ordinary one —
      // its plan is simply the same round each time.
      beginSessionPlan({
        structure,
        styleOrder: reconcileStyleOrder(
          settings.styleOrder,
          settings.selectedEmphases
        ),
        roundsCount: settings.roundsCount,
        addCalisthenics: settings.addCalisthenics,
      });
      applyPlannedRound(1);
    }

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
    isPro,
    beginSessionPlan,
    applyPlannedRound,
    clearSessionPlan,
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

      // A guided level drives its own pool; it has no round plan.
      clearSessionPlan();

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
        void sfx.startKeepAlive();
        calloutEngine.currentPoolRef.current = poolForRound(path, level, 1);
        calloutEngine.orderedIndexRef.current = 0;
        calloutEngine.shotsCalledOutRef.current = 0;
        tts.speakSystem("Get ready", settingsRef.current.voiceSpeed);
        timer.startTimer();
        scrollContentToTop();
      }, 150);
    },
    [settings, calloutEngine, tts, sfx, timer, setPage, parkUserSettings, clearSessionPlan]
  );

  const pauseSession = useCallback(() => {
    // Pre-round too: the button is on screen during "Get Ready" and used to do
    // nothing there, because `running` stays false until the countdown ends.
    if (!timer.running && !timer.isPreRound) return;

    // If currently paused, we're resuming
    if (timer.paused) {
      timer.pauseTimer(); // Toggle to unpause
      setIsInterruptedByCall(false); // Clear call interruption flag on resume
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.resume();
        } catch { /* a throwing speechSynthesis must not kill the round */ }
      }
    } else {
      // Currently running, so pause
      timer.pauseTimer(); // Toggle to pause
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.pause();
        } catch { /* a throwing speechSynthesis must not kill the round */ }
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
      settingsForLog(settings),
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
      // ...and puts you back on the level you just quit, rather than the home
      // screen. You stopped in the middle of a lesson; the lesson is where the
      // way back in is.
      setRoadmapFocusLevel(active.level.id);
      setPage("roadmap");
    }
    clearSessionPlan();
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
    restoreUserSettings,
    setRoadmapFocusLevel,
    setPage,
    clearSessionPlan,
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
        clearSessionPlan();
        activeRoadmapRef.current = { path, level };
        setActiveRoadmap({ path, level });
        roadmapRoundRef.current = resumeRound;
        calloutEngine.shotsCalledOutRef.current = logEntry.shotsCalledOut || 0;
        setPage("timer");

        setTimeout(async () => {
          await sfx.ensureMediaUnlocked();
          void sfx.startKeepAlive();
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

      // Read off the log entry rather than the settings: the setters above
      // have not landed in this closure, so `settings` here still holds
      // whatever was selected before Resume was tapped.
      const resumed = logEntry.settings;
      const resumedEmphases: Record<EmphasisKey, boolean> =
        resumed?.selectedEmphases ?? settings.selectedEmphases;
      const resumedCalisthenics = Boolean(
        resumed ? resumed.addCalisthenics : settings.addCalisthenics
      );
      const noTechniqueMode = Boolean(
        resumedEmphases.timer_only || resumedEmphases.freestyle
      );

      setTimeout(async () => {
        const pool = generateTechniquePool(
          techniquesRef.current,
          resumedEmphases,
          resumedCalisthenics,
          techniqueIndexRef.current
        );
        if (!pool.length && !noTechniqueMode) {
          alert("Cannot resume: No techniques found.");
          return;
        }
        // Unlock audio for iOS Safari (must happen during user gesture)
        // CRITICAL: TTS unlock must be synchronous - no await before it!
        tts.ensureTTSUnlocked();
        await sfx.ensureMediaUnlocked();
        void sfx.startKeepAlive();

        calloutEngine.currentPoolRef.current = pool;
        calloutEngine.orderedIndexRef.current = 0;
        if (noTechniqueMode) {
          clearSessionPlan();
        } else {
          // Rebuild the plan the session was running, and rejoin it at the
          // round after the last one finished. An entry from before round
          // structure existed has none recorded, which reads as standard.
          beginSessionPlan({
            structure: isPro
              ? sanitizeRoundStructure(resumed?.roundStructure)
              : DEFAULT_ROUND_STRUCTURE,
            styleOrder: reconcileStyleOrder(
              Array.isArray(resumed?.styleOrder) ? resumed.styleOrder : [],
              resumedEmphases
            ),
            roundsCount: logEntry.roundsPlanned,
            addCalisthenics: resumedCalisthenics,
          });
          planRoundRef.current = (logEntry.roundsCompleted || 0) + 1;
          applyPlannedRound(planRoundRef.current);
        }

        timer.resumeTimerState(logEntry);
        tts.speakSystem("Resuming workout. Get ready", settings.voiceSpeed);
        scrollContentToTop();
      }, 150);
    },
    [
      settings,
      calloutEngine,
      setPage,
      techniquesRef,
      techniqueIndexRef,
      sfx,
      tts,
      timer,
      parkUserSettings,
      isPro,
      beginSessionPlan,
      applyPlannedRound,
      clearSessionPlan,
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
    sessionPlan,
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
