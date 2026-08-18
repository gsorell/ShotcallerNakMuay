// Direct import, not the roadmap barrel — the barrel exports RoadmapSection,
// which imports this feature back.
import { StartHereBanner } from "@/features/roadmap/components/StartHereBanner";
import { trackEvent } from "@/utils/analytics";
import React from "react";
import { ImageWithFallback, useUIContext } from "../../shared";
import { EmphasisSelector } from "../../technique-editor";
import { useWorkoutContext } from "../contexts/WorkoutProvider";
import { AdvancedSettingsPanel } from "./AdvancedSettingsPanel";
import "./WorkoutSetup.css";

export default function WorkoutSetup() {
  const {
    settings,
    emphasisList,
    techniques,
    persistTechniques,
    homePageStats: stats,
    favoriteConfig,
  } = useWorkoutContext();

  const {
    setPage,
    showAdvanced,
    setShowAdvanced,
    showAllEmphases,
    setShowAllEmphases,
    setEditorFocusKey,
  } = useUIContext();

  const { selectedEmphases, toggleEmphasis } = settings;
  return (
    <div>
      {/* Compact Favorite Style & Streak - Combined Button */}
      <div className="workout-setup-stats-container">
        {stats && (
          <button
            type="button"
            onClick={() => {
              trackEvent("workout_logs_open", { source: "stats_button" });
              setPage("logs");
            }}
            className="workout-setup-stat-btn"
          >
            {favoriteConfig && (
              <>
                <ImageWithFallback
                  srcPath={favoriteConfig.iconPath}
                  alt={favoriteConfig.label}
                  emoji={favoriteConfig.emoji || "🎯"}
                  className="workout-setup-stat-icon"
                />
                <span style={{ fontWeight: 600 }}>{favoriteConfig.label}</span>
              </>
            )}
            <span role="img" aria-label="flame">
              🔥
            </span>
            <span style={{ fontWeight: 700 }}>{stats.current}</span>
          </button>
        )}
      </div>

      <div className="workout-setup-container">
        <EmphasisSelector
          emphasisList={emphasisList}
          selectedEmphases={selectedEmphases}
          toggleEmphasis={toggleEmphasis}
          techniques={techniques}
          setTechniques={persistTechniques}
          showAllEmphases={showAllEmphases}
          setShowAllEmphases={setShowAllEmphases}
          // Sits with the styles rather than above them: it answers the
          // question the grid poses, so it belongs in the same space.
          leadSlot={<StartHereBanner />}
          onManageTechniques={(groupKey?: string) => {
            try {
              trackEvent("technique_editor_open", {
                source: groupKey ? "tile_inline" : "manage_button",
              });
            } catch {}
            setEditorFocusKey(groupKey ?? null);
            setPage("editor");
          }}
        />

        {/* The two secondary destinations off the setup screen. They live here
            rather than inside EmphasisSelector so they can share one row and
            read as a matched pair beneath the style grid. */}
        <div className="setup-action-row">
          {/* One learning destination, not two. The guided path and the
              technique library are the same material — a curriculum over it and
              a reference into it — so they share a page, and this row keeps to
              the two things that are genuinely different: learning, and
              editing what gets called out. */}
          <button
            onClick={() => {
              trackEvent("learn_open", { source: "setup" });
              setPage("learn");
            }}
            className="setup-action-btn"
          >
            <img
              src="/assets/icon.muaytech.png"
              alt=""
              aria-hidden="true"
              className="setup-action-btn-icon"
            />
            <span className="setup-action-btn-text">
              <span className="setup-action-btn-title">Learn</span>
              <span className="setup-action-btn-desc">
                Guided path, and every technique explained
              </span>
            </span>
          </button>

          <button
            onClick={() => {
              try {
                trackEvent("technique_editor_open", {
                  source: "manage_button",
                });
              } catch {}
              setEditorFocusKey(null);
              setPage("editor");
            }}
            className="setup-action-btn"
          >
            <img
              src="/assets/icon_edit.png"
              alt=""
              aria-hidden="true"
              className="setup-action-btn-icon"
            />
            <span className="setup-action-btn-text">
              <span className="setup-action-btn-title">Manage Techniques</span>
              <span className="setup-action-btn-desc">
                Edit sets or build your own
              </span>
            </span>
          </button>
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="workout-setup-advanced-toggle"
        >
          {showAdvanced ? "Hide" : "Show"} Advanced Settings
        </button>

        {showAdvanced && <AdvancedSettingsPanel />}
      </div>
    </div>
  );
}
