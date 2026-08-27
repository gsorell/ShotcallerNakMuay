import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { LANDED_FRAME, SPRITE_FRAMES, spritesFor } from "../data/techniqueSprites";
import { SpriteFigure, TechniqueSprite } from "./TechniqueSprite";
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

/** A swipe in any direction past this many pixels closes the viewer. */
const SWIPE_CLOSE_PX = 60;

/**
 * Enter and Space on something carrying `role="button"`.
 *
 * Both tap targets here wrap the sprite, and the sprite renders a `<figure>` —
 * flow content, which a real `<button>` may not contain. So they are divs with
 * the button role, and a div does not fire click on a keypress the way a
 * button does. This puts that back.
 */
function activate(fn: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
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
 * Nothing inside the viewing mode closes it; everything around it does. Tap
 * off the figure, swipe, or press Escape. A dismiss button would be one more
 * thing on a screen whose whole job is to hold one large picture.
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
  const overlayRef = useRef<HTMLDivElement>(null);
  // Distinguishes "closed because the reader closed it" from "closed because
  // the page just rendered". Without it the close effect fires on mount and
  // pulls focus to the figure on every lesson you open.
  const wasOpen = useRef(false);

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

  useEffect(() => {
    if (open) overlayRef.current?.focus();
    else if (wasOpen.current) openerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  // On the document, in the capture phase, and stopped dead there.
  //
  // The app's back gesture listens for Escape on the document too, so the
  // obvious version of this — a React onKeyDown on the overlay — closed the
  // viewer and then walked the reader back out of the lesson on the same
  // press. Capture runs before that listener; stopping the event means the
  // viewer gets the key and the page never hears it.
  //
  // The arrows ride along rather than living on the overlay, so stepping works
  // wherever focus happens to be inside it. They only preventDefault, since
  // nothing else wants them while this is open.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      }
      // Enter and Space are left alone: whatever is focused handles its own,
      // and handling them here as well would fire twice.
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, close, step]);

  // Swipe to dismiss, in any direction — captured and swallowed for the same
  // reason the keys are. The app's back gesture watches document touches, so a
  // swipe that began near the left edge would close the viewer and navigate
  // out of the lesson together.
  //
  // Direction is deliberately not checked. The back gesture is a left-to-right
  // swipe from the edge, but this is one picture filling the screen, and being
  // made to flick it a particular way to put it down is a rule with nothing
  // behind it.
  useEffect(() => {
    if (!open) return;

    let startX: number | null = null;
    let startY: number | null = null;

    const onStart = (e: TouchEvent) => {
      e.stopPropagation();
      const touch = e.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
    };

    const onMove = (e: TouchEvent) => e.stopPropagation();

    const onEnd = (e: TouchEvent) => {
      e.stopPropagation();
      const touch = e.changedTouches[0];
      if (!touch || startX === null || startY === null) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      startX = null;
      startY = null;
      if (Math.hypot(dx, dy) > SWIPE_CLOSE_PX) close();
    };

    const opts = { capture: true, passive: true } as const;
    document.addEventListener("touchstart", onStart, opts);
    document.addEventListener("touchmove", onMove, opts);
    document.addEventListener("touchend", onEnd, opts);
    return () => {
      document.removeEventListener("touchstart", onStart, true);
      document.removeEventListener("touchmove", onMove, true);
      document.removeEventListener("touchend", onEnd, true);
    };
  }, [open, close]);

  const sheets = spritesFor(slug);
  if (sheets.length === 0) return null;

  const playing = frame === null;

  // The one sheet this page is showing, which the filmstrip needs by hand —
  // TechniqueSprite does the picking internally and hands back nothing. An
  // out-of-range index means no such sheet rather than "clamp to the first",
  // the same rule TechniqueSprite follows, so the strip simply does not draw.
  const sheet = variantIndex === null ? sheets[0] : sheets[variantIndex];

  // Only the figure and the transport keep their clicks. Everything else in
  // here — the margins, the hint, the whole backdrop — closes, which is what
  // makes a dismiss button unnecessary.
  const keepOpen = (e: React.MouseEvent) => e.stopPropagation();

  const overlay = (
    <div
      ref={overlayRef}
      className="viewer-overlay"
      role="dialog"
      aria-modal="true"
      // Named by the visible heading rather than by a second copy of the name.
      aria-labelledby={titleId}
      tabIndex={-1}
      onClick={close}
    >
      <div className="viewer-stage">

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
      </div>
    </div>
  );

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

      {open && typeof document !== "undefined"
        ? createPortal(overlay, document.body)
        : null}
    </div>
  );
}

export default TechniqueViewer;
