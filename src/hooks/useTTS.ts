import { useCallback, useEffect, useRef, useState } from "react";
import {
  type TTSOptions,
  ttsService,
  type UnifiedVoice,
} from "../utils/ttsService";

// Emergency WebMediaPlayer cleanup on module load
(() => {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      // Cancel any existing speech synthesis
      window.speechSynthesis.cancel();

      // Force garbage collection if available
      if ("gc" in window) {
        (window as any).gc();
      }

      // Emergency TTS cleanup applied on module load
    } catch (error) {
      // Emergency TTS cleanup failed
    }
  }
})();

// Storage key for voice preferences (from your existing code)
const VOICE_STORAGE_KEY = "selectedVoice";

export interface UseTTSReturn {
  // Voice management
  voices: UnifiedVoice[];
  currentVoice: UnifiedVoice | null;
  setCurrentVoice: (voice: UnifiedVoice | null) => void;
  englishVoices: UnifiedVoice[];

  // Speech controls
  speak: (text: string, options?: TTSOptions) => Promise<void>;
  speakSystem: (text: string, rate?: number) => Promise<void>;
  speakSystemWithDuration: (
    text: string,
    rate?: number,
    onDurationMeasured?: (durationMs: number) => void
  ) => Promise<void>;
  speakTechnique: (
    text: string,
    rate?: number,
    isGuarded?: boolean
  ) => Promise<void>;
  stop: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;

  // Status
  isAvailable: boolean;
  isSpeaking: boolean;
  platform: "native" | "web";

  // Compatibility (for migration from existing code)
  voiceCompatibilityWarning: string;

  // Testing
  testVoice: () => Promise<void>;
}

