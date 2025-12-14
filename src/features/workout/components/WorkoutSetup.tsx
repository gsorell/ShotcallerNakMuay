import { trackEvent } from "@/utils/analytics";
import React from "react";
import { ImageWithFallback, useUIContext } from "../../shared";
import { EmphasisSelector } from "../../technique-editor";
import { useWorkoutContext } from "../contexts/WorkoutProvider";
import { AdvancedSettingsPanel } from "./AdvancedSettingsPanel";
import { StickyStartControls } from "./StickyStartControls";
import { WorkoutConfiguration } from "./WorkoutConfiguration";
import "./WorkoutSetup.css";

export default function WorkoutSetup() {
  const {
    settings,
    emphasisList,
    techniques,
    homePageStats: stats,
    favoriteConfig,
    startSession: onStart,
    hasSelectedEmphasis,
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
      <div className="workout-setup-stats-container">
        {stats && (
          <React.Fragment>
            {favoriteConfig && (
                <button
                  type="button"
                  onClick={() => setPage("logs")}
                  className="workout-setup-stat-btn"
                >
                <ImageWithFallback
                  srcPath={favoriteConfig.iconPath}
                  alt={favoriteConfig.label}
                  emoji={favoriteConfig.emoji || "🎯"}
                  className="workout-setup-stat-icon"
                />
                <span style={{ fontWeight: 600 }}>{favoriteConfig.label}</span>
              </button>
            )}
            <button
                type="button"
                onClick={() => setPage("logs")}
                className="workout-setup-stat-btn"
              >
              <span role="img" aria-label="flame">
                🔥
              </span>
              <span style={{ fontWeight: 700 }}>{stats.current}</span>
            </button>
          </React.Fragment>
        )}
      </div>

      <div className="workout-setup-container">
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
          className="workout-setup-advanced-toggle"
        >
          {showAdvanced ? "Hide" : "Show"} Advanced Settings
        </button>

        {showAdvanced && <AdvancedSettingsPanel />}

        {hasSelectedEmphasis && (
          <StickyStartControls
            onStart={onStart}
            difficulty={difficulty}
            setDifficulty={setDifficulty}
            selectedEmphases={selectedEmphases}
            onClearEmphases={clearAllEmphases}
          />
        )}
      </div>
    </div>
  );
}
