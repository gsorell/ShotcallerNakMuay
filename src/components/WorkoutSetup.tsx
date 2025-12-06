import React from "react";
import type { Difficulty, EmphasisKey, TechniquesShape } from "../types";
import { AdvancedSettingsPanel } from "./AdvancedSettingsPanel";
import { EmphasisSelector } from "./EmphasisSelector";
import { ImageWithFallback } from "./ImageWithFallback";
import { StickyStartControls } from "./StickyStartControls";
import { WorkoutConfiguration } from "./WorkoutConfiguration";

// Define the data this component needs from the parent
interface WorkoutSetupProps {
  stats: any; // The homePageStats
  favoriteConfig: any;
  emphasisList: any[];
  selectedEmphases: Record<EmphasisKey, boolean>;
  toggleEmphasis: (k: EmphasisKey) => void;
  techniques: TechniquesShape;
  showAllEmphases: boolean;
  setShowAllEmphases: any;
  setPage: (page: any) => void;

  // Configuration props
  roundsCount: number;
  setRoundsCount: (n: number) => void;
  roundMin: number;
  setRoundMin: (n: number) => void;
  restMinutes: number;
  setRestMinutes: (n: number) => void;

  // Advanced Settings props
  showAdvanced: boolean;
  setShowAdvanced: (show: boolean) => void;
  southpawMode: boolean;
  setSouthpawMode: (b: boolean) => void;
  addCalisthenics: boolean;
  setAddCalisthenics: (b: boolean) => void;
  readInOrder: boolean;
  setReadInOrder: (b: boolean) => void;

  // Voice props
  voice: SpeechSynthesisVoice | null;
  voices: SpeechSynthesisVoice[];
  unifiedVoices: any[];
  setCurrentVoice: (v: any) => void;
  saveVoicePreference: (v: any) => void;
  checkVoiceCompatibility: (v: any, list: any) => void;
  ttsService: any;
  voiceSpeed: number;
  setVoiceSpeed: (n: number) => void;
  ttsAvailable: boolean;
  testVoice: () => void;
  voiceCompatibilityWarning: string;
  trackEvent: (name: string, data?: any) => void;

  // Start Controls
  onStart: () => void;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  clearAllEmphases: () => void;
}

export default function WorkoutSetup(props: WorkoutSetupProps) {
  const {
    stats,
    favoriteConfig,
    setPage,
    emphasisList,
    selectedEmphases,
    toggleEmphasis,
    techniques,
    showAllEmphases,
    setShowAllEmphases,
    roundsCount,
    setRoundsCount,
    roundMin,
    setRoundMin,
    restMinutes,
    setRestMinutes,
    showAdvanced,
    setShowAdvanced,
    southpawMode,
    setSouthpawMode,
    addCalisthenics,
    setAddCalisthenics,
    readInOrder,
    setReadInOrder,
    voice,
    voices,
    unifiedVoices,
    setCurrentVoice,
    saveVoicePreference,
    checkVoiceCompatibility,
    ttsService,
    voiceSpeed,
    setVoiceSpeed,
    ttsAvailable,
    testVoice,
    voiceCompatibilityWarning,
    trackEvent,
    onStart,
    difficulty,
    setDifficulty,
    clearAllEmphases,
  } = props;

  return (
    <div>
      {/* Compact Favorite Style & Streak */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: "1rem",
          flexWrap: "wrap",
        }}
      >
        {stats && (
          <React.Fragment>
            {favoriteConfig && (
              <button
                type="button"
                onClick={() => setPage("logs")}
                style={/* ... styles from App.tsx ... */ {}}
              >
                <ImageWithFallback
                  srcPath={favoriteConfig.iconPath}
                  alt={favoriteConfig.label}
                  emoji={favoriteConfig.emoji || "🎯"}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    objectFit: "cover",
                  }}
                />
                <span style={{ fontWeight: 600 }}>{favoriteConfig.label}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setPage("logs")}
              style={/* ... styles from App.tsx ... */ {}}
            >
              <span role="img" aria-label="flame">
                🔥
              </span>
              <span style={{ fontWeight: 700 }}>{stats.current}</span>
            </button>
          </React.Fragment>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "3rem" }}>
        <EmphasisSelector
          emphasisList={emphasisList}
          selectedEmphases={selectedEmphases}
          toggleEmphasis={toggleEmphasis}
          techniques={techniques}
          showAllEmphases={showAllEmphases}
          setShowAllEmphases={setShowAllEmphases}
          onManageTechniques={() => {
            try {
              trackEvent("technique_editor_open");
            } catch {}
            setPage("editor");
          }}
        />

        <WorkoutConfiguration
          roundsCount={roundsCount}
          setRoundsCount={setRoundsCount}
          roundMin={roundMin}
          setRoundMin={setRoundMin}
          restMinutes={restMinutes}
          setRestMinutes={setRestMinutes}
        />

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            all: "unset",
            cursor: "pointer",
            color: "#f9a8d4",
            padding: "0.5rem 0.75rem",
            textAlign: "center",
            fontWeight: 700,
          }}
        >
          {showAdvanced ? "Hide" : "Show"} Advanced Settings
        </button>

        {showAdvanced && (
          <AdvancedSettingsPanel
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
            ttsAvailable={ttsAvailable}
            testVoice={testVoice}
            voiceCompatibilityWarning={voiceCompatibilityWarning}
            setVoiceSpeed={setVoiceSpeed}
            trackEvent={trackEvent}
          />
        )}

        <StickyStartControls
          onStart={onStart}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          selectedEmphases={selectedEmphases}
          onClearEmphases={clearAllEmphases}
        />
      </div>
    </div>
  );
}
