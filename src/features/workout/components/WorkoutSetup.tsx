import { trackEvent } from "@/utils/analytics";
import React from "react";
import { ImageWithFallback, useUIContext } from "../../shared";
import { EmphasisSelector } from "../../technique-editor";
import { useWorkoutContext } from "../contexts/WorkoutProvider";
import { AdvancedSettingsPanel } from "./AdvancedSettingsPanel";
import { StickyStartControls } from "./StickyStartControls";
import { WorkoutConfiguration } from "./WorkoutConfiguration";

export default function WorkoutSetup() {
  const {
    settings,
    emphasisList,
    techniques,
    homePageStats: stats,
    favoriteConfig,
    startSession: onStart,
  } = useWorkoutContext();

  const {
    setPage,
    showAdvanced,
    setShowAdvanced,
    showAllEmphases,
    setShowAllEmphases,
  } = useUIContext();

  const {
    selectedEmphases,
    toggleEmphasis,
    difficulty,
    setDifficulty,
    clearAllEmphases,
  } = settings;
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

        <WorkoutConfiguration />

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

        {showAdvanced && <AdvancedSettingsPanel />}

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
