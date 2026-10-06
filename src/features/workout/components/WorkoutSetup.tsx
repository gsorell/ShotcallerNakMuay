// Direct import, not the roadmap barrel — the barrel exports RoadmapSection,
// which imports this feature back.
import { StartHereBanner } from "@/features/roadmap/components/StartHereBanner";
// Deep imports rather than the learn barrel: the barrel pulls LearnSection,
// which imports this feature back.
import { SpriteFigure } from "@/features/learn/components/TechniqueSprite";
import {
  LANDED_FRAME,
  spritesFor,
} from "@/features/learn/data/techniqueSprites";
import { trackEvent } from "@/utils/analytics";
import React from "react";
import { useUIContext } from "../../shared";
import { EmphasisSelector } from "../../technique-editor";
import { useWorkoutContext } from "../contexts/WorkoutProvider";
import "./WorkoutSetup.css";

/**
 * The figure on the Learn card. Fixed rather than random: this card sits in
 * the same place on every visit, and a silhouette that changed under you would
 * read as a different destination each time.
 *
 * Held on the landed frame rather than looped. Here the figure illustrates a
 * destination rather than demonstrating a technique, and a lone moving thing
 * on an otherwise static screen asks to be watched instead of read.
 *
 * A kick because it has to work at 64px: a kick throws a limb clear of the
 * body and stays legible, where a punch that small is a standing figure with a
 * twitch at one shoulder. The head kick is the one that reads best of them —
 * and at full extension it is unmistakable as a single frame.
 */
const learnFigure = spritesFor("head-kick")[0];

export default function WorkoutSetup() {
  const {
    settings,
    emphasisList,
    techniques,
    persistTechniques,
  } = useWorkoutContext();

  const {
    setPage,
    showAllEmphases,
    setShowAllEmphases,
    setEditorFocusKey,
  } = useUIContext();

  const { selectedEmphases, toggleEmphasis } = settings;
  return (
    <div>
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
          // No "browse the library" link under it any more: the Learn card
          // below the styles and the menu in the header both go there, and a
          // third way in was one more thing standing between the heading and
          // the tiles.
          leadSlot={<StartHereBanner />}
          onManageTechniques={(groupKey?: string) => {
            try {
              trackEvent("technique_editor_open", {
                source: groupKey ? "tile_inline" : "manage_button",
              });
            } catch { /* analytics must never break the navigation it measures */ }
            setEditorFocusKey(groupKey ?? null);
            setPage("editor");
          }}
        />

        {/* Learn is a destination — a curriculum and a library of filmed
            technique. Managing techniques is a tool for changing what gets
            called, so it lives with the styles it edits, inside the selector
            above, rather than beside this card.

            The figure is the argument for the card: it is a sample of what is
            inside rather than a symbol standing for it, and being the only
            thing on this screen that MOVES, it cannot be mistaken for another
            selectable style tile the way a second neon icon could. */}
        <div className="setup-action-row">
          <button
            onClick={() => {
              trackEvent("learn_open", { source: "setup" });
              setPage("learn");
            }}
            className="setup-learn-card"
          >
            {learnFigure && (
              <SpriteFigure
                variant={learnFigure}
                name="Learn"
                frame={LANDED_FRAME}
                className="setup-learn-figure"
              />
            )}
            <span className="setup-learn-text">
              <span className="setup-learn-title">Learn</span>
              <span className="setup-learn-desc">
                Guided path, and technique reference
              </span>
            </span>
            <span className="setup-learn-chevron" aria-hidden="true">
              ›
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
