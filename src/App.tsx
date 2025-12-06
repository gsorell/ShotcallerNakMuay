import React, { useCallback, useEffect, useRef, useState } from "react";

// Types
import type {
  Difficulty,
  EmphasisKey,
  Page,
  TechniquesShape,
  TechniqueWithStyle,
} from "./types";

// Storage
import {
  DEFAULT_REST_MINUTES,
  TECHNIQUES_STORAGE_KEY,
  TECHNIQUES_VERSION_KEY,
  VOICE_STORAGE_KEY,
  WORKOUTS_STORAGE_KEY,
} from "./constants/storage";

// Components
import Header from "./components/Header";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import StatusTimer from "./components/StatusTimer";
import { INITIAL_TECHNIQUES } from "./constants/techniques";

// Pages
import TechniqueEditor from "./pages/TechniqueEditor";
import WorkoutCompleted from "./pages/WorkoutCompleted";
import WorkoutLogs from "./pages/WorkoutLogs";

// Hooks
import { useAndroidAudioDucking } from "./hooks/useAndroidAudioDucking";
import { useIOSAudioSession } from "./hooks/useIOSAudioSession";
import { useNavigationGestures } from "./hooks/useNavigationGestures";
import { usePWA } from "./hooks/usePWA";
import { useTTS } from "./hooks/useTTS";
import { useWakeLock } from "./hooks/useWakeLock";

// Utilities
import { AnalyticsEvents, initializeGA4, trackEvent } from "./utils/analytics";
import { displayInAppBrowserWarning } from "./utils/inAppBrowserDetector";

// CSS
import "./App.css";
import ActiveSessionUI from "./components/ActiveSessionUI";
import { Footer } from "./components/Footer";
import { OnboardingModal } from "./components/OnboardingModal";
import WorkoutSetup from "./components/WorkoutSetup";
import { useEmphasisList } from "./hooks/useEmphasisList";
import { useHomeStats } from "./hooks/useHomeStats";
import "./styles/difficulty.css";
import { generateTechniquePool, normalizeKey } from "./utils/techniqueUtils";
import { mirrorTechnique } from "./utils/textUtils";
import { fmtTime } from "./utils/timeUtils";
import ttsService from "./utils/ttsService";
import {
  loadUserSettings,
  saveUserSettings,
} from "./utils/userSettingsManager";

// Global state to persist modal scroll position across re-renders
let modalScrollPosition = 0;

