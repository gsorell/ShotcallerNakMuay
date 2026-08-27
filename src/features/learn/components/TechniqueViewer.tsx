import { useCallback, useId, useRef, useState } from "react";

import { LANDED_FRAME, SPRITE_FRAMES, spritesFor } from "../data/techniqueSprites";
import { SpriteFigure, TechniqueSprite } from "./TechniqueSprite";
import { ViewerShell, activate, keepOpen } from "./ViewerShell";
import "./TechniqueViewer.css";

interface TechniqueViewerProps {
  /** Lesson slug. A lesson with no sheet renders nothing at all. */
  slug: string;
  /** Technique name, already mirrored for a southpaw by the caller. */
  name: string;
  /**
   * Which of the lesson's sheets to show, by position in `spritesFor`. A
   * lesson page is one technique, so this is always set there; omitted, every
   * sheet plays together.
   */
  variantIndex?: number | null;
  /**
   * The lesson's summary. Only its first sentence is shown — see `openingLine`.
   */
  summary?: string;
}

/**
 * The first sentence of a lesson summary.
 *
 * The viewing mode wants a caption, not the paragraph the page already has
 * below it: summaries run to 187 characters at the median, where their first
 * sentences run to 80 and top out at 135 — one or two lines under the figure.
 *
 * Naive sentence splitting is usually a trap, but not against this text: no
 * summary in the library has a first sentence ending on an abbreviation, so
 * there is nothing here for "e.g." to break. If one ever does, the worst case
 * is a caption that stops early.
 */
function openingLine(summary: string): string {
  return (summary.match(/^.*?[.!?](?=\s|$)/) ?? [summary])[0];
}

/**
 * The figure on a lesson page: framed where it sits, and openable.
 *
 * A looping silhouette shows the shape but not the order. At 1.15s for six
 * frames each pose is on screen for under 200ms, which is the whole point when
 * you want the rhythm and useless when you want to know where the rear heel is
 * at the moment of extension. So: stop it, and step.
 *
 * That control used to live on the lesson page as three buttons under a figure
 * floating on the page background. Both halves of that were wrong. The figure
 * had no edge, so it read as decoration rather than as the subject; and a
 * transport under a 150px silhouette asks you to study something too small to
 * study. Now the page shows the figure in a plain frame at a glance-able size,
 * and the frame opens a viewing mode where the silhouette is as large as the
 * screen allows and the controls are worth having.
 *
 * In that mode the figure itself is the play/pause target — the thing you are
 * already looking at, rather than a control beside it. Pausing holds the
 * landed frame rather than wherever the loop happened to be: CSS animation
 * position cannot be read back, so "pause here" is not available, and landing
 * on the frame the sheet was built around is a better answer than an arbitrary
 * one. Playing restarts the loop from frame one for the same reason.
 *
 * (The combination player next door pauses wherever it is, because it drives
 * its own frames in JS and therefore knows where it stopped. The two modes
 * differ because what they can honestly offer differs.)
 *
 * Nothing inside the viewing mode closes it; everything around it does, and
 * there is an ✕ for anyone who would rather not find that out by trying — see
 * `ViewerShell`, which owns both and the reasons for them.
 */
