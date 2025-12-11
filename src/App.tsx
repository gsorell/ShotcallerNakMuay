import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// Types
import type { EmphasisKey, Page, TechniqueWithStyle } from "./types";

// Storage
import { DEFAULT_REST_MINUTES, VOICE_STORAGE_KEY } from "./constants/storage";

// Components
import ActiveSessionUI from "./components/ActiveSessionUI";
import { AppLayout } from "./components/AppLayout";
import { OnboardingModal } from "./components/OnboardingModal";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import WorkoutSetup from "./components/WorkoutSetup";

// Pages
import TechniqueEditor from "./pages/TechniqueEditor";
import WorkoutCompleted from "./pages/WorkoutCompleted";
import WorkoutLogs from "./pages/WorkoutLogs";

// Hooks
import { useAndroidAudioDucking } from "./hooks/useAndroidAudioDucking";
import { useCalloutEngine } from "./hooks/useCalloutEngine";
import { useEmphasisList } from "./hooks/useEmphasisList";
import { useHomeStats } from "./hooks/useHomeStats";
import { useIOSAudioSession } from "./hooks/useIOSAudioSession";
import { useNavigationGestures } from "./hooks/useNavigationGestures";
import { usePWA } from "./hooks/usePWA";
import { useSoundEffects } from "./hooks/useSoundEffects";
import { useTechniqueData } from "./hooks/useTechniqueData";
import { useTTS } from "./hooks/useTTS";
import { useUserEngagement } from "./hooks/useUserEngagement";
import { useWakeLock } from "./hooks/useWakeLock";
import { useWorkoutSettings } from "./hooks/useWorkoutSettings";
import { useWorkoutTimer } from "./hooks/useWorkoutTimer";

// Utilities
import { AnalyticsEvents, initializeGA4, trackEvent } from "./utils/analytics";
import { displayInAppBrowserWarning } from "./utils/inAppBrowserDetector";
import { createWorkoutLogEntry } from "./utils/logUtils";
import { generateTechniquePool } from "./utils/techniqueUtils";
import { fmtTime } from "./utils/timeUtils";
import { ttsService } from "./utils/ttsService";

// CSS
import "./App.css";
import "./styles/difficulty.css";

// Global state to persist modal scroll position across re-renders
let modalScrollPosition = 0;

