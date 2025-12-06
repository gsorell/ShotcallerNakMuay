import React, { useCallback, useEffect, useRef, useState } from "react";

// Types
import type { EmphasisKey, Page, TechniqueWithStyle } from "./types";

// Storage
import {
  DEFAULT_REST_MINUTES,
  VOICE_STORAGE_KEY,
  WORKOUTS_STORAGE_KEY,
} from "./constants/storage";

// Components
import ActiveSessionUI from "./components/ActiveSessionUI";
import { AppLayout } from "./components/AppLayout";
import { OnboardingModal } from "./components/OnboardingModal";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import StatusTimer from "./components/StatusTimer";
import WorkoutSetup from "./components/WorkoutSetup";

// Pages
import TechniqueEditor from "./pages/TechniqueEditor";
import WorkoutCompleted from "./pages/WorkoutCompleted";
import WorkoutLogs from "./pages/WorkoutLogs";

// Hooks
import { useAndroidAudioDucking } from "./hooks/useAndroidAudioDucking";
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
// NEW HOOKS
import { useWorkoutSettings } from "./hooks/useWorkoutSettings";
import { useWorkoutTimer } from "./hooks/useWorkoutTimer";

// Utilities
import { AnalyticsEvents, initializeGA4, trackEvent } from "./utils/analytics";
import { displayInAppBrowserWarning } from "./utils/inAppBrowserDetector";
import { generateTechniquePool } from "./utils/techniqueUtils";
import { mirrorTechnique } from "./utils/textUtils";
import { fmtTime } from "./utils/timeUtils";
import ttsService from "./utils/ttsService";

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
  const isEditorRef = useRef(false);

  useEffect(() => {
    isEditorRef.current = page === "editor";
  }, [page]);

  const { userEngagement, setUserEngagement } = useUserEngagement(isEditorRef);

  // --- 4. NEW: Settings Hook ---
  const settings = useWorkoutSettings(techniques, techniqueIndexRef);

  // --- 5. Sound & TTS ---
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

  const voice = currentVoice
    ? currentVoice.browserVoice ||
      unifiedVoices.find((v) => v.name === currentVoice.name)?.browserVoice ||
      null
    : null;

  // Helpers for TTS
  const speakSystem = useCallback(
    (text: string, v: any, s: number) => {
      ttsSpeakSystem(text, s);
    },
    [ttsSpeakSystem]
  );

  // --- 6. Callout Logic (Refs) ---
  const [currentCallout, setCurrentCallout] = useState<string>("");
  const calloutRef = useRef<number | null>(null);
  const shotsCalledOutRef = useRef<number>(0);
  const orderedIndexRef = useRef<number>(0);
  const currentPoolRef = useRef<TechniqueWithStyle[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Clean up narration helpers
  const stopAllNarration = useCallback(() => {
    if (calloutRef.current) {
      clearTimeout(calloutRef.current);
      calloutRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        utteranceRef.current = null;
      } catch {}
    }
  }, []);

  const stopTechniqueCallouts = useCallback(() => {
    if (calloutRef.current) {
      clearTimeout(calloutRef.current);
      calloutRef.current = null;
    }
    try {
      if (utteranceRef.current && typeof window !== "undefined") {
        window.speechSynthesis.cancel();
        utteranceRef.current = null;
      }
    } catch {}
  }, []);

  // --- 7. NEW: Timer Hook ---
  // We define callbacks first so the timer can trigger audio/logic
  const handleRoundStart = useCallback(() => {
    playBell();
  }, [playBell]);

  const handleRoundEnd = useCallback(() => {
    stopTTS();
    playBell();
    stopTechniqueCallouts();
    stopAllNarration();
    setCurrentCallout("");
  }, [stopTTS, playBell, stopTechniqueCallouts, stopAllNarration]);

  const handleWorkoutComplete = useCallback(() => {
    if (androidAudioDucking.isAndroidNative)
      void androidAudioDucking.releaseAudioFocus();

    // Log logic
    try {
      const entry = {
        id: `${Date.now()}`,
        timestamp: new Date().toISOString(),
        roundsPlanned: settings.roundsCount,
        roundsCompleted: settings.roundsCount,
        roundLengthMin: settings.roundMin,
        restMinutes: settings.restMinutes,
        difficulty: settings.difficulty,
        shotsCalledOut: shotsCalledOutRef.current,
        emphases: Object.entries(settings.selectedEmphases)
          .filter(([, v]) => v)
          .map(([k]) => {
            const found = emphasisList.find((e) => e.key === k);
            return found ? found.label : k;
          }),
        status: "completed",
        settings: {
          selectedEmphases: settings.selectedEmphases,
          addCalisthenics: settings.addCalisthenics,
          readInOrder: settings.readInOrder,
          southpawMode: settings.southpawMode,
        },
      };
      const raw = localStorage.getItem(WORKOUTS_STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push(entry);
      localStorage.setItem(WORKOUTS_STORAGE_KEY, JSON.stringify(arr));

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
    } catch (err) {}

    setLastWorkout({
      timestamp: new Date().toISOString(),
      emphases: Object.entries(settings.selectedEmphases)
        .filter(([, v]) => v)
        .map(([k]) => k), // Simplified for brevity
      difficulty: settings.difficulty,
      shotsCalledOut: shotsCalledOutRef.current,
      roundsCompleted: settings.roundsCount,
      roundsPlanned: settings.roundsCount,
      roundLengthMin: settings.roundMin,
      suggestInstall: !pwa.isInstalled && userEngagement.completedWorkouts >= 1,
    });
    setPage("completed");
  }, [
    androidAudioDucking,
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

  // --- 8. Complex Callout Logic (Still needs Refs, so kept here but simplified) ---
  const runningRef = useRef(timer.running);
  const pausedRef = useRef(timer.paused);
  const isRestingRef = useRef(timer.isResting);
  const ttsGuardRef = useRef(false);

  useEffect(() => {
    runningRef.current = timer.running;
  }, [timer.running]);
  useEffect(() => {
    pausedRef.current = timer.paused;
  }, [timer.paused]);
  useEffect(() => {
    isRestingRef.current = timer.isResting;
  }, [timer.isResting]);

  useEffect(() => {
    ttsGuardRef.current = !timer.running || timer.paused || timer.isResting;
    if (ttsGuardRef.current) {
      stopTechniqueCallouts();
      stopAllNarration();
      setCurrentCallout("");
    }
  }, [
    timer.running,
    timer.paused,
    timer.isResting,
    stopTechniqueCallouts,
    stopAllNarration,
  ]);

  // Update TTS Guards inside the library if supported
  useEffect(() => {
    try {
      // @ts-ignore
      if (typeof (ttsSpeak as any).updateGuards === "function") {
        // @ts-ignore
        (ttsSpeak as any).updateGuards(
          ttsGuardRef.current || false,
          runningRef.current || false
        );
      }
    } catch (e) {}
  }, [ttsSpeak, timer.running, timer.paused, timer.isResting]);

  const startTechniqueCallouts = useCallback(
    (initialDelay = 800) => {
      const cadencePerMin =
        settings.difficulty === "easy"
          ? 20
          : settings.difficulty === "hard"
          ? 42
          : 26;
      const baseDelayMs = Math.round(60000 / cadencePerMin);
      const minDelayMultiplier = settings.difficulty === "hard" ? 0.35 : 0.5;
      const minDelayMs = Math.round(baseDelayMs * minDelayMultiplier);

      const scheduleNext = (delay: number) => {
        if (calloutRef.current) {
          clearTimeout(calloutRef.current);
          calloutRef.current = null;
        }
        calloutRef.current = window.setTimeout(
          doCallout,
          Math.max(0, delay)
        ) as unknown as number;
      };

      const doCallout = () => {
        if (
          ttsGuardRef.current ||
          !runningRef.current ||
          pausedRef.current ||
          isRestingRef.current
        ) {
          stopTechniqueCallouts();
          return;
        }
        const pool = currentPoolRef.current;
        if (!pool.length) {
          stopTechniqueCallouts();
          return;
        }

        let selectedTechnique: TechniqueWithStyle;
        if (settings.readInOrder) {
          selectedTechnique = pool[orderedIndexRef.current % pool.length]!;
          orderedIndexRef.current += 1;
        } else {
          selectedTechnique = pool[Math.floor(Math.random() * pool.length)]!;
        }

        shotsCalledOutRef.current += 1;

        try {
          const finalPhrase = settings.southpawModeRef.current
            ? mirrorTechnique(selectedTechnique.text, selectedTechnique.style)
            : selectedTechnique.text;

          if (
            !finalPhrase ||
            typeof finalPhrase !== "string" ||
            finalPhrase.trim() === ""
          ) {
            setCurrentCallout(selectedTechnique.text || "");
            return;
          }

          setCurrentCallout(finalPhrase);

          ttsSpeakSystemWithDuration(
            finalPhrase,
            settings.voiceSpeedRef.current,
            (actualDurationMs: number) => {
              const isPro = settings.difficulty === "hard";
              const bufferMultiplier = isPro ? 0.12 : 0.2;
              const bufferTime = Math.max(
                isPro ? 120 : 200,
                Math.min(isPro ? 500 : 800, baseDelayMs * bufferMultiplier)
              );
              const jitterMultiplier = isPro ? 0.05 : 0.08;
              const jitter = Math.floor(
                baseDelayMs * jitterMultiplier * (Math.random() - 0.5)
              );
              const responsiveDelayMs = actualDurationMs + bufferTime + jitter;
              const timingCap = isPro ? baseDelayMs * 0.85 : baseDelayMs * 1.1;
              const nextDelayMs = Math.max(
                minDelayMs,
                Math.min(responsiveDelayMs, timingCap)
              );
              scheduleNext(nextDelayMs);
            }
          );
          return;
        } catch (error) {}

        // Fallback
        const finalPhrase = settings.southpawModeRef.current
          ? mirrorTechnique(selectedTechnique.text, selectedTechnique.style)
          : selectedTechnique.text;
        setCurrentCallout(finalPhrase || "");

        const isPro = settings.difficulty === "hard";
        const jitterMultiplier = isPro ? 0.05 : 0.08;
        const fallbackMultiplier = isPro ? 0.65 : 0.8;
        const jitter = Math.floor(
          baseDelayMs * jitterMultiplier * (Math.random() - 0.5)
        );
        const nextDelayMs = Math.max(
          minDelayMs,
          baseDelayMs * fallbackMultiplier + jitter
        );
        scheduleNext(nextDelayMs);
      };
      scheduleNext(initialDelay);
    },
    [
      settings.difficulty,
      settings.readInOrder,
      settings.southpawModeRef,
      settings.voiceSpeedRef,
      stopTechniqueCallouts,
      ttsSpeakSystemWithDuration,
    ]
  );

  // Start Callouts Effect
  useEffect(() => {
    if (!timer.running || timer.paused || timer.isResting) return;
    startTechniqueCallouts(800);
    return () => {
      stopTechniqueCallouts();
      stopAllNarration();
    };
  }, [
    timer.running,
    timer.paused,
    timer.isResting,
    startTechniqueCallouts,
    stopTechniqueCallouts,
    stopAllNarration,
  ]);

  // Audio pause on visibility change (for speech synthesis specifically)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isHidden = document.hidden || document.visibilityState === "hidden";
      if (
        isHidden &&
        timer.running &&
        !timer.paused &&
        !timer.isResting &&
        !timer.isPreRound
      ) {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          try {
            window.speechSynthesis.pause();
          } catch {}
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [timer.running, timer.paused, timer.isResting, timer.isPreRound]);

  // WakeLock
  const shouldKeepAwake = (timer.running && !timer.paused) || timer.isPreRound;
  useWakeLock({ enabled: shouldKeepAwake, log: false });

  // --- 9. Navigation / PWA / Misc ---
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
        const timer = setTimeout(() => {
          if (!pwa.isInstalled && !isEditorRef.current) setShowPWAPrompt(true);
        }, 30000);
        return () => clearTimeout(timer);
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

  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const homePageStats = useHomeStats(statsRefreshTrigger);
  const favoriteConfig = homePageStats?.mostCommonEmphasis
    ? emphasisList.find(
        (e) =>
          e.label.trim().toLowerCase() ===
          homePageStats.mostCommonEmphasis.trim().toLowerCase()
      )
    : null;
  const isActive = timer.running || timer.isPreRound;

  // --- 10. Actions ---
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

    try {
      trackEvent(AnalyticsEvents.WorkoutStart, {
        selected_emphases: Object.keys(settings.selectedEmphases).filter(
          (k) => settings.selectedEmphases[k as EmphasisKey]
        ),
        difficulty: settings.difficulty,
        rounds: settings.roundsCount,
      });
    } catch (e) {}

    void ensureMediaUnlocked();
    if (androidAudioDucking.isAndroidNative)
      void androidAudioDucking.requestAudioFocus();

    if (settings.readInOrder) {
      currentPoolRef.current = pool;
    } else {
      currentPoolRef.current = pool.sort(() => Math.random() - 0.5);
    }
    orderedIndexRef.current = 0;
    shotsCalledOutRef.current = 0;

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
    stopTTS();
    if (androidAudioDucking.isAndroidNative)
      void androidAudioDucking.releaseAudioFocus();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    // Auto-log partially completed workout
    let roundsCompleted = 0;
    if (timer.currentRound > 0) {
      roundsCompleted = timer.isResting
        ? timer.currentRound
        : Math.max(0, timer.currentRound - 1);
    }
    if (!timer.running && timer.currentRound > settings.roundsCount)
      roundsCompleted = settings.roundsCount;

    try {
      const entry = {
        id: `${Date.now()}`,
        timestamp: new Date().toISOString(),
        roundsPlanned: settings.roundsCount,
        roundsCompleted,
        roundLengthMin: settings.roundMin,
        restMinutes: settings.restMinutes,
        difficulty: settings.difficulty,
        shotsCalledOut: shotsCalledOutRef.current,
        emphases: Object.entries(settings.selectedEmphases)
          .filter(([, v]) => v)
          .map(([k]) => k),
        status: "abandoned",
        settings: {
          selectedEmphases: settings.selectedEmphases,
          addCalisthenics: settings.addCalisthenics,
          readInOrder: settings.readInOrder,
          southpawMode: settings.southpawMode,
        },
      };
      const raw = localStorage.getItem(WORKOUTS_STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push(entry);
      localStorage.setItem(WORKOUTS_STORAGE_KEY, JSON.stringify(arr));
      setStatsRefreshTrigger((prev) => prev + 1);
    } catch (err) {}

    timer.stopTimer();
    stopTechniqueCallouts();
    stopAllNarration();
    setCurrentCallout("");
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
      shotsCalledOutRef.current = logEntry.shotsCalledOut || 0;
      setPage("timer");

      setTimeout(() => {
        const pool = getTechniquePool();
        if (!pool.length && !logEntry.settings?.selectedEmphases?.timer_only) {
          alert("Cannot resume: No techniques found.");
          return;
        }
        void ensureMediaUnlocked();
        if (logEntry.settings?.readInOrder) {
          currentPoolRef.current = pool;
        } else {
          currentPoolRef.current = pool.sort(() => Math.random() - 0.5);
        }
        orderedIndexRef.current = 0;

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
    [getTechniquePool, ensureMediaUnlocked, settings, voice, speakSystem, timer]
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

  // --- 11. Render ---
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
                  currentCallout={currentCallout}
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

            {isActive && (
              <StatusTimer
                time={fmtTime(timer.timeLeft)}
                round={timer.currentRound}
                totalRounds={settings.roundsCount}
                status={getStatus()}
                isResting={timer.isResting}
                restTimeLeft={timer.restTimeLeft}
                isPreRound={timer.isPreRound}
                preRoundTimeLeft={timer.preRoundTimeLeft}
                fmtTime={fmtTime}
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