const TECHNIQUES_VERSION = "v35";

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

  // PWA functionality
  const pwa = usePWA();

  // iOS audio session configuration for background music compatibility
  const iosAudioSession = useIOSAudioSession();

  // Android audio ducking for background music control
  const androidAudioDucking = useAndroidAudioDucking();

  const [userEngagement, setUserEngagement] = useState(() => {
    const stored = localStorage.getItem("user_engagement_stats");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          visitCount: parsed.visitCount || 0,
          timeOnSite: 0, // Reset time for new session
          completedWorkouts: parsed.completedWorkouts || 0,
          lastVisit: parsed.lastVisit ? new Date(parsed.lastVisit) : new Date(),
        };
      } catch {
        return {
          visitCount: 0,
          timeOnSite: 0,
          completedWorkouts: 0,
          lastVisit: new Date(),
        };
      }
    }
    return {
      visitCount: 0,
      timeOnSite: 0,
      completedWorkouts: 0,
      lastVisit: new Date(),
    };
  });

  const [sessionStartTime] = useState(Date.now());
  const [showPWAPrompt, setShowPWAPrompt] = useState(false);
  // Track whether we're on the Technique Editor to gate periodic updates that can steal focus on mobile
  const isEditorRef = useRef(false);

  // Register service worker for PWA
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Service worker registration failed - app will still work without it
      });
    }
  }, []);

  // Track user engagement and update visit count
  useEffect(() => {
    // Increment visit count on first load
    const newEngagement = {
      ...userEngagement,
      visitCount: userEngagement.visitCount + 1,
      lastVisit: new Date(),
    };
    setUserEngagement(newEngagement);

    // Save to localStorage with ISO string
    localStorage.setItem(
      "user_engagement_stats",
      JSON.stringify({
        ...newEngagement,
        lastVisit: newEngagement.lastVisit.toISOString(),
      })
    );
  }, []); // Only run once on mount

  // Track time on site and show install prompt after 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Skip updating while editing techniques to avoid focus drops on mobile
      if (isEditorRef.current) return;
      const timeOnSite = Math.floor((Date.now() - sessionStartTime) / 1000);
      setUserEngagement((prev) => ({ ...prev, timeOnSite }));
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // Show install prompt automatically after 30 seconds if not installed and not dismissed
  useEffect(() => {
    // Don't interrupt the Technique Editor with prompts
    if (isEditorRef.current) return;

    // Don't show if already installed or previously dismissed permanently
    if (!pwa.isInstalled) {
      const dismissed = localStorage.getItem("pwa_install_dismissed");
      if (!dismissed) {
        const timer = setTimeout(() => {
          // Double-check install status before showing (in case user installed during the 30 seconds)
          if (!pwa.isInstalled && !isEditorRef.current) {
            setShowPWAPrompt(true);
          }
        }, 30000); // 30 seconds

        return () => clearTimeout(timer);
      }
    }

    return;
  }, [pwa.isInstalled]); // Routing
  const [page, setPage] = useState<Page>("timer");
  // Keep a ref of whether we're on the Technique Editor page for gating timers and prompts
  useEffect(() => {
    isEditorRef.current = page === "editor";
  }, [page]);
  const [lastWorkout, setLastWorkout] = useState<any>(null);

  // Technique data (seed + persist + version)
  const [techniques, setTechniques] = useState<TechniquesShape>(() => {
    try {
      const raw = localStorage.getItem(TECHNIQUES_STORAGE_KEY);
      const ver = localStorage.getItem(TECHNIQUES_VERSION_KEY);
      let loaded = INITIAL_TECHNIQUES;
      if (!raw || ver !== TECHNIQUES_VERSION) {
        localStorage.setItem(
          TECHNIQUES_STORAGE_KEY,
          JSON.stringify(INITIAL_TECHNIQUES)
        );
        localStorage.setItem(TECHNIQUES_VERSION_KEY, TECHNIQUES_VERSION);
      } else {
        loaded = JSON.parse(raw);
      }
      // Ensure timer_only is always present
      if (!loaded["timer_only"]) {
        loaded["timer_only"] = INITIAL_TECHNIQUES["timer_only"]!;
      }
      return loaded;
    } catch {
      return INITIAL_TECHNIQUES;
    }
  });
  // Debug: track previous techniques to log diffs when techniques change
  const prevTechRef = React.useRef<TechniquesShape | null>(null);
  const persistTechniques = (next: TechniquesShape) => {
    try {
      setTechniques(next);
      localStorage.setItem(TECHNIQUES_STORAGE_KEY, JSON.stringify(next));
      localStorage.setItem(TECHNIQUES_VERSION_KEY, TECHNIQUES_VERSION);
    } catch (err) {
      // Failed to persist techniques
    }
  };
  useEffect(() => {
    try {
      localStorage.setItem(TECHNIQUES_STORAGE_KEY, JSON.stringify(techniques));
      // Compare previous value and log any changed group keys
      try {
        const prev = prevTechRef.current;
        if (prev) {
          Object.keys(techniques).forEach((k) => {
            const a = JSON.stringify(prev[k]);
            const b = JSON.stringify(techniques[k]);
            // previously logged changes here during debugging
          });
        }
      } catch (err) {
        // swallow
      }
      prevTechRef.current = techniques;
    } catch (err) {
      // Failed to save techniques to storage
    }
  }, [techniques]);

  // Dynamically generate emphasis list from techniques, merging with base config for icons/descriptions.
  const emphasisList = useEmphasisList(techniques);

  // Keep a mutable ref for the techniques object so callbacks can access the latest value without re-rendering.
  const techniquesRef = useRef<TechniquesShape>(techniques);
  useEffect(() => {
    techniquesRef.current = techniques;
  }, [techniques]);

  // Build an index mapping normalized keys -> original keys for robust lookups.
  const techniqueIndex = React.useMemo(() => {
    const idx: Record<string, string> = {};
    Object.keys(techniques || {}).forEach((k) => {
      idx[k] = k;
      idx[normalizeKey(k)] = k;
    });
    return idx;
  }, [techniques]);

  const techniqueIndexRef = useRef<Record<string, string>>(techniqueIndex);
  useEffect(() => {
    techniqueIndexRef.current = techniqueIndex;
  }, [techniqueIndex]);

  // Selection and session settings
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

  // ADD: Read in order toggle
  const [readInOrder, setReadInOrder] = useState(false);

  // ADD: Southpaw mode toggle
  const [southpawMode, setSouthpawMode] = useState(() => {
    try {
      const stored = localStorage.getItem("southpaw_mode");
      if (!stored) return false;
      const parsed = JSON.parse(stored);
      // Ensure we always return a proper boolean
      return Boolean(parsed);
    } catch (error) {
      // If localStorage is corrupted, default to false and clear it
      // Failed to parse southpaw_mode from localStorage
      try {
        localStorage.removeItem("southpaw_mode");
      } catch {
        /* ignore cleanup errors */
      }
      return false;
    }
  });

  // Load persisted user settings
  const persistedSettings = loadUserSettings();

  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [roundsCount, setRoundsCount] = useState(persistedSettings.roundsCount);
  const [roundMin, setRoundMin] = useState(persistedSettings.roundMin);
  const [restMinutes, setRestMinutes] = useState(persistedSettings.restMinutes);

  // Toggle an emphasis on/off
  const toggleEmphasis = (k: EmphasisKey) => {
    setSelectedEmphases((prev) => {
      const isTurningOn = !prev[k];

      // Track emphasis selection/deselection
      try {
        trackEvent(
          isTurningOn
            ? AnalyticsEvents.EmphasisSelect
            : AnalyticsEvents.EmphasisDeselect,
          {
            emphasis: k,
          }
        );
      } catch (e) {
        // Analytics tracking failed
      }

      if (k === "timer_only") {
        // If turning timer_only on, turn all others off.
        // If turning timer_only off, just turn it off.
        const allOff: Record<EmphasisKey, boolean> = {
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

      // For any other key, toggle it. If turning it on, ensure timer_only is off.
      const next = { ...prev, [k]: isTurningOn };
      if (isTurningOn) {
        next.timer_only = false;
      }
      return next;
    });
  };

  // Clear all selected emphases
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

  // ADD: advanced panel toggle (was missing)
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ADD: toggle for showing all emphases
  const [showAllEmphases, setShowAllEmphases] = useState(false);

  // ADD: subtle onboarding modal toggle
  const [showOnboardingMsg, setShowOnboardingMsg] = useState(false);

  // Stable callback to prevent modal re-renders
  const closeOnboardingModal = useCallback(() => {
    setShowOnboardingMsg(false);
  }, []);

  // Navigation gesture handling
  const handleBackNavigation = useCallback(() => {
    // Priority order for back navigation:
    // 1. Close onboarding modal if open
    // 2. Go back from technique editor to timer
    // 3. Go back from workout logs to timer
    // 4. Go back from completed screen to timer
    if (showOnboardingMsg) {
      setShowOnboardingMsg(false);
    } else if (page === "editor") {
      setPage("timer");
    } else if (page === "logs") {
      setPage("timer");
    } else if (page === "completed") {
      setPage("timer");
    }
    // If on timer page and no modals open, do nothing (stay on app)
  }, [showOnboardingMsg, page]);

  // Enable navigation gestures when on non-timer pages or when modal is open
  const navigationGesturesEnabled = page !== "timer" || showOnboardingMsg;

  useNavigationGestures({
    onBack: handleBackNavigation,
    enabled: navigationGesturesEnabled,
    debugLog: false, // Set to true for development debugging
  });

  // Voice persistence helpers
  const saveVoicePreference = useCallback(
    (voice: SpeechSynthesisVoice | null) => {
      if (!voice) {
        localStorage.removeItem(VOICE_STORAGE_KEY);
        return;
      }

      // SECURITY: Only save English voices to prevent non-English voices from persisting
      const isEnglish = voice.lang.toLowerCase().startsWith("en");
      if (!isEnglish) {
        // Attempted to save non-English voice preference, ignoring
        localStorage.removeItem(VOICE_STORAGE_KEY);
        return;
      }

      // Store voice name and lang for matching later
      const voiceData = {
        name: voice.name,
        lang: voice.lang,
        localService: voice.localService,
        default: voice.default,
      };
      localStorage.setItem(VOICE_STORAGE_KEY, JSON.stringify(voiceData));
      // Saved English voice preference
    },
    []
  );

  const loadVoicePreference = useCallback(
    (availableVoices: SpeechSynthesisVoice[]) => {
      try {
        const stored = localStorage.getItem(VOICE_STORAGE_KEY);
        if (!stored || !availableVoices.length) return null;

        const voiceData = JSON.parse(stored);
        // Try to find exact match by name and lang
        const matchedVoice = availableVoices.find(
          (v) => v.name === voiceData.name && v.lang === voiceData.lang
        );

        if (matchedVoice) {
          // FIXED: Only return saved voice if it's English-compatible
          const isEnglishCompatible = matchedVoice.lang
            .toLowerCase()
            .startsWith("en");
          if (isEnglishCompatible) {
            return matchedVoice;
          } else {
            // Clean up non-English preference and force English selection
            localStorage.removeItem(VOICE_STORAGE_KEY);
            return null;
          }
        } else {
          // Saved voice not available
          // Clean up invalid preference
          localStorage.removeItem(VOICE_STORAGE_KEY);
          return null;
        }
      } catch (error) {
        // Failed to load voice preference
        localStorage.removeItem(VOICE_STORAGE_KEY);
        return null;
      }
    },
    []
  );

  // TTS controls (now using unified TTS hook)
  const [voiceSpeed, setVoiceSpeed] = useState<number>(
    persistedSettings.voiceSpeed
  );
  const {
    voices: unifiedVoices,
    currentVoice,
    setCurrentVoice,
    englishVoices: unifiedEnglishVoices,
    speak: ttsSpeak,
    speakSystem: ttsSpeakSystem,
    speakSystemWithDuration: ttsSpeakSystemWithDuration,
    speakTechnique: ttsSpeakTechnique,
    stop: stopTTS,
    isAvailable: ttsAvailable,
    platform: ttsPlatform,
    voiceCompatibilityWarning,
    testVoice: ttsTestVoice,
  } = useTTS();

  // Backward compatibility - map new voice system to old variable names for gradual migration
  // For native voices, create synthetic SpeechSynthesisVoice-like objects for UI compatibility
  const voices = unifiedVoices.map((v) => {
    if (v.browserVoice) {
      return v.browserVoice;
    } else {
      // Create synthetic voice object for native voices
      return {
        name: v.name,
        lang: v.language,
        default: v.isDefault || false,
        localService: true,
        voiceURI: v.id,
      } as SpeechSynthesisVoice;
    }
  });

  const voice = currentVoice
    ? currentVoice.browserVoice ||
      ({
        name: currentVoice.name,
        lang: currentVoice.language,
        default: currentVoice.isDefault || false,
        localService: true,
        voiceURI: currentVoice.id,
      } as SpeechSynthesisVoice)
    : null;

  const setVoice = (newVoice: SpeechSynthesisVoice | null) => {
    if (newVoice) {
      // Find the unified voice by name and language
      const unifiedVoice = unifiedVoices.find(
        (v) => v.name === newVoice.name && v.language === newVoice.lang
      );
      setCurrentVoice(unifiedVoice || null);
    } else {
      setCurrentVoice(null);
    }
  };

  // Keep existing state setters for compatibility during transition
  const [, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [, setVoiceCompatibilityWarning] = useState<string>("");
  // Live "subtitle" for the active technique/combination
  const [currentCallout, setCurrentCallout] = useState<string>("");
  // Voice compatibility checker - simplified since TTS hook handles this now
  const checkVoiceCompatibility = useCallback(
    (
      selectedVoice: SpeechSynthesisVoice | null,
      allVoices: SpeechSynthesisVoice[]
    ) => {
      // The new TTS hook handles compatibility warnings automatically
      // This function is kept for backward compatibility during transition
    },
    []
  );

  // Voice initialization is now handled by the TTS hook

  // Persist user settings when they change
  useEffect(() => {
    saveUserSettings({ roundMin });
  }, [roundMin]);

  useEffect(() => {
    saveUserSettings({ restMinutes });
  }, [restMinutes]);

  useEffect(() => {
    saveUserSettings({ voiceSpeed });
  }, [voiceSpeed]);

  useEffect(() => {
    saveUserSettings({ roundsCount });
  }, [roundsCount]);

  // NEW: refs so changing speed/voice doesn’t restart cadence
  const voiceSpeedRef = useRef(voiceSpeed);
  useEffect(() => {
    voiceSpeedRef.current = voiceSpeed;
  }, [voiceSpeed]);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(voice);
  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  // NEW: ensure voice speed always defaults to 1x on mount
  // useEffect(() => {
  //   setVoiceSpeed(1);
  //   voiceSpeedRef.current = 1;
  // }, []);

  useEffect(() => {
    if (difficulty === "hard") {
      setVoiceSpeed(1.4); // Increased from 1.3 to 1.4 for more challenge
    } else {
      // default easy/medium to 1x
      setVoiceSpeed(1);
    }
  }, [difficulty]);

  // Timer state
  const [timeLeft, setTimeLeft] = useState(0);
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [isPreRound, setIsPreRound] = useState(false); // ADD: pre-round countdown state
  const [preRoundTimeLeft, setPreRoundTimeLeft] = useState(0); // ADD: pre-round time

  // Keep screen awake while running (not paused) or during pre-round countdown
  // Simplified logic to reduce rapid state changes
  const shouldKeepAwake = (running && !paused) || isPreRound;
  useWakeLock({ enabled: shouldKeepAwake, log: false });

  // Wire the running/guard state into the TTS hook so speakTechnique sees the correct guards.
  // The hook exposes an `updateGuards` method on the returned speak function for compatibility.
  useEffect(() => {
    try {
      // @ts-ignore -- speak is augmented with updateGuards in the hook
      if (typeof (ttsSpeak as any).updateGuards === "function") {
        // ttsGuardRef mirrors the legacy guard logic used elsewhere in this file
        (ttsSpeak as any).updateGuards(
          ttsGuardRef.current || false,
          runningRef.current || false
        );
      }
    } catch (e) {
      // noop
    }
  }, [ttsSpeak, running, paused, isResting]); // Update when the guard-affecting states change

  // Refs
  const calloutRef = useRef<number | null>(null);
  const bellSoundRef = useRef<HTMLAudioElement | null>(null);
  const warningSoundRef = useRef<HTMLAudioElement | null>(null);
  const shotsCalledOutRef = useRef<number>(0); // Initialize shotsCalledOutRef
  const orderedIndexRef = useRef<number>(0); // Initialize orderedIndexRef
  const currentPoolRef = useRef<TechniqueWithStyle[]>([]); // Initialize currentPoolRef
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const runningRef = useRef(running);
  const pausedRef = useRef(paused);
  const isRestingRef = useRef(isResting);
  useEffect(() => {
    runningRef.current = running;
  }, [running]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    isRestingRef.current = isResting;
  }, [isResting]);

  // Persist southpaw mode to localStorage
  useEffect(() => {
    localStorage.setItem("southpaw_mode", JSON.stringify(southpawMode));
  }, [southpawMode]);

  // Create ref for southpaw mode to ensure it's accessible in callbacks
  const southpawModeRef = useRef(Boolean(southpawMode));
  useEffect(() => {
    southpawModeRef.current = Boolean(southpawMode);
  }, [southpawMode]);

  // Build a phrase pool from selected emphases (strict: only read exact keys from techniques)
  const getTechniquePool = useCallback((): TechniqueWithStyle[] => {
    return generateTechniquePool(
      techniquesRef.current,
      selectedEmphases,
      addCalisthenics,
      techniqueIndexRef.current
    );
  }, [selectedEmphases, addCalisthenics]);

  function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]!;
  }

  // TTS guard and helpers
  const ttsGuardRef = useRef<boolean>(false);
  const stopAllNarration = useCallback(() => {
    if (calloutRef.current) {
      clearTimeout(calloutRef.current);
      calloutRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        const synth = window.speechSynthesis;
        // cancel any queued or active utterances
        synth.cancel();
        // clear tracked utterance
        utteranceRef.current = null;
      } catch {
        /* noop */
      }
    }
  }, []);

  // Updated speak functions using new TTS system
  const speakSystemLegacy = useCallback(
    (
      text: string,
      selectedVoice: SpeechSynthesisVoice | null,
      speed: number
    ) => {
      // Use new TTS system with backward compatibility
      ttsSpeakSystem(text, speed);
    },
    [ttsSpeakSystem]
  );

  const speakLegacy = useCallback(
    (
      text: string,
      selectedVoice: SpeechSynthesisVoice | null,
      speed: number
    ) => {
      // Use new TTS system - let the hook handle all guard logic
      ttsSpeakTechnique(text, speed, true);
    },
    [ttsSpeakTechnique]
  );

  // Keep original function names for existing code compatibility
  const speakSystem = speakSystemLegacy;
  const speak = speakLegacy;
  const speakRef = useRef(speak);
  useEffect(() => {
    speakRef.current = speak;
  }, [speak]);

  // Callout scheduler
  const stopTechniqueCallouts = useCallback(() => {
    if (calloutRef.current) {
      clearTimeout(calloutRef.current);
      calloutRef.current = null;
    }
    try {
      // Cancel any currently speaking utterance
      if (
        utteranceRef.current &&
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.cancel();
        utteranceRef.current = null;
      }
    } catch {
      /* noop */
    }
    // Optional: clear visible subtitle when we explicitly stop callouts
    // (Guard effect below will also clear on pause/rest/stop)
    setCurrentCallout("");
  }, []);

  const startTechniqueCallouts = useCallback(
    (initialDelay = 800) => {
      // Reduced from 1200ms to 800ms
      // Adjusted cadence per difficulty (calls/min) - reduced to prevent interruptions
      const cadencePerMin =
        difficulty === "easy"
          ? 20 // Was 26
          : difficulty === "hard"
          ? 42
          : 26; // Was 37 → increased from 37 to 42 (~14% faster for Pro)
      const baseDelayMs = Math.round(60000 / cadencePerMin);
      // Pro difficulty gets even more aggressive minimum delays
      const minDelayMultiplier = difficulty === "hard" ? 0.35 : 0.5; // Pro: 35% vs 50% for others (reduced from 40%)
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
        // Critical safety guard: Check if we should still be calling out techniques
        if (
          ttsGuardRef.current ||
          !runningRef.current ||
          pausedRef.current ||
          isRestingRef.current
        ) {
          stopTechniqueCallouts();
          return;
        }

        // TTS service will handle visibility blocking, so we can proceed normally

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
          // True random selection each time
          selectedTechnique = pool[Math.floor(Math.random() * pool.length)]!;
        }

        // Increment shotsCalledOut counter
        shotsCalledOutRef.current += 1;

        // Use new TTS service for technique callouts with responsive timing
        try {
          // Apply southpaw mirroring if enabled, passing the source style for exemption logic
          const finalPhrase = southpawModeRef.current
            ? mirrorTechnique(selectedTechnique.text, selectedTechnique.style)
            : selectedTechnique.text;

          // Safety check: ensure we never pass empty strings to speech synthesis
          if (
            !finalPhrase ||
            typeof finalPhrase !== "string" ||
            finalPhrase.trim() === ""
          ) {
            setCurrentCallout(selectedTechnique.text || "");
            return;
          }

          // Set the callout immediately for visual feedback
          setCurrentCallout(finalPhrase);

          // Use enhanced TTS with actual duration measurement for responsive timing
          // TTS service will block calls when page is hidden and provide fake duration callback
          ttsSpeakSystemWithDuration(
            finalPhrase,
            voiceSpeedRef.current,
            (actualDurationMs: number) => {
              // Pro difficulty gets much more aggressive timing
              const isProDifficulty = difficulty === "hard";

              // Calculate next delay based on actual speech duration, with Pro-specific adjustments
              const bufferMultiplier = isProDifficulty ? 0.12 : 0.2; // Pro: 12% buffer vs 20% for others (reduced from 15%)
              const bufferTime = Math.max(
                isProDifficulty ? 120 : 200,
                Math.min(
                  isProDifficulty ? 500 : 800,
                  baseDelayMs * bufferMultiplier
                )
              );

              const jitterMultiplier = isProDifficulty ? 0.05 : 0.08; // Pro: ±5% vs ±8% for others (reduced from 6%)
              const jitter = Math.floor(
                baseDelayMs * jitterMultiplier * (Math.random() - 0.5)
              );

              // Responsive delay: use actual duration + buffer, but be more aggressive about shorter delays
              const responsiveDelayMs = actualDurationMs + bufferTime + jitter;

              // Pro gets more aggressive timing caps
              const timingCap = isProDifficulty
                ? baseDelayMs * 0.85
                : baseDelayMs * 1.1; // Pro: 85% cap vs 110% (reduced from 90%)

              const nextDelayMs = Math.max(
                minDelayMs, // Never go below minimum
                Math.min(responsiveDelayMs, timingCap) // Pro has much tighter cap
              );

              scheduleNext(nextDelayMs);
            }
          );

          return;
        } catch (error) {
          // Fall through to fallback
        }

        // Fallback (no TTS): update immediately and use timer cadence
        // Apply southpaw mirroring if enabled, passing the source style for exemption logic
        const finalPhrase = southpawModeRef.current
          ? mirrorTechnique(selectedTechnique.text, selectedTechnique.style)
          : selectedTechnique.text;

        // Safety check for callouts
        const safePhrase =
          !finalPhrase ||
          typeof finalPhrase !== "string" ||
          finalPhrase.trim() === ""
            ? selectedTechnique.text || ""
            : finalPhrase;

        setCurrentCallout(safePhrase);
        // Pro difficulty gets even more aggressive fallback timing
        const isProDifficulty = difficulty === "hard";
        const jitterMultiplier = isProDifficulty ? 0.05 : 0.08;
        const fallbackMultiplier = isProDifficulty ? 0.65 : 0.8; // Pro: 65% vs 80% for others (reduced from 70%)

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
    [difficulty, stopTechniqueCallouts, ttsSpeakSystemWithDuration]
  );

  // Visibility management: Auto-pause when page becomes hidden to prevent callouts from stopping silently
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isHidden = document.hidden || document.visibilityState === "hidden";

      // If page becomes hidden during an active workout, auto-pause to prevent silent callout failure
      if (isHidden && running && !paused && !isResting && !isPreRound) {
        setPaused(true);
        // Try to pause any current TTS
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          try {
            window.speechSynthesis.pause();
          } catch {
            /* noop */
          }
        }
      }
      // Note: We don't auto-resume when page becomes visible to avoid accidental resumption
      // User must manually resume, which is the expected behavior
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [running, paused, isResting, isPreRound]);

  // Guard TTS on state changes
  useEffect(() => {
    ttsGuardRef.current = !running || paused || isResting;
    if (ttsGuardRef.current) {
      stopTechniqueCallouts();
      stopAllNarration();
      // Clear visible subtitle when we shouldn't be calling out
      setCurrentCallout("");
    }
  }, [running, paused, isResting, stopAllNarration, stopTechniqueCallouts]);

  // Simple Web Audio fallback chime if mp3 can't play (autoplay blocked or missing file)
  const webAudioChime = useCallback(() => {
    try {
      const AudioCtx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);

      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {
      /* noop */
    }
  }, []);

  // Initialize audio instances ONCE on component mount
  useEffect(() => {
    try {
      // Create bell audio instance once
      if (!bellSoundRef.current) {
        bellSoundRef.current = new Audio("/big-bell-330719.mp3");
        bellSoundRef.current.preload = "auto";
        bellSoundRef.current.volume = 0.5;
        // Configure for iOS compatibility to prevent audio ducking
        iosAudioSession.configureAudioElement(bellSoundRef.current);
      }

      // Create warning audio instance once
      if (!warningSoundRef.current) {
        warningSoundRef.current = new Audio("/interval.mp3");
        warningSoundRef.current.preload = "auto";
        warningSoundRef.current.volume = 0.4;
        // Configure for iOS compatibility to prevent audio ducking
        iosAudioSession.configureAudioElement(warningSoundRef.current);
      }
    } catch (error) {
      console.warn("[AudioInit] Failed to initialize audio elements:", error);
    }

    // Cleanup on unmount
    return () => {
      try {
        if (bellSoundRef.current) {
          bellSoundRef.current.pause();
          bellSoundRef.current.src = "";
          bellSoundRef.current.load();
          bellSoundRef.current = null;
        }
        if (warningSoundRef.current) {
          warningSoundRef.current.pause();
          warningSoundRef.current.src = "";
          warningSoundRef.current.load();
          warningSoundRef.current = null;
        }
      } catch (error) {
        console.warn("[AudioCleanup] Error during cleanup:", error);
      }
    };
  }, []);

  // Configure iOS-specific audio settings after audio elements are created
  useEffect(() => {
    if (bellSoundRef.current && iosAudioSession.shouldMixWithOthers()) {
      bellSoundRef.current.volume = 0.3; // Reduce volume on iOS for better mixing
      iosAudioSession.configureAudioElement(bellSoundRef.current);
    }

    if (warningSoundRef.current && iosAudioSession.shouldMixWithOthers()) {
      warningSoundRef.current.volume = 0.2; // Reduce volume on iOS for better mixing
      iosAudioSession.configureAudioElement(warningSoundRef.current);
    }
  }, [iosAudioSession]);

  // Proactively unlock audio on user gesture (Start button)
  const ensureMediaUnlocked = useCallback(async () => {
    try {
      // Use existing bell instance, don't create new one
      const bell = bellSoundRef.current;
      if (bell) {
        const bellPrevVol = bell.volume;
        bell.volume = 0;
        bell.muted = true;
        await bell.play().catch(() => {});
        bell.pause();
        bell.currentTime = 0;
        bell.muted = false;
        bell.volume = bellPrevVol;
      }

      // Use existing warning instance, don't create new one
      const warn = warningSoundRef.current;
      if (warn) {
        const warnPrevVol = warn.volume;
        warn.volume = 0;
        warn.muted = true;
        await warn.play().catch(() => {});
        warn.pause();
        warn.currentTime = 0;
        warn.muted = false;
        warn.volume = warnPrevVol;
      }
    } catch {
      /* noop */
    }
  }, []);

  // Bell - reuse existing instance, never create new ones
  const playBell = useCallback(() => {
    try {
      const bell = bellSoundRef.current;
      if (bell) {
        bell.currentTime = 0;
        const p = bell.play();
        if (p && typeof p.then === "function") {
          p.catch(() => {
            webAudioChime();
          });
        }
      } else {
        webAudioChime();
      }
    } catch {
      webAudioChime();
    }
  }, [webAudioChime]);

  // 10-second warning sound - reuse existing instance, never create new ones
  const playWarningSound = useCallback(() => {
    try {
      const warn = warningSoundRef.current;
      if (warn) {
        warn.currentTime = 0;
        const p = warn.play();
        if (p && typeof p.then === "function") {
          p.catch(() => {
            /* no critical fallback for warning */
          });
        }
      }
    } catch {
      /* noop */
    }
  }, []);

  // ADD: Pre-round countdown timer
  useEffect(() => {
    if (!isPreRound) return;
    if (preRoundTimeLeft <= 0) {
      // Countdown finished, start the round
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

  // Start/stop callouts during active rounds
  useEffect(() => {
    if (!running || paused || isResting) return;
    startTechniqueCallouts(800); // Reduced initial delay for faster first callout
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTechniqueCallouts();
      stopAllNarration();
    };
  }, [stopTechniqueCallouts, stopAllNarration]);

  // Tick seconds for round/rest
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

  // Transition: round -> rest or finish
  useEffect(() => {
    if (!running || paused || isResting) return;
    if (timeLeft > 0) return;

    // Immediately stop all TTS when round ends
    stopTTS();

    playBell();
    stopTechniqueCallouts();
    stopAllNarration();
    setCurrentCallout(""); // clear subtitle at round end
    if (currentRound >= roundsCount) {
      // Session finished naturally, log it and stop.
      try {
        autoLogWorkout(roundsCount);
      } catch {}

      // Release audio focus on Android when session completes
      if (androidAudioDucking.isAndroidNative) {
        void androidAudioDucking.releaseAudioFocus();
      }

      // NEW: Save stats and show completed page
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
        // Flag for post-workout install suggestion
        suggestInstall:
          !pwa.isInstalled && userEngagement.completedWorkouts >= 1,
      });
      setRunning(false);
      setPaused(false);
      setIsResting(false);

      setPage("completed"); // <-- show completed page
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

  // Track if we've played the 10-second warning and 5-second bell for this rest period
  const warningPlayedRef = useRef(false);
  const intervalBellPlayedRef = useRef(false);

  // Reset warning and bell flags when entering rest
  useEffect(() => {
    if (isResting) {
      warningPlayedRef.current = false;
      intervalBellPlayedRef.current = false;
    }
  }, [isResting]);

  // Transition: rest -> next round
  useEffect(() => {
    if (!running || paused || !isResting) return;

    // Play TTS warning with 10 seconds left (only once per rest period)
    if (restTimeLeft === 10 && !warningPlayedRef.current) {
      warningPlayedRef.current = true;
      speakSystem("10 seconds", voice, voiceSpeed);
    }

    // Play interval bell with 5 seconds left (only once per rest period)
    if (restTimeLeft === 5 && !intervalBellPlayedRef.current) {
      intervalBellPlayedRef.current = true;
      playWarningSound(); // This plays interval.mp3
    }

    if (restTimeLeft > 0) return;
    setIsResting(false);
    setCurrentRound((r) => r + 1);
    setTimeLeft(Math.max(1, Math.round(roundMin * 60)));
    playBell(); // Big bell marks START of new round
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

  // Helpers
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

  // Voice tester with enhanced error handling
  function testVoice() {
    try {
      // Stop any current TTS to prevent queueing multiple test messages
      stopTTS();

      // Small delay to ensure stop completes, then test with current voice
      setTimeout(() => {
        ttsTestVoice(); // Use the TTS hook's testVoice function which properly uses current voice
      }, 50);

      // Clear any warnings since we're attempting the test
      setVoiceCompatibilityWarning("");

      // Voice test initiated
    } catch (error) {
      // Voice test error
      setVoiceCompatibilityWarning(
        "Voice test failed. Please try a different voice or adjust the speed."
      );
    }
  }

  // Session controls
  function startSession() {
    if (!hasSelectedEmphasis) return;
    const pool = getTechniquePool();
    // FIX: Allow "Timer Only" to start even if pool is empty
    const timerOnlySelected =
      selectedEmphases.timer_only &&
      Object.values(selectedEmphases).filter(Boolean).length === 1;
    if (!pool.length && !timerOnlySelected) {
      alert(
        "No techniques found for the selected emphasis(es). Check the technique lists or choose a different emphasis."
      );
      // startSession blocked: empty technique pool for selected emphases
      return;
    }

    // Track workout start
    try {
      trackEvent(AnalyticsEvents.WorkoutStart, {
        selected_emphases: Object.keys(selectedEmphases).filter(
          (k) => selectedEmphases[k as EmphasisKey]
        ),
        difficulty: difficulty,
        rounds: roundsCount,
        round_duration_minutes: roundMin,
        rest_duration_minutes: restMinutes,
        include_calisthenics: addCalisthenics,
        read_in_order: readInOrder,
      });
    } catch (e) {
      // Analytics should never break functionality
      // Analytics tracking failed
    }

    // Unlock audio while we still have a user gesture
    void ensureMediaUnlocked();

    // Request audio focus with ducking on Android to lower background music
    if (androidAudioDucking.isAndroidNative) {
      void androidAudioDucking.requestAudioFocus();
    }

    // Reset pool and index for the session
    if (readInOrder) {
      currentPoolRef.current = pool;
    } else {
      currentPoolRef.current = pool.sort(() => Math.random() - 0.5);
    }
    orderedIndexRef.current = 0;

    // Reset shots called counter for the new session
    shotsCalledOutRef.current = 0;

    try {
      // Use TTS service for priming instead of direct speechSynthesis call
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

    // Start pre-round countdown instead of the session directly
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
      } catch {
        /* noop */
      }
    }
  }
  function stopSession() {
    // Immediately stop all TTS
    stopTTS();

    // Release audio focus on Android so background music resumes at full volume
    if (androidAudioDucking.isAndroidNative) {
      void androidAudioDucking.releaseAudioFocus();
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (error) {
        console.warn("[StopSession] Failed to cancel speech synthesis:", error);
      }
    }
    // compute rounds completed
    let roundsCompleted = 0;
    if (currentRound > 0) {
      // If we are in a rest period, the previous round was completed.
      // If we are in an active round, the previous round was also the last one completed.
      // The currentRound state is always 1 ahead of the last completed round.
      roundsCompleted = isResting
        ? currentRound
        : Math.max(0, currentRound - 1);
    }
    // If the session finished naturally, currentRound might be > roundsCount. Clamp it.
    if (!running && currentRound > roundsCount) {
      roundsCompleted = roundsCount;
    }

    try {
      autoLogWorkout(roundsCompleted);
    } catch {}
    setPaused(false);
    setRunning(false);
    setCurrentRound(0);
    setTimeLeft(0);
    setIsResting(false);
    setIsPreRound(false); // ADD: ensure pre-round is reset
    setPreRoundTimeLeft(0); // ADD: ensure pre-round is reset
    stopTechniqueCallouts();
    stopAllNarration();
    setCurrentCallout(""); // clear subtitle on stop
  }

  // Scroll to top when opening Technique Editor (especially for mobile)
  useEffect(() => {
    if (page === "editor") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [page]);

  // Keep selectedEmphases in sync: if a selected emphasis no longer maps to any persisted technique, unselect it.
  useEffect(() => {
    setSelectedEmphases((prev) => {
      const curr = techniquesRef.current || {};
      const next = { ...prev };
      for (const k of Object.keys(prev) as (keyof typeof prev)[]) {
        // if selected but no mapped technique, clear it
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

  function autoLogWorkout(roundsCompleted: number) {
    const entry = {
      id: `${Date.now()}`,
      timestamp: new Date().toISOString(),
      roundsPlanned: roundsCount,
      roundsCompleted,
      roundLengthMin: roundMin,
      restMinutes: restMinutes,
      difficulty, // already present
      shotsCalledOut: shotsCalledOutRef.current, // <-- add this
      emphases: Object.entries(selectedEmphases)
        .filter(([, v]) => v)
        .map(([k]) => {
          const found = emphasisList.find((e) => e.key === (k as EmphasisKey));
          return found ? found.label : k;
        }),
      // NEW: Track completion status
      status: roundsCompleted >= roundsCount ? "completed" : "abandoned",
      // NEW: Store settings to enable resume capability
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

      // Update engagement stats for completed workout
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

      // Trigger home page stats refresh
      setStatsRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      // Failed to auto-log workout
    }
  }

  // Resume incomplete workout from logs
  const resumeWorkout = useCallback(
    (logEntry: any) => {
      // Restore all settings from the logged workout
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

      // Restore the shot count from the original session
      shotsCalledOutRef.current = logEntry.shotsCalledOut || 0;

      // Navigate to timer page first
      setPage("timer");

      // Use setTimeout to ensure state updates have been applied
      setTimeout(() => {
        // Now start the session - this will initialize everything properly
        const pool = getTechniquePool();
        const timerOnlySelected =
          logEntry.settings?.selectedEmphases?.timer_only &&
          Object.values(logEntry.settings.selectedEmphases).filter(Boolean)
            .length === 1;

        if (!pool.length && !timerOnlySelected) {
          alert(
            "Cannot resume: No techniques found for the selected emphasis(es)."
          );
          return;
        }

        // Track resume event
        try {
          trackEvent("workout_resumed", {
            original_timestamp: logEntry.timestamp,
            rounds_remaining: logEntry.roundsPlanned - logEntry.roundsCompleted,
            rounds_completed: logEntry.roundsCompleted,
          });
        } catch {}

        // Unlock audio
        void ensureMediaUnlocked();

        // Set up the technique pool
        if (logEntry.settings?.readInOrder) {
          currentPoolRef.current = pool;
        } else {
          currentPoolRef.current = pool.sort(() => Math.random() - 0.5);
        }
        orderedIndexRef.current = 0;

        // Prime TTS
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

        // Start from the next incomplete round with pre-round countdown
        setCurrentRound(logEntry.roundsCompleted + 1);
        setIsPreRound(true);
        setPreRoundTimeLeft(5);

        speakSystem("Resuming workout. Get ready", voice, voiceSpeed);

        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 150);
    },
    [getTechniquePool, ensureMediaUnlocked, voiceSpeed, voice, speakSystem]
  );

  // Regenerate completion screen from logged data
  const viewCompletionScreen = useCallback((logEntry: any) => {
    // Recreate the completion screen from logged data
    setLastWorkout({
      timestamp: logEntry.timestamp,
      emphases: logEntry.emphases,
      difficulty: logEntry.difficulty,
      shotsCalledOut: logEntry.shotsCalledOut,
      roundsCompleted: logEntry.roundsCompleted,
      roundsPlanned: logEntry.roundsPlanned,
      roundLengthMin: logEntry.roundLengthMin,
      // Don't suggest install on replayed screens
      suggestInstall: false,
    });
    setPage("completed");

    // Track view event
    try {
      trackEvent("completion_screen_viewed", {
        workout_id: logEntry.id,
        is_replay: true,
      });
    } catch {}
  }, []);

  {
    (running || isPreRound) && (
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
    );
  }

  // ADD: missing shared inline style helpers (fixes many "Cannot find name" TS errors)
  const controlButtonStyle = (
    bg: string,
    border = bg
  ): React.CSSProperties => ({
    all: "unset",
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.65rem 0.9rem",
    borderRadius: "0.75rem",
    cursor: "pointer",
    fontWeight: 700,
    color: "white",
    background: `linear-gradient(180deg, ${bg} 0%, ${border} 100%)`,
    border: `1px solid ${border}`,
    boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
  });

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

  const chipButtonStyle: React.CSSProperties = {
    all: "unset",
    cursor: "pointer",
    width: "2.25rem",
    height: "2.25rem",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "0.5rem",
    backgroundColor: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.06)",
    color: "white",
    fontSize: "1.25rem",
    fontWeight: 700,
  };

  // Main Timer UI
  // --- Stats calculation functions (similar to WorkoutLogs) ---
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const homePageStats = useHomeStats(statsRefreshTrigger);

  // Find the favorite emphasis config by label (case-insensitive)
  const favoriteConfig = homePageStats?.mostCommonEmphasis
    ? emphasisList.find(
        (e) =>
          e.label.trim().toLowerCase() ===
          homePageStats.mostCommonEmphasis.trim().toLowerCase()
      )
    : null;

  // Add this helper right before the return
  const isActive = running || isPreRound;

  const TechniqueEditorAny =
    TechniqueEditor as unknown as React.ComponentType<any>;

  return (
    <>
      {/* Onboarding Modal */}
      <OnboardingModal
        open={showOnboardingMsg}
        modalScrollPosition={modalScrollPosition}
        linkButtonStyle={linkButtonStyle}
        setPage={setPage}
        onClose={closeOnboardingModal}
      />
      <style>{`
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
  body { background: linear-gradient(135deg, #831843 0%, #581c87 50%, #155e75 100%); background-attachment: fixed; }
  .main-timer {
    font-size: 8vw;
    font-weight: 900;
    color: white;
    letter-spacing: 0.05em;
    text-shadow: 0 4px 8px rgba(0,0,0,0.3);
    font-family: "system-ui, -apple-system, 'Segoe UI', sans-serif";
    text-align: center;
    width: 100%;
    margin: 0 auto;
    line-height: 1.1;
  }
  @media (max-width: 768px) {
    .main-timer { font-size: 12vw !important; }
  }
  @media (max-width: 480px) {
    .main-timer { font-size: 16vw !important; }
  }
  .hero-bg {
    position: fixed;
    inset: 0;
    z-index: -1;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }
  /* Responsive grid for emphasis buttons */
  .emphasis-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
    max-width: 60rem;
    margin: 0 auto;
    width: 100%;
  }
  @media (max-width: 900px) {
    .emphasis-grid {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.75rem;
    }
  }
  @media (max-width: 600px) {
    .emphasis-grid {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }
  }
  /* Make buttons and manage techniques full width on small screens */
  .emphasis-grid > button,
  .manage-techniques-btn {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    max-width: 100%;
    word-break: break-word;
  }
  @media (max-width: 600px) {
    .emphasis-grid > button,
    .manage-techniques-btn {
      padding: 1.1rem !important;
      font-size: 1rem !important;
    }
  }
  /* Prevent horizontal scroll on mobile */
  html, body, #root {
    max-width: 100vw;
    overflow-x: hidden;
  }
  @media (max-width: 600px) {
    .settings-toggle-row {
      flex-direction: column !important;
      gap: 1.25rem !important;
      align-items: stretch !important;
    }
    .section-header-with-button {
      flex-direction: column !important;
      align-items: center !important;
      text-align: center !important;
      gap: 1rem !important;
    }
    .section-header-with-button h2 {
      text-align: center !important;
    }
    .section-header-with-button p {
      text-align: center !important;
    }
  }
`}</style>
      <Header
        onHelp={() => setShowOnboardingMsg(true)}
        onLogoClick={() => {
          setPage("timer");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
      <div style={{ position: "relative", zIndex: 0 }}>
        {/* Fixed Background Image */}
        <div className="hero-bg">
          <picture>
            <source
              media="(min-width:1200px)"
              srcSet="/assets/hero_desktop.png"
            />
            <source
              media="(min-width:600px)"
              srcSet="/assets/hero_tablet.png"
            />
            <img
              src="/assets/hero_mobile.png"
              alt=""
              style={{
                width: "100vw",
                height: "100vh",
                minHeight: "100dvh", // Ensures full viewport coverage on iPad/iOS
                objectFit: "cover",
              }}
            />
          </picture>
          <img
            src="/assets/texture_overlay.png"
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              width: "100vw",
              height: "100vh",
              minHeight: "100dvh", // Ensures overlay matches background height
              objectFit: "cover",
              mixBlendMode: "overlay",
              opacity: 0.12,
              pointerEvents: "none",
            }}
          />
        </div>

        <main
          className="main-container"
          style={{
            minHeight: isActive ? "auto" : "100vh",
            color: "#fdf2f8",
            fontFamily: "system-ui, sans-serif",
            padding: "2rem",
          }}
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
                // Reset all session state
                if (
                  typeof window !== "undefined" &&
                  "speechSynthesis" in window
                ) {
                  try {
                    window.speechSynthesis.cancel();
                  } catch {
                    /* noop */
                  }
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

                // Restore the workout settings from lastWorkout
                // Convert emphasis labels back to keys
                const emphasisKeys = lastWorkout.emphases
                  .map((label: string) => {
                    const found = emphasisList.find((e) => e.label === label);
                    return found ? found.key : null;
                  })
                  .filter(Boolean);

                // Restore selected emphases
                const restoredEmphases: any = {};
                emphasisKeys.forEach((key: string) => {
                  restoredEmphases[key] = true;
                });
                setSelectedEmphases(restoredEmphases);

                // Navigate back to timer page
                setPage("timer");

                // Start a new session after state updates
                setTimeout(() => {
                  startSession();
                }, 150);
              }}
              onReset={() => setPage("timer")}
              onViewLog={() => setPage("logs")}
            />
          ) : (
            <>
              {/* Top area: Start/Timer/Controls */}
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

              {/* Settings */}
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
                  voiceCompatibilityWarning={voiceCompatibilityWarning}
                  trackEvent={trackEvent}
                  onStart={startSession}
                  difficulty={difficulty}
                  setDifficulty={setDifficulty}
                  clearAllEmphases={clearAllEmphases}
                />
              )}
            </>
          )}
        </main>

        <Footer
          isActive={isActive}
          hasSelectedEmphasis={hasSelectedEmphasis}
          linkButtonStyle={linkButtonStyle}
          setPage={setPage}
          setShowOnboardingMsg={setShowOnboardingMsg}
        />
      </div>{" "}
      {/* <-- This closes the <div style={{ position: 'relative', zIndex: 0 }}> */}
      {/* PWA Install Prompt - shows automatically after 30 seconds */}
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