export default function App() {
  // --- 1. Init & Global Config ---
  useEffect(() => {
    displayInAppBrowserWarning();
    initializeGA4();
    // Clean up voice prefs on load
    try {
      const stored = localStorage.getItem(VOICE_STORAGE_KEY);
      if (stored) {
        const voiceData = JSON.parse(stored);
        if (!voiceData.lang?.toLowerCase().startsWith("en")) {
          localStorage.removeItem(VOICE_STORAGE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(VOICE_STORAGE_KEY);
    }
  }, []);

  // --- 2. Data Hooks ---
  const pwa = usePWA();
  const iosAudioSession = useIOSAudioSession();
  const androidAudioDucking = useAndroidAudioDucking();
  const { techniques, persistTechniques, techniquesRef, techniqueIndexRef } =
    useTechniqueData();
  const emphasisList = useEmphasisList(techniques);

  // --- 3. UI State ---
  const [showPWAPrompt, setShowPWAPrompt] = useState(false);
  const [page, setPage] = useState<Page>("timer");
  const [lastWorkout, setLastWorkout] = useState<any>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAllEmphases, setShowAllEmphases] = useState(false);
  const [showOnboardingMsg, setShowOnboardingMsg] = useState(false);
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const isEditorRef = useRef(false);

  useEffect(() => {
    isEditorRef.current = page === "editor";
  }, [page]);

  const { userEngagement, setUserEngagement } = useUserEngagement(isEditorRef);
  const settings = useWorkoutSettings(techniques, techniqueIndexRef);

  // --- 4. Sound & TTS ---
  const { playBell, playWarningSound, ensureMediaUnlocked } =
    useSoundEffects(iosAudioSession);

  const saveVoicePreference = useCallback(
    (voice: SpeechSynthesisVoice | null) => {
      if (!voice || !voice.lang.toLowerCase().startsWith("en")) {
        localStorage.removeItem(VOICE_STORAGE_KEY);
        return;
      }
      localStorage.setItem(
        VOICE_STORAGE_KEY,
        JSON.stringify({
          name: voice.name,
          lang: voice.lang,
          localService: voice.localService,
          default: voice.default,
        })
      );
    },
    []
  );

  const {
    voices: unifiedVoices,
    currentVoice,
    setCurrentVoice,
    speak: ttsSpeak,
    speakSystem: ttsSpeakSystem,
    speakSystemWithDuration: ttsSpeakSystemWithDuration,
    stop: stopTTS,
    isAvailable: ttsAvailable,
    voiceCompatibilityWarning,
    testVoice: ttsTestVoice,
  } = useTTS();

  const derivedVoice = useMemo(() => {
    if (!currentVoice) return null;
    if (currentVoice.browserVoice) return currentVoice.browserVoice;

    const found = unifiedVoices.find((v) => v.name === currentVoice.name);
    return found ? found.browserVoice : null;
  }, [currentVoice, unifiedVoices]);

  // TMP(or.ricon): temporarily log for debugging voice selection
  useEffect(() => {
    console.log("[Voice Debug]", {
      hasCurrentVoice: !!currentVoice,
      currentVoiceName: currentVoice?.name,
      totalUnifiedVoices: unifiedVoices.length,
      resolvedVoice: derivedVoice,
    });
  }, [currentVoice, unifiedVoices, derivedVoice]);

  const voice = derivedVoice;

  const speakSystem = useCallback(
    (text: string, v: any, s: number) => {
      ttsSpeakSystem(text, s);
    },
    [ttsSpeakSystem]
  );

  // --- 5. Timer & Logic Handlers ---

  // NOTE: We define Callout Engine AFTER timer, but we need variables from it.
  // Actually we need timer state for callout engine.
  // We need to define the handlers for timer first.

  const stopSessionCleanup = useCallback(() => {
    stopTTS();
    if (androidAudioDucking.isAndroidNative)
      void androidAudioDucking.releaseAudioFocus();
  }, [stopTTS, androidAudioDucking]);

  const handleRoundStart = useCallback(() => {
    playBell();
  }, [playBell]);

  // We need a ref to access the callout engine's stop method inside round end
  const stopCalloutsRef = useRef<() => void>(() => {});
  const setCurrentCalloutRef = useRef<(s: string) => void>(() => {});
  const shotsCalledOutRef = useRef<number>(0);

  const handleRoundEnd = useCallback(() => {
    stopSessionCleanup();
    playBell();
    stopCalloutsRef.current(); // Stop the engine
    setCurrentCalloutRef.current("");
  }, [stopSessionCleanup, playBell]);

  const handleWorkoutComplete = useCallback(() => {
    stopSessionCleanup();

    const logEntry = createWorkoutLogEntry(
      settings,
      { running: false, currentRound: settings.roundsCount } as any,
      shotsCalledOutRef.current,
      emphasisList,
      "completed"
    );

    // Update Engagement
    const updatedEngagement = {
      ...userEngagement,
      completedWorkouts: userEngagement.completedWorkouts + 1,
    };
    setUserEngagement(updatedEngagement);
    localStorage.setItem(
      "user_engagement_stats",
      JSON.stringify({
        ...updatedEngagement,
        lastVisit: updatedEngagement.lastVisit.toISOString(),
      })
    );
    setStatsRefreshTrigger((prev) => prev + 1);

    // Set UI Data
    setLastWorkout({
      timestamp: logEntry.timestamp,
      emphases: logEntry.emphases,
      difficulty: logEntry.difficulty,
      shotsCalledOut: logEntry.shotsCalledOut,
      roundsCompleted: logEntry.roundsCompleted,
      roundsPlanned: logEntry.roundsPlanned,
      roundLengthMin: logEntry.roundLengthMin,
      suggestInstall: !pwa.isInstalled && userEngagement.completedWorkouts >= 1,
    });
    setPage("completed");
  }, [
    stopSessionCleanup,
    settings,
    emphasisList,
    userEngagement,
    setUserEngagement,
    pwa.isInstalled,
  ]);

  const handleRestWarning = useCallback(() => {
    speakSystem("10 seconds", voice, settings.voiceSpeed);
  }, [speakSystem, voice, settings.voiceSpeed]);

  const handleRestBell = useCallback(() => {
    playWarningSound();
  }, [playWarningSound]);

  const handleRestEnd = useCallback(() => {
    playBell();
  }, [playBell]);

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

  // --- 6. The Callout Engine (New Hook) ---
  const calloutEngine = useCalloutEngine({
    timer,
    settings,
    tts: { speakSystemWithDuration: ttsSpeakSystemWithDuration },
  });

  // Link refs for callbacks
  useEffect(() => {
    stopCalloutsRef.current = calloutEngine.stopTechniqueCallouts;
    setCurrentCalloutRef.current = calloutEngine.setCurrentCallout;
    // We sync the ref so we can log it later
    shotsCalledOutRef.current = calloutEngine.shotsCalledOutRef.current;
  }, [
    calloutEngine.stopTechniqueCallouts,
    calloutEngine.setCurrentCallout,
    calloutEngine.shotsCalledOutRef.current,
  ]);

  // Keep Ref updated constantly for the complete handler
  useEffect(() => {
    shotsCalledOutRef.current = calloutEngine.shotsCalledOutRef.current;
  });

  // WakeLock
  const shouldKeepAwake = (timer.running && !timer.paused) || timer.isPreRound;
  useWakeLock({ enabled: shouldKeepAwake, log: false });

  // --- 7. Navigation / PWA ---
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (isEditorRef.current) return;
    if (!pwa.isInstalled) {
      const dismissed = localStorage.getItem("pwa_install_dismissed");
      if (!dismissed) {
        const t = setTimeout(() => {
          if (!pwa.isInstalled && !isEditorRef.current) setShowPWAPrompt(true);
        }, 30000);
        return () => clearTimeout(t);
      }
    }
    return;
  }, [pwa.isInstalled]);

  useNavigationGestures({
    onBack: () => {
      if (showOnboardingMsg) setShowOnboardingMsg(false);
      else if (page === "editor" || page === "logs" || page === "completed")
        setPage("timer");
    },
    enabled: page !== "timer" || showOnboardingMsg,
    debugLog: false,
  });

  const homePageStats = useHomeStats(statsRefreshTrigger);
  const favoriteConfig = homePageStats?.mostCommonEmphasis
    ? emphasisList.find(
        (e) =>
          e.label.trim().toLowerCase() ===
          homePageStats.mostCommonEmphasis.trim().toLowerCase()
      )
    : null;
  const isActive = timer.running || timer.isPreRound;

  // --- 8. Actions ---
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

  function getStatus():
    | "ready"
    | "running"
    | "paused"
    | "stopped"
    | "resting"
    | "pre-round" {
    if (timer.isPreRound) return "pre-round";
    if (!timer.running) return "ready";
    if (timer.paused) return "paused";
    if (timer.isResting) return "resting";
    return "running";
  }

  function startSession() {
    if (!hasSelectedEmphasis) return;
    const pool = getTechniquePool();
    const timerOnlySelected =
      settings.selectedEmphases.timer_only &&
      Object.values(settings.selectedEmphases).filter(Boolean).length === 1;
    if (!pool.length && !timerOnlySelected) {
      alert("No techniques found for the selected emphasis(es).");
      return;
    }

    trackEvent(AnalyticsEvents.WorkoutStart, {
      selected_emphases: Object.keys(settings.selectedEmphases).filter(
        (k) => settings.selectedEmphases[k as EmphasisKey]
      ),
      difficulty: settings.difficulty,
      rounds: settings.roundsCount,
    });

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
        voice: voice
          ? {
              id: voice.name,
              name: voice.name,
              language: voice.lang,
              browserVoice: voice,
            }
          : null,
      });
    } catch {}

    speakSystem("Get ready", voice, settings.voiceSpeed);
    timer.startTimer();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function pauseSession() {
    if (!timer.running) return;
    const p = !timer.paused;
    timer.pauseTimer();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        if (p) window.speechSynthesis.pause();
        else window.speechSynthesis.resume();
      } catch {}
    }
  }

  function stopSession() {
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
    setStatsRefreshTrigger((prev) => prev + 1);

    timer.stopTimer();
    calloutEngine.setCurrentCallout("");
  }

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
            voice: voice
              ? {
                  id: voice.name,
                  name: voice.name,
                  language: voice.lang,
                  browserVoice: voice,
                }
              : null,
          });
        } catch {}

        timer.resumeTimerState(logEntry);
        speakSystem("Resuming workout. Get ready", voice, settings.voiceSpeed);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 150);
    },
    [
      getTechniquePool,
      ensureMediaUnlocked,
      settings,
      voice,
      speakSystem,
      timer,
      calloutEngine,
    ]
  );

  const viewCompletionScreen = useCallback((logEntry: any) => {
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
  }, []);

  const TechniqueEditorAny =
    TechniqueEditor as unknown as React.ComponentType<any>;

  const linkButtonStyle: React.CSSProperties = {
    all: "unset",
    cursor: "pointer",
    color: "#f9a8d4",
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid transparent",
    fontWeight: 700,
    background: "transparent",
    textAlign: "center",
  };

  // --- 9. Render ---
  return (
    <>
      <OnboardingModal
        open={showOnboardingMsg}
        modalScrollPosition={modalScrollPosition}
        linkButtonStyle={linkButtonStyle}
        setPage={setPage}
        onClose={() => setShowOnboardingMsg(false)}
      />

      <AppLayout
        isActive={isActive}
        page={page}
        onHelp={() => setShowOnboardingMsg(true)}
        onLogoClick={() => {
          setPage("timer");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        hasSelectedEmphasis={hasSelectedEmphasis}
        linkButtonStyle={linkButtonStyle}
        setPage={setPage}
        setShowOnboardingMsg={setShowOnboardingMsg}
      >
        {page === "logs" ? (
          <WorkoutLogs
            onBack={() => setPage("timer")}
            emphasisList={emphasisList}
            onResume={resumeWorkout}
            onViewCompletion={viewCompletionScreen}
          />
        ) : page === "editor" ? (
          <TechniqueEditorAny
            techniques={techniques}
            setTechniques={persistTechniques}
            onBack={() => setPage("timer")}
          />
        ) : page === "completed" && lastWorkout ? (
          <WorkoutCompleted
            stats={lastWorkout}
            onRestart={() => {
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
            }}
            onReset={() => setPage("timer")}
            onViewLog={() => setPage("logs")}
          />
        ) : (
          <>
            <div
              style={{
                minHeight: isActive ? "220px" : "0",
                transition: "min-height 0.3s ease-in-out",
              }}
            >
              <div
                style={{
                  minHeight: isActive ? "220px" : "0",
                  transition: "min-height 0.3s ease-in-out",
                }}
              >
                <ActiveSessionUI
                  running={timer.running}
                  isPreRound={timer.isPreRound}
                  paused={timer.paused}
                  isResting={timer.isResting}
                  timeLeft={timer.timeLeft}
                  currentRound={timer.currentRound}
                  roundsCount={settings.roundsCount}
                  restTimeLeft={timer.restTimeLeft}
                  preRoundTimeLeft={timer.preRoundTimeLeft}
                  fmtTime={fmtTime}
                  getStatus={getStatus}
                  currentCallout={calloutEngine.currentCallout}
                  onPause={pauseSession}
                  onStop={stopSession}
                  selectedEmphases={settings.selectedEmphases}
                  emphasisList={emphasisList}
                />
              </div>
            </div>

            {!isActive && (
              <WorkoutSetup
                stats={homePageStats}
                favoriteConfig={favoriteConfig}
                emphasisList={emphasisList}
                selectedEmphases={settings.selectedEmphases}
                toggleEmphasis={settings.toggleEmphasis}
                techniques={techniques}
                showAllEmphases={showAllEmphases}
                setShowAllEmphases={setShowAllEmphases}
                setPage={setPage}
                roundsCount={settings.roundsCount}
                setRoundsCount={settings.setRoundsCount}
                roundMin={settings.roundMin}
                setRoundMin={settings.setRoundMin}
                restMinutes={settings.restMinutes}
                setRestMinutes={settings.setRestMinutes}
                showAdvanced={showAdvanced}
                setShowAdvanced={setShowAdvanced}
                southpawMode={settings.southpawMode}
                setSouthpawMode={settings.setSouthpawMode}
                addCalisthenics={settings.addCalisthenics}
                setAddCalisthenics={settings.setAddCalisthenics}
                readInOrder={settings.readInOrder}
                setReadInOrder={settings.setReadInOrder}
                voice={voice}
                voices={unifiedVoices.map(
                  (v) =>
                    v.browserVoice ||
                    ({
                      name: v.name,
                      lang: v.language,
                      default: v.isDefault,
                      localService: true,
                      voiceURI: v.id,
                    } as SpeechSynthesisVoice)
                )}
                unifiedVoices={unifiedVoices}
                setCurrentVoice={setCurrentVoice}
                saveVoicePreference={saveVoicePreference}
                checkVoiceCompatibility={() => {}}
                ttsService={ttsService}
                voiceSpeed={settings.voiceSpeed}
                setVoiceSpeed={settings.setVoiceSpeed}
                ttsAvailable={ttsAvailable}
                testVoice={() => {
                  stopTTS();
                  setTimeout(() => ttsTestVoice(), 50);
                }}
                voiceCompatibilityWarning={voiceCompatibilityWarning as string}
                trackEvent={trackEvent}
                onStart={startSession}
                difficulty={settings.difficulty}
                setDifficulty={settings.setDifficulty}
                clearAllEmphases={settings.clearAllEmphases}
              />
            )}
          </>
        )}
      </AppLayout>

      <PWAInstallPrompt
        isVisible={showPWAPrompt && !pwa.isInstalled}
        onInstall={async () => {
          const success = await pwa.promptInstall();
          setShowPWAPrompt(false);
          return success;
        }}
        onDismiss={() => setShowPWAPrompt(false)}
        onDismissPermanently={() => {
          localStorage.setItem("pwa_install_dismissed", "true");
          setShowPWAPrompt(false);
        }}
      />
    </>
  );
}
