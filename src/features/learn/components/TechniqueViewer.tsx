import { useCallback, useState } from "react";

import { LANDED_FRAME, SPRITE_FRAMES, spritesFor } from "../data/techniqueSprites";
import { TechniqueSprite } from "./TechniqueSprite";
import "./TechniqueViewer.css";

interface TechniqueViewerProps {
  /** Lesson slug. A lesson with no sheet renders nothing at all. */
  slug: string;
  /** Technique name, already mirrored for a southpaw by the caller. */
  name: string;
}

/**
 * The figure on a lesson page, with the loop under the reader's control.
 *
 * A looping silhouette shows the shape but not the order. At 1.15s for six
 * frames each pose is on screen for under 200ms, which is the whole point when
 * you want the rhythm and useless when you want to know where the rear heel is
 * at the moment of extension. So: stop it, and step.
 *
 * Pausing holds the landed frame rather than wherever the loop happened to be.
 * CSS animation position cannot be read back, so "pause here" is not available
 * — and landing on the frame the sheet was built around is a better answer than
 * an arbitrary one.
 *
 * Stepping drives every sheet the lesson has at once. The paired lessons are
 * one technique from two sides, so holding frame three on the left and frame
 * five on the right would be comparing nothing to nothing.
 */
export function TechniqueViewer({ slug, name }: TechniqueViewerProps) {
  const [frame, setFrame] = useState<number | null>(null);

  const step = useCallback((delta: number) => {
    setFrame((f) => {
      const from = f ?? LANDED_FRAME;
      // Wraps, because the movement does — frame six runs into frame one.
      return (from + delta + SPRITE_FRAMES) % SPRITE_FRAMES;
    });
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      }
      // Space and Enter are left alone: a <button> already fires its onClick
      // for both, and handling them here as well would toggle twice.
    },
    [step]
  );

  if (spritesFor(slug).length === 0) return null;

  const playing = frame === null;

  return (
    <div className="viewer" onKeyDown={onKeyDown}>
      <TechniqueSprite slug={slug} name={name} frame={frame} />

      <div className="viewer-controls">
        <button
          type="button"
          className="viewer-step"
          aria-label="Previous frame"
          onClick={() => step(-1)}
        >
          <span aria-hidden="true">◀</span>
        </button>

        <button
          type="button"
          className="viewer-play"
          aria-pressed={!playing}
          aria-label={playing ? `Hold ${name} still` : `Play ${name}`}
          onClick={() => setFrame((f) => (f === null ? LANDED_FRAME : null))}
        >
          <span aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
          {playing ? "Pause" : "Play"}
        </button>

        <button
          type="button"
          className="viewer-step"
          aria-label="Next frame"
          onClick={() => step(1)}
        >
          <span aria-hidden="true">▶</span>
        </button>
      </div>

      <p className="viewer-hint">
        {playing
          ? "Six frames at the speed the callouts run. Pause to step through."
          : `Frame ${(frame ?? 0) + 1} of ${SPRITE_FRAMES}${
              frame === LANDED_FRAME ? " — furthest extension" : ""
            }. Arrow keys step.`}
      </p>
    </div>
  );
}

export default TechniqueViewer;