export const useTTS = (): UseTTSReturn => {
  const [voices, setVoices] = useState<UnifiedVoice[]>([]);
  const [englishVoices, setEnglishVoices] = useState<UnifiedVoice[]>([]);
  const [currentVoice, setCurrentVoiceState] = useState<UnifiedVoice | null>(
    null
  );
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceCompatibilityWarning, setVoiceCompatibilityWarning] =
    useState("");

  const isAvailable = ttsService.isAvailable();
  const platform = ttsService.getPlatform();

  // TTS guard for technique callouts (from your existing logic)
  const ttsGuardRef = useRef<boolean>(false);
  const runningRef = useRef<boolean>(false);

  // Initialize voices on mount
  useEffect(() => {
    const initVoices = async () => {
      try {
        const allVoices = await ttsService.getVoices();
        const englishOnly = await ttsService.getEnglishVoices();

        setVoices(allVoices);
        setEnglishVoices(englishOnly);

        // Check for compatibility warnings
        if (allVoices.length === 0) {
          setVoiceCompatibilityWarning("No text-to-speech voices available.");
        } else if (englishOnly.length === 0) {
          setVoiceCompatibilityWarning(
            "No English text-to-speech voices available."
          );
        } else {
          setVoiceCompatibilityWarning("");
        }

        // Load saved voice preference
        const savedVoice = loadVoicePreference(englishOnly);
        if (savedVoice) {
          setCurrentVoiceState(savedVoice);
          ttsService.setVoice(savedVoice);
        } else {
          // Auto-select American English voice if available, otherwise first English voice
          let defaultVoice = englishOnly.find((v) => v.isDefault) || null;

          // Prioritize American English voices
          const americanVoice = englishOnly.find(
            (v) =>
              v.language.toLowerCase() === "en-us" ||
              v.language.toLowerCase() === "en_us" ||
              v.language.toLowerCase().startsWith("en-us") ||
              v.language.toLowerCase().startsWith("en_us") ||
              v.name.toLowerCase().includes("united states") ||
              v.name.toLowerCase().includes("us english") ||
              (v.name.toLowerCase().includes("english") &&
                v.name.toLowerCase().includes(" us "))
          );

          if (americanVoice) {
            defaultVoice = americanVoice;
          } else {
            // Fallback to any English voice
            defaultVoice = defaultVoice || englishOnly[0];
          }

          if (defaultVoice) {
            setCurrentVoiceState(defaultVoice);
            ttsService.setVoice(defaultVoice);
          }
        }
      } catch (error) {
        setVoiceCompatibilityWarning("Failed to load text-to-speech voices.");
      }
    };

    initVoices();
  }, []);

  // Voice persistence helpers (adapted from your existing code)
  const saveVoicePreference = useCallback((voice: UnifiedVoice | null) => {
    if (!voice) {
      localStorage.removeItem(VOICE_STORAGE_KEY);
      return;
    }

    // SECURITY: Only save English voices to prevent non-English voices from persisting
    const isEnglish = voice.language.toLowerCase().startsWith("en");
    if (!isEnglish) {
      localStorage.removeItem(VOICE_STORAGE_KEY);
      return;
    }

    // Store voice data for matching later
    const voiceData = {
      id: voice.id,
      name: voice.name,
      language: voice.language,
      isDefault: voice.isDefault,
    };
    localStorage.setItem(VOICE_STORAGE_KEY, JSON.stringify(voiceData));
  }, []);

  const loadVoicePreference = useCallback((availableVoices: UnifiedVoice[]) => {
    try {
      const stored = localStorage.getItem(VOICE_STORAGE_KEY);
      if (!stored || !availableVoices.length) return null;

      const voiceData = JSON.parse(stored);
      // Try to find exact match by ID first, then by name and language
      const matchedVoice = availableVoices.find(
        (v) =>
          v.id === voiceData.id ||
          (v.name === voiceData.name && v.language === voiceData.language)
      );

      if (matchedVoice) {
        // Only return saved voice if it's English-compatible
        const isEnglishCompatible = matchedVoice.language
          .toLowerCase()
          .startsWith("en");
        if (isEnglishCompatible) {
          return matchedVoice;
        } else {
          localStorage.removeItem(VOICE_STORAGE_KEY);
          return null;
        }
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  }, []);

  // Set current voice with persistence
  const setCurrentVoice = useCallback(
    (voice: UnifiedVoice | null) => {
      setCurrentVoiceState(voice);
      ttsService.setVoice(voice);
      saveVoicePreference(voice);
    },
    [saveVoicePreference]
  );

  // Speech functions
  const speak = useCallback(async (text: string, options: TTSOptions = {}) => {
    try {
      setIsSpeaking(true);
      await ttsService.speak(text, {
        ...options,
        onDone: () => {
          setIsSpeaking(false);
          options.onDone?.();
        },
        onError: (error) => {
          setIsSpeaking(false);
          options.onError?.(error);
        },
      });
    } catch (error) {
      setIsSpeaking(false);
    }
  }, []);

  const speakSystem = useCallback(
    async (text: string, rate: number = 1.0) => {
      await ttsService.speakSystem(text, {
        voice: currentVoice,
        rate,
        onStart: () => setIsSpeaking(true),
        onDone: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    },
    [currentVoice]
  );

  // Enhanced speakSystem with duration callback for responsive callout timing
  const speakSystemWithDuration = useCallback(
    async (
      text: string,
      rate: number = 1.0,
      onDurationMeasured?: (durationMs: number) => void
    ) => {
      await ttsService.speakSystem(text, {
        voice: currentVoice,
        rate,
        onStart: () => setIsSpeaking(true),
        onDone: (durationMs?: number) => {
          setIsSpeaking(false);
          if (onDurationMeasured && durationMs) {
            onDurationMeasured(durationMs);
          }
        },
        onError: () => setIsSpeaking(false),
      });
    },
    [currentVoice]
  );

  const speakTechnique = useCallback(
    async (text: string, rate: number = 1.0, isGuarded: boolean = true) => {
      // Apply your existing guard logic
      if (isGuarded && (ttsGuardRef.current || !runningRef.current)) {
        return;
      }

      await ttsService.speakTechnique(
        text,
        {
          voice: currentVoice,
          rate,
          onStart: () => {
            // Check guards again on start
            if (isGuarded && (ttsGuardRef.current || !runningRef.current)) {
              ttsService.stop();
            } else {
              setIsSpeaking(true);
            }
          },
          onDone: () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false),
        },
        isGuarded
      );
    },
    [currentVoice]
  );

  const stop = useCallback(async () => {
    await ttsService.stop();
    setIsSpeaking(false);
  }, []);

  const pause = useCallback(async () => {
    await ttsService.pause();
  }, []);

  const resume = useCallback(async () => {
    await ttsService.resume();
  }, []);

  // Test voice function (adapted from your existing code)
  const testVoice = useCallback(async () => {
    try {
      // For web, resume audio context on user interaction
      if (platform === "web" && "AudioContext" in window) {
        const audioContext = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
        await audioContext.resume();
      }

      // Use speakImmediate to avoid queueing and ensure immediate playback with current voice
      await ttsService.speakImmediate("Testing voice with current settings.", {
        voice: currentVoice,
        rate: 1.0,
        onStart: () => setIsSpeaking(true),
        onDone: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    } catch (error) {
      setIsSpeaking(false);
      // Error testing voice
    }
  }, [currentVoice, platform]);

  // Update TTS guard refs (these would be controlled by your main app logic)
  const updateGuards = useCallback((ttsGuard: boolean, running: boolean) => {
    ttsGuardRef.current = ttsGuard;
    runningRef.current = running;
  }, []);

  // Expose guard update function for integration with existing app logic
  (speak as any).updateGuards = updateGuards;

  return {
    // Voice management
    voices,
    currentVoice,
    setCurrentVoice,
    englishVoices,

    // Speech controls
    speak,
    speakSystem,
    speakSystemWithDuration,
    speakTechnique,
    stop,
    pause,
    resume,

    // Status
    isAvailable,
    isSpeaking,
    platform,

    // Compatibility
    voiceCompatibilityWarning,

    // Testing
    testVoice,
  };
};
