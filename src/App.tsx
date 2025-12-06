import React, { useCallback, useEffect, useRef, useState } from "react";

// Types
import type {
  Difficulty,
  EmphasisKey,
  Page,
  TechniqueWithStyle,
} from "./types";

// Storage
import {
  DEFAULT_REST_MINUTES,
  VOICE_STORAGE_KEY,
  WORKOUTS_STORAGE_KEY,
} from "./constants/storage";

// Components
import ActiveSessionUI from "./components/ActiveSessionUI";
import { AppLayout } from "./components/AppLayout"; // NEW IMPORT
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
import { useTechniqueData } from "./hooks/useTechniqueData"; // NEW IMPORT
import { useTTS } from "./hooks/useTTS";
import { useUserEngagement } from "./hooks/useUserEngagement";
import { useWakeLock } from "./hooks/useWakeLock";

// Utilities
import { AnalyticsEvents, initializeGA4, trackEvent } from "./utils/analytics";
import { displayInAppBrowserWarning } from "./utils/inAppBrowserDetector";
import { generateTechniquePool, normalizeKey } from "./utils/techniqueUtils";
import { mirrorTechnique } from "./utils/textUtils";
import { fmtTime } from "./utils/timeUtils";
import ttsService from "./utils/ttsService";
import {
  loadUserSettings,
  saveUserSettings,
} from "./utils/userSettingsManager";

// CSS
import "./App.css";
import "./styles/difficulty.css";

// Global state to persist modal scroll position across re-renders
let modalScrollPosition = 0;

