import React, { createContext, useCallback, useContext, useMemo } from "react";

import type { UnifiedVoice } from "@/utils/ttsService";
import { useTTS } from "../hooks/useTTS";

// Context for TTS state
interface TTSContextValue {
  // Voice management
  voices: UnifiedVoice[];
  currentVoice: UnifiedVoice | null;
  setCurrentVoice: (voice: UnifiedVoice | null) => void;
  englishVoices: UnifiedVoice[];

  // Speech controls
  speak: (text: string, options?: any) => Promise<void>;
  speakSystem: (text: string, rate?: number) => Promise<void>;
  speakSystemWithDuration: (
    text: string,
    rate?: number,
    onDurationMeasured?: (durationMs: number) => void
  ) => Promise<void>;
  stop: () => Promise<void>;
  testVoice: () => Promise<void>;

  // Status
  isAvailable: boolean;
  voiceCompatibilityWarning: string;

  // For backward compatibility - returns browser voice if available, otherwise null
  // This maintains the existing interface for components that expect SpeechSynthesisVoice
  browserVoice: SpeechSynthesisVoice | null;

  // Voice preference management
  saveVoicePreference: (voice: UnifiedVoice | null) => void;
}

const TTSContext = createContext<TTSContextValue | null>(null);

export const useTTSContext = () => {
  const context = useContext(TTSContext);
  if (!context) {
    throw new Error("useTTSContext must be used within TTSProvider");
  }
  return context;
};

interface TTSProviderProps {
  children: React.ReactNode;
}

export const TTSProvider: React.FC<TTSProviderProps> = ({ children }) => {
  const {
    voices: unifiedVoices,
    currentVoice,
    setCurrentVoice,
    englishVoices,
    speak,
    speakSystem,
    speakSystemWithDuration,
    stop,
    isAvailable,
    voiceCompatibilityWarning,
    testVoice,
  } = useTTS();

  // For backward compatibility: extract browser voice if available
  const browserVoice = useMemo(() => {
    if (!currentVoice) return null;
    return currentVoice.browserVoice || null;
  }, [currentVoice]);

  // Voice preference management (moved from App.tsx)
  const saveVoicePreference = useCallback((voice: UnifiedVoice | null) => {
    if (!voice) {
      localStorage.removeItem("selectedVoice");
      return;
    }

    // SECURITY: Only save English voices
    const isEnglish = voice.language.toLowerCase().startsWith("en");
    if (!isEnglish) {
      localStorage.removeItem("selectedVoice");
      return;
    }

    localStorage.setItem(
      "selectedVoice",
      JSON.stringify({
        id: voice.id,
        name: voice.name,
        language: voice.language,
        isDefault: voice.isDefault,
      })
    );
  }, []);

  const value: TTSContextValue = {
    voices: unifiedVoices,
    currentVoice,
    setCurrentVoice,
    englishVoices,
    speak,
    speakSystem,
    speakSystemWithDuration,
    stop,
    testVoice,
    isAvailable,
    voiceCompatibilityWarning,
    browserVoice,
    saveVoicePreference,
  };

  return <TTSContext.Provider value={value}>{children}</TTSContext.Provider>;
};