export function TechniqueViewer({
  slug,
  name,
  variantIndex = null,
  summary,
}: TechniqueViewerProps) {
  const [open, setOpen] = useState(false);
  const [frame, setFrame] = useState<number | null>(null);
  const titleId = useId();
  const openerRef = useRef<HTMLDivElement>(null);

  const step = useCallback((delta: number) => {
    setFrame((f) => {
      const from = f ?? LANDED_FRAME;
      // Wraps, because the movement does — frame six runs into frame one.
      return (from + delta + SPRITE_FRAMES) % SPRITE_FRAMES;
    });
  }, []);

  const openViewer = useCallback(() => {
    // Always opens playing. The reader tapped a looping figure; it should keep
    // looping until they ask it not to, whatever they left it on last time.
    setFrame(null);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const togglePlay = useCallback(
    () => setFrame((f) => (f === null ? LANDED_FRAME : null)),
    []
  );

  const sheets = spritesFor(slug);
  if (sheets.length === 0) return null;

  const playing = frame === null;

  // The one sheet this page is showing, which the filmstrip needs by hand —
  // TechniqueSprite does the picking internally and hands back nothing. An
  // out-of-range index means no such sheet rather than "clamp to the first",
  // the same rule TechniqueSprite follows, so the strip simply does not draw.
  const sheet = variantIndex === null ? sheets[0] : sheets[variantIndex];

  return (
    <div className="viewer">
      <div
        ref={openerRef}
        className="viewer-frame"
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`Open ${name} larger`}
        onClick={openViewer}
        onKeyDown={activate(openViewer)}
      >
        <TechniqueSprite slug={slug} name={name} variantIndex={variantIndex} />
      </div>

      {/* Hidden from screen readers on purpose: the frame's own label already
          says it opens larger, and this would be that sentence a second time.
          It is here for the eye, which has nothing else to go on. */}
      <p className="viewer-cue" aria-hidden="true">
        Tap to enlarge
      </p>

      <ViewerShell
        open={open}
        onClose={close}
        onStep={step}
        openerRef={openerRef}
        labelledBy={titleId}
      >
        <div
          className="viewer-figure"
          role="button"
          tabIndex={0}
          aria-pressed={!playing}
          aria-label={playing ? `Hold ${name} still` : `Play ${name}`}
          onClick={(e) => {
            keepOpen(e);
            togglePlay();
          }}
          onKeyDown={activate(togglePlay)}
        >
          <TechniqueSprite
            slug={slug}
            name={name}
            frame={frame}
            variantIndex={variantIndex}
          />
        </div>

        {/* The whole movement laid out at once. The port shows you one
            instant; this shows you the shape of the thing either side of it,
            which is what tells you whether the frame you are looking at is the
            one you wanted. Picking one holds it, so it is a scrubber as much
            as an index. */}
        {sheet && (
          <div
            className="viewer-strip"
            role="group"
            aria-label={`${name} frames`}
            onClick={keepOpen}
          >
            {Array.from({ length: SPRITE_FRAMES }, (_, i) => (
              <div
                key={i}
                className={
                  "viewer-thumb" + (frame === i ? " viewer-thumb--on" : "")
                }
                role="button"
                tabIndex={0}
                aria-pressed={frame === i}
                aria-label={`Frame ${i + 1} of ${SPRITE_FRAMES}`}
                onClick={() => setFrame(i)}
                onKeyDown={activate(() => setFrame(i))}
              >
                <SpriteFigure variant={sheet} name={name} frame={i} />
              </div>
            ))}
          </div>
        )}

        <div className="viewer-controls" onClick={keepOpen}>
          <button
            type="button"
            className="viewer-step"
            aria-label="Previous frame"
            onClick={() => step(-1)}
          >
            <span aria-hidden="true">◀</span>
          </button>

          <span className="viewer-count" aria-hidden="true">
            {playing ? "—" : `${(frame ?? 0) + 1} / ${SPRITE_FRAMES}`}
          </span>

          <button
            type="button"
            className="viewer-step"
            aria-label="Next frame"
            onClick={() => step(1)}
          >
            <span aria-hidden="true">▶</span>
          </button>
        </div>

        {/* The label, under the exhibit. It sat above the port first and read
            as a page heading floating over a picture; down here the figure
            opens the screen and the words settle what you just watched. */}
        <div className="viewer-caption">
          <h2 className="viewer-title" id={titleId}>
            {name}
          </h2>
          {summary && <p className="viewer-summary">{openingLine(summary)}</p>}
        </div>
      </ViewerShell>
    </div>
  );
}

export default TechniqueViewer;