export default function App() {
  useEffect(() => {
    displayInAppBrowserWarning();
    initializeGA4();

    // One-time cleanup: Remove any existing non-English voice preferences
    try {
      const stored = localStorage.getItem(VOICE_STORAGE_KEY);
      if (stored) {
        const voiceData = JSON.parse(stored);
        const isEnglish =
          voiceData.lang && voiceData.lang.toLowerCase().startsWith("en");
        if (!isEnglish) {
          localStorage.removeItem(VOICE_STORAGE_KEY);
        }
      }
    } catch (error) {
      localStorage.removeItem(VOICE_STORAGE_KEY);
    }
  }, []);

  // --- 1. Data & State Hooks ---
  const pwa = usePWA();
  const iosAudioSession = useIOSAudioSession();
  const androidAudioDucking = useAndroidAudioDucking();
  const { techniques, persistTechniques, techniquesRef, techniqueIndexRef } =
    useTechniqueData(); // Using new hook

  const [showPWAPrompt, setShowPWAPrompt] = useState(false);
  const isEditorRef = useRef(false);
  const { userEngagement, setUserEngagement } = useUserEngagement(isEditorRef);

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // PWA Prompt Timer
  useEffect(() => {
    if (isEditorRef.current) return;
    if (!pwa.isInstalled) {
      const dismissed = localStorage.getItem("pwa_install_dismissed");
      if (!dismissed) {
        const timer = setTimeout(() => {
          if (!pwa.isInstalled && !isEditorRef.current) {
            setShowPWAPrompt(true);
          }
        }, 30000);
        return () => clearTimeout(timer);
      }
    }
    return;
  }, [pwa.isInstalled]);

  // Routing
  const [page, setPage] = useState<Page>("timer");
  const [lastWorkout, setLastWorkout] = useState<any>(null);

  useEffect(() => {
    isEditorRef.current = page === "editor";
  }, [page]);

  // Derived Data
  const emphasisList = useEmphasisList(techniques);

  // --- 2. User Settings ---
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
  const [southpawMode, setSouthpawMode] = useState(() => {
    try {
      const stored = localStorage.getItem("southpaw_mode");
      if (!stored) return false;
      return Boolean(JSON.parse(stored));
    } catch {
      try {
        localStorage.removeItem("southpaw_mode");
      } catch {}
      return false;
    }
  });

  const persistedSettings = loadUserSettings();
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [roundsCount, setRoundsCount] = useState(persistedSettings.roundsCount);
  const [roundMin, setRoundMin] = useState(persistedSettings.roundMin);
  const [restMinutes, setRestMinutes] = useState(persistedSettings.restMinutes);

  // UI Toggles
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAllEmphases, setShowAllEmphases] = useState(false);
  const [showOnboardingMsg, setShowOnboardingMsg] = useState(false);

  // --- 3. Interaction Handlers ---
  const closeOnboardingModal = useCallback(
    () => setShowOnboardingMsg(false),
    []
  );

  const toggleEmphasis = (k: EmphasisKey) => {
    setSelectedEmphases((prev) => {
      const isTurningOn = !prev[k];
      try {
        trackEvent(
          isTurningOn
            ? AnalyticsEvents.EmphasisSelect
            : AnalyticsEvents.EmphasisDeselect,
          { emphasis: k }
        );
      } catch (e) {}

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

  const handleBackNavigation = useCallback(() => {
    if (showOnboardingMsg) setShowOnboardingMsg(false);
    else if (page === "editor") setPage("timer");
    else if (page === "logs") setPage("timer");
    else if (page === "completed") setPage("timer");
  }, [showOnboardingMsg, page]);

  useNavigationGestures({
    onBack: handleBackNavigation,
    enabled: page !== "timer" || showOnboardingMsg,
    debugLog: false,
  });

  // --- 4. Voice / TTS Logic ---
  const saveVoicePreference = useCallback(
    (voice: SpeechSynthesisVoice | null) => {
      if (!voice) {
        localStorage.removeItem(VOICE_STORAGE_KEY);
        return;
      }
      const isEnglish = voice.lang.toLowerCase().startsWith("en");
      if (!isEnglish) {
        localStorage.removeItem(VOICE_STORAGE_KEY);
        return;
      }
      const voiceData = {
        name: voice.name,
        lang: voice.lang,
        localService: voice.localService,
        default: voice.default,
      };
      localStorage.setItem(VOICE_STORAGE_KEY, JSON.stringify(voiceData));
    },
    []
  );

  const checkVoiceCompatibility = useCallback(() => {}, []); // Legacy stub

  const [voiceSpeed, setVoiceSpeed] = useState<number>(
    persistedSettings.voiceSpeed
  );

  const {
    voices: unifiedVoices,
    currentVoice,
    setCurrentVoice,
    speak: ttsSpeak,
    speakSystem: ttsSpeakSystem,
    speakSystemWithDuration: ttsSpeakSystemWithDuration,
    speakTechnique: ttsSpeakTechnique,
    stop: stopTTS,
    isAvailable: ttsAvailable,
    voiceCompatibilityWarning,
    testVoice: ttsTestVoice,
  } = useTTS();

  // Compat for UI
  const voices = unifiedVoices.map((v) => {
    if (v.browserVoice) return v.browserVoice;
    return {
      name: v.name,
      lang: v.language,
      default: v.isDefault || false,
      localService: true,
      voiceURI: v.id,
    } as SpeechSynthesisVoice;
  });

  const voice = currentVoice
    ? currentVoice.browserVoice ||
      voices.find((v) => v.name === currentVoice.name) ||
      null
    : null;

  useEffect(() => saveUserSettings({ roundMin }), [roundMin]);
  useEffect(() => saveUserSettings({ restMinutes }), [restMinutes]);
  useEffect(() => saveUserSettings({ voiceSpeed }), [voiceSpeed]);
  useEffect(() => saveUserSettings({ roundsCount }), [roundsCount]);

  useEffect(() => {
    if (difficulty === "hard") setVoiceSpeed(1.4);
    else setVoiceSpeed(1);
  }, [difficulty]);

  const voiceSpeedRef = useRef(voiceSpeed);
  useEffect(() => {
    voiceSpeedRef.current = voiceSpeed;
  }, [voiceSpeed]);

  // --- 5. Timer State & Refs ---
  const [timeLeft, setTimeLeft] = useState(0);
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [isPreRound, setIsPreRound] = useState(false);
  const [preRoundTimeLeft, setPreRoundTimeLeft] = useState(0);
  const [currentCallout, setCurrentCallout] = useState<string>("");

  const calloutRef = useRef<number | null>(null);
  const shotsCalledOutRef = useRef<number>(0);
  const orderedIndexRef = useRef<number>(0);
  const currentPoolRef = useRef<TechniqueWithStyle[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const runningRef = useRef(running);
  const pausedRef = useRef(paused);
  const isRestingRef = useRef(isResting);
  const southpawModeRef = useRef(Boolean(southpawMode));

  useEffect(() => {
    runningRef.current = running;
  }, [running]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    isRestingRef.current = isResting;
  }, [isResting]);
  useEffect(() => {
    localStorage.setItem("southpaw_mode", JSON.stringify(southpawMode));
    southpawModeRef.current = Boolean(southpawMode);
  }, [southpawMode]);

  const shouldKeepAwake = (running && !paused) || isPreRound;
  useWakeLock({ enabled: shouldKeepAwake, log: false });

  // Update TTS Guards
  const ttsGuardRef = useRef<boolean>(false);
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
  }, [ttsSpeak, running, paused, isResting]);

  useEffect(() => {
    ttsGuardRef.current = !running || paused || isResting;
    if (ttsGuardRef.current) {
      stopTechniqueCallouts();
      stopAllNarration();
      setCurrentCallout("");
    }
  }, [running, paused, isResting]);

  // --- 6. Helper Functions ---
  const getTechniquePool = useCallback((): TechniqueWithStyle[] => {
    return generateTechniquePool(
      techniquesRef.current,
      selectedEmphases,
      addCalisthenics,
      techniqueIndexRef.current
    );
  }, [selectedEmphases, addCalisthenics]);

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

  const speakSystem = useCallback(
    (text: string, v: any, s: number) => {
      ttsSpeakSystem(text, s);
    },
    [ttsSpeakSystem]
  );

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

  const startTechniqueCallouts = useCallback(
    (initialDelay = 800) => {
      const cadencePerMin =
        difficulty === "easy" ? 20 : difficulty === "hard" ? 42 : 26;
      const baseDelayMs = Math.round(60000 / cadencePerMin);
      const minDelayMultiplier = difficulty === "hard" ? 0.35 : 0.5;
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
        if (readInOrder) {
          selectedTechnique = pool[orderedIndexRef.current % pool.length]!;
          orderedIndexRef.current += 1;
        } else {
          selectedTechnique = pool[Math.floor(Math.random() * pool.length)]!;
        }

        shotsCalledOutRef.current += 1;

        try {
          const finalPhrase = southpawModeRef.current
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
            voiceSpeedRef.current,
            (actualDurationMs: number) => {
              const isPro = difficulty === "hard";
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

        // Fallback logic
        const finalPhrase = southpawModeRef.current
          ? mirrorTechnique(selectedTechnique.text, selectedTechnique.style)
          : selectedTechnique.text;
        setCurrentCallout(finalPhrase || "");

        const isPro = difficulty === "hard";
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
    [difficulty, stopTechniqueCallouts, ttsSpeakSystemWithDuration, readInOrder]
  );

  const { playBell, playWarningSound, ensureMediaUnlocked } =
    useSoundEffects(iosAudioSession);

  // --- 7. Effects (Timer Logic) ---
  // Visibility Change
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isHidden = document.hidden || document.visibilityState === "hidden";
      if (isHidden && running && !paused && !isResting && !isPreRound) {
        setPaused(true);
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
  }, [running, paused, isResting, isPreRound]);

  // Pre-round Timer
  useEffect(() => {
    if (!isPreRound) return;
    if (preRoundTimeLeft <= 0) {
      setIsPreRound(false);
      playBell();
      setTimeLeft(Math.max(1, Math.round(roundMin * 60)));
      setIsResting(false);
      setPaused(false);
      setRunning(true);
      return;
    }
    const id = window.setTimeout(() => setPreRoundTimeLeft((t) => t - 1), 1000);
    return () => window.clearTimeout(id);
  }, [isPreRound, preRoundTimeLeft, playBell, roundMin]);

  // Start Callouts
  useEffect(() => {
    if (!running || paused || isResting) return;
    startTechniqueCallouts(800);
    return () => {
      stopTechniqueCallouts();
      stopAllNarration();
    };
  }, [
    running,
    paused,
    isResting,
    startTechniqueCallouts,
    stopTechniqueCallouts,
    stopAllNarration,
  ]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopTechniqueCallouts();
      stopAllNarration();
    };
  }, [stopTechniqueCallouts, stopAllNarration]);

  // Timer Tick
  useEffect(() => {
    if (!running || paused) return;
    let id: number | null = null;
    if (!isResting) {
      id = window.setInterval(
        () => setTimeLeft((prev) => Math.max(prev - 1, 0)),
        1000
      ) as unknown as number;
    } else {
      id = window.setInterval(
        () => setRestTimeLeft((prev) => Math.max(prev - 1, 0)),
        1000
      ) as unknown as number;
    }
    return () => {
      if (id) window.clearInterval(id);
    };
  }, [running, paused, isResting]);

  // Round Logic / Transitions
  const warningPlayedRef = useRef(false);
  const intervalBellPlayedRef = useRef(false);

  useEffect(() => {
    if (isResting) {
      warningPlayedRef.current = false;
      intervalBellPlayedRef.current = false;
    }
  }, [isResting]);

  useEffect(() => {
    if (!running || paused || isResting) return;
    if (timeLeft > 0) return;

    // Round ended
    stopTTS();
    playBell();
    stopTechniqueCallouts();
    stopAllNarration();
    setCurrentCallout("");

    if (currentRound >= roundsCount) {
      // Workout Finished
      try {
        autoLogWorkout(roundsCount);
      } catch {}
      if (androidAudioDucking.isAndroidNative)
        void androidAudioDucking.releaseAudioFocus();

      setLastWorkout({
        timestamp: new Date().toISOString(),
        emphases: Object.entries(selectedEmphases)
          .filter(([, v]) => v)
          .map(([k]) => {
            const found = emphasisList.find(
              (e) => e.key === (k as EmphasisKey)
            );
            return found ? found.label : k;
          }),
        difficulty,
        shotsCalledOut: shotsCalledOutRef.current,
        roundsCompleted: roundsCount,
        roundsPlanned: roundsCount,
        roundLengthMin: roundMin,
        suggestInstall:
          !pwa.isInstalled && userEngagement.completedWorkouts >= 1,
      });
      setRunning(false);
      setPaused(false);
      setIsResting(false);
      setPage("completed");
      return;
    }
    setIsResting(true);
    setRestTimeLeft(Math.max(1, Math.round(restMinutes * 60)));
  }, [
    timeLeft,
    running,
    paused,
    isResting,
    currentRound,
    roundsCount,
    playBell,
    stopAllNarration,
    stopTechniqueCallouts,
    stopTTS,
    restMinutes,
  ]);

  useEffect(() => {
    if (!running || paused || !isResting) return;

    if (restTimeLeft === 10 && !warningPlayedRef.current) {
      warningPlayedRef.current = true;
      speakSystem("10 seconds", voice, voiceSpeed);
    }
    if (restTimeLeft === 5 && !intervalBellPlayedRef.current) {
      intervalBellPlayedRef.current = true;
      playWarningSound();
    }
    if (restTimeLeft > 0) return;

    // Rest ended
    setIsResting(false);
    setCurrentRound((r) => r + 1);
    setTimeLeft(Math.max(1, Math.round(roundMin * 60)));
    playBell();
  }, [
    restTimeLeft,
    running,
    paused,
    isResting,
    roundMin,
    playBell,
    playWarningSound,
    speakSystem,
    voice,
    voiceSpeed,
  ]);

  useEffect(() => {
    setSelectedEmphases((prev) => {
      const curr = techniquesRef.current || {};
      const next = { ...prev };
      for (const k of Object.keys(prev) as (keyof typeof prev)[]) {
        if (prev[k]) {
          const exists =
            Object.prototype.hasOwnProperty.call(curr, k) ||
            Boolean(techniqueIndexRef.current[normalizeKey(String(k))]) ||
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
  }, [techniques]);

  // --- 8. Core Actions ---
  const hasSelectedEmphasis = Object.values(selectedEmphases).some(Boolean);

  function getStatus():
    | "ready"
    | "running"
    | "paused"
    | "stopped"
    | "resting"
    | "pre-round" {
    if (isPreRound) return "pre-round";
    if (!running) return "ready";
    if (paused) return "paused";
    if (isResting) return "resting";
    return "running";
  }

  function testVoice() {
    try {
      stopTTS();
      setTimeout(() => {
        ttsTestVoice();
      }, 50);
      // @ts-ignore
      setVoiceCompatibilityWarning("");
    } catch (error) {
      // @ts-ignore
      setVoiceCompatibilityWarning("Voice test failed.");
    }
  }

  function startSession() {
    if (!hasSelectedEmphasis) return;
    const pool = getTechniquePool();
    const timerOnlySelected =
      selectedEmphases.timer_only &&
      Object.values(selectedEmphases).filter(Boolean).length === 1;
    if (!pool.length && !timerOnlySelected) {
      alert("No techniques found for the selected emphasis(es).");
      return;
    }

    try {
      trackEvent(AnalyticsEvents.WorkoutStart, {
        selected_emphases: Object.keys(selectedEmphases).filter(
          (k) => selectedEmphases[k as EmphasisKey]
        ),
        difficulty,
        rounds: roundsCount,
        round_duration_minutes: roundMin,
        rest_duration_minutes: restMinutes,
      });
    } catch (e) {}

    void ensureMediaUnlocked();
    if (androidAudioDucking.isAndroidNative)
      void androidAudioDucking.requestAudioFocus();

    if (readInOrder) {
      currentPoolRef.current = pool;
    } else {
      currentPoolRef.current = pool.sort(() => Math.random() - 0.5);
    }
    orderedIndexRef.current = 0;
    shotsCalledOutRef.current = 0;

    try {
      ttsSpeak(" ", {
        volume: 0,
        rate: voiceSpeed,
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

    setCurrentRound(1);
    setIsPreRound(true);
    setPreRoundTimeLeft(5);
    speakSystem("Get ready", voice, voiceSpeed);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function pauseSession() {
    if (!running) return;
    const p = !paused;
    setPaused(p);
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

    let roundsCompleted = 0;
    if (currentRound > 0) {
      roundsCompleted = isResting
        ? currentRound
        : Math.max(0, currentRound - 1);
    }
    if (!running && currentRound > roundsCount) roundsCompleted = roundsCount;

    try {
      autoLogWorkout(roundsCompleted);
    } catch {}
    setPaused(false);
    setRunning(false);
    setCurrentRound(0);
    setTimeLeft(0);
    setIsResting(false);
    setIsPreRound(false);
    setPreRoundTimeLeft(0);
    stopTechniqueCallouts();
    stopAllNarration();
    setCurrentCallout("");
  }

  function autoLogWorkout(roundsCompleted: number) {
    const entry = {
      id: `${Date.now()}`,
      timestamp: new Date().toISOString(),
      roundsPlanned: roundsCount,
      roundsCompleted,
      roundLengthMin: roundMin,
      restMinutes: restMinutes,
      difficulty,
      shotsCalledOut: shotsCalledOutRef.current,
      emphases: Object.entries(selectedEmphases)
        .filter(([, v]) => v)
        .map(([k]) => {
          const found = emphasisList.find((e) => e.key === (k as EmphasisKey));
          return found ? found.label : k;
        }),
      status: roundsCompleted >= roundsCount ? "completed" : "abandoned",
      settings: {
        selectedEmphases,
        addCalisthenics,
        readInOrder,
        southpawMode,
      },
    };
    try {
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
  }

  const resumeWorkout = useCallback(
    (logEntry: any) => {
      if (logEntry.settings) {
        setSelectedEmphases(logEntry.settings.selectedEmphases);
        setAddCalisthenics(logEntry.settings.addCalisthenics);
        setReadInOrder(logEntry.settings.readInOrder);
        setSouthpawMode(logEntry.settings.southpawMode);
      }
      setRoundsCount(logEntry.roundsPlanned);
      setRoundMin(logEntry.roundLengthMin);
      setRestMinutes(logEntry.restMinutes || DEFAULT_REST_MINUTES);
      setDifficulty(logEntry.difficulty || "medium");
      shotsCalledOutRef.current = logEntry.shotsCalledOut || 0;
      setPage("timer");

      setTimeout(() => {
        const pool = getTechniquePool();
        const timerOnlySelected =
          logEntry.settings?.selectedEmphases?.timer_only &&
          Object.values(logEntry.settings.selectedEmphases).filter(Boolean)
            .length === 1;

        if (!pool.length && !timerOnlySelected) {
          alert("Cannot resume: No techniques found.");
          return;
        }
        try {
          trackEvent("workout_resumed", {
            original_timestamp: logEntry.timestamp,
            rounds_remaining: logEntry.roundsPlanned - logEntry.roundsCompleted,
            rounds_completed: logEntry.roundsCompleted,
          });
        } catch {}

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
            rate: voiceSpeed,
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

        setCurrentRound(logEntry.roundsCompleted + 1);
        setIsPreRound(true);
        setPreRoundTimeLeft(5);
        speakSystem("Resuming workout. Get ready", voice, voiceSpeed);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 150);
    },
    [getTechniquePool, ensureMediaUnlocked, voiceSpeed, voice, speakSystem]
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
    try {
      trackEvent("completion_screen_viewed", {
        workout_id: logEntry.id,
        is_replay: true,
      });
    } catch {}
  }, []);

  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const homePageStats = useHomeStats(statsRefreshTrigger);
  const favoriteConfig = homePageStats?.mostCommonEmphasis
    ? emphasisList.find(
        (e) =>
          e.label.trim().toLowerCase() ===
          homePageStats.mostCommonEmphasis.trim().toLowerCase()
      )
    : null;

  const isActive = running || isPreRound;
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
        onClose={closeOnboardingModal}
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
            techniques={techniques as any}
            setTechniques={persistTechniques}
            onBack={() => setPage("timer")}
          />
        ) : page === "completed" && lastWorkout ? (
          <WorkoutCompleted
            stats={lastWorkout}
            onRestart={() => {
              if (
                typeof window !== "undefined" &&
                "speechSynthesis" in window
              ) {
                try {
                  window.speechSynthesis.cancel();
                } catch {}
              }
              setPaused(false);
              setRunning(false);
              setCurrentRound(0);
              setTimeLeft(0);
              setIsResting(false);
              setIsPreRound(false);
              setPreRoundTimeLeft(0);
              setCurrentCallout("");
              stopTechniqueCallouts();
              stopAllNarration();

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
              setSelectedEmphases(restoredEmphases);
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
                minHeight: running || isPreRound ? "220px" : "0",
                transition: "min-height 0.3s ease-in-out",
              }}
            >
              <div
                style={{
                  minHeight: running || isPreRound ? "220px" : "0",
                  transition: "min-height 0.3s ease-in-out",
                }}
              >
                <ActiveSessionUI
                  running={running}
                  isPreRound={isPreRound}
                  paused={paused}
                  isResting={isResting}
                  timeLeft={timeLeft}
                  currentRound={currentRound}
                  roundsCount={roundsCount}
                  restTimeLeft={restTimeLeft}
                  preRoundTimeLeft={preRoundTimeLeft}
                  fmtTime={fmtTime}
                  getStatus={getStatus}
                  currentCallout={currentCallout}
                  onPause={pauseSession}
                  onStop={stopSession}
                  selectedEmphases={selectedEmphases}
                  emphasisList={emphasisList}
                />
              </div>
            </div>

            {!isActive && (
              <WorkoutSetup
                stats={homePageStats}
                favoriteConfig={favoriteConfig}
                emphasisList={emphasisList}
                selectedEmphases={selectedEmphases}
                toggleEmphasis={toggleEmphasis}
                techniques={techniques}
                showAllEmphases={showAllEmphases}
                setShowAllEmphases={setShowAllEmphases}
                setPage={setPage}
                roundsCount={roundsCount}
                setRoundsCount={setRoundsCount}
                roundMin={roundMin}
                setRoundMin={setRoundMin}
                restMinutes={restMinutes}
                setRestMinutes={setRestMinutes}
                showAdvanced={showAdvanced}
                setShowAdvanced={setShowAdvanced}
                southpawMode={southpawMode}
                setSouthpawMode={setSouthpawMode}
                addCalisthenics={addCalisthenics}
                setAddCalisthenics={setAddCalisthenics}
                readInOrder={readInOrder}
                setReadInOrder={setReadInOrder}
                voice={voice}
                voices={voices}
                unifiedVoices={unifiedVoices}
                setCurrentVoice={setCurrentVoice}
                saveVoicePreference={saveVoicePreference}
                checkVoiceCompatibility={checkVoiceCompatibility}
                ttsService={ttsService}
                voiceSpeed={voiceSpeed}
                setVoiceSpeed={setVoiceSpeed}
                ttsAvailable={ttsAvailable}
                testVoice={testVoice}
                voiceCompatibilityWarning={voiceCompatibilityWarning as string}
                trackEvent={trackEvent}
                onStart={startSession}
                difficulty={difficulty}
                setDifficulty={setDifficulty}
                clearAllEmphases={clearAllEmphases}
              />
            )}

            {(running || isPreRound) && (
              <StatusTimer
                time={fmtTime(timeLeft)}
                round={currentRound}
                totalRounds={roundsCount}
                status={getStatus()}
                isResting={isResting}
                restTimeLeft={restTimeLeft}
                isPreRound={isPreRound}
                preRoundTimeLeft={preRoundTimeLeft}
                fmtTime={fmtTime}
              />
            )}
          </>
        )}
      </AppLayout>

      <PWAInstallPrompt
        isVisible={showPWAPrompt && !pwa.isInstalled}
        onInstall={async () => {
          try {
            trackEvent(AnalyticsEvents.PWAInstallPrompt, {
              action: "install_attempted",
            });
          } catch {}
          const success = await pwa.promptInstall();
          setShowPWAPrompt(false);
          return success;
        }}
        onDismiss={() => {
          try {
            trackEvent(AnalyticsEvents.PWAInstallPrompt, {
              action: "dismissed",
            });
          } catch {}
          setShowPWAPrompt(false);
        }}
        onDismissPermanently={() => {
          try {
            trackEvent(AnalyticsEvents.PWAInstallPrompt, {
              action: "dismissed_permanently",
            });
          } catch {}
          localStorage.setItem("pwa_install_dismissed", "true");
          setShowPWAPrompt(false);
        }}
      />
    </>
  );
}
