import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * The screen a figure opens into: a scrim, one thing on it, and every way out.
 *
 * Lifted out of `TechniqueViewer` when the combination player wanted the same
 * screen. None of what is in here is obvious — the key handling and the touch
 * handling both exist to fight the app's own back gesture, and getting either
 * subtly wrong walks the reader out of the lesson on a press meant for the
 * viewer. Two copies of that would be two chances to get it wrong.
 *
 * What it does NOT own is the thing being shown, or the control that opened
 * it. Those differ: one viewer opens a framed silhouette and shows six frames
 * of one sheet, the other opens a board of beats and plays across sheets.
 */
interface ViewerShellProps {
  open: boolean;
  onClose: () => void;
  /**
   * Left and right arrows, while open. Whatever "step" means to the caller —
   * a frame in one viewer, a beat in the other.
   */
  onStep?: (delta: number) => void;
  /** The element focus returns to on close — the control that opened this. */
  openerRef: RefObject<HTMLElement | null>;
  /** Id of the visible heading that names this screen. */
  labelledBy: string;
  children: ReactNode;
}

/**
 * Enter and Space on something carrying `role="button"`.
 *
 * The tap targets in both viewers wrap a sprite, and the sprite renders a
 * `<figure>` — flow content, which a real `<button>` may not contain. So they
 * are divs with the button role, and a div does not fire click on a keypress
 * the way a button does. This puts that back.
 */
export function activate(fn: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
}

/** A swipe in any direction past this many pixels closes the viewer. */
const SWIPE_CLOSE_PX = 60;

export function ViewerShell({
  open,
  onClose,
  onStep,
  openerRef,
  labelledBy,
  children,
}: ViewerShellProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  // Distinguishes "closed because the reader closed it" from "closed because
  // the page just rendered". Without it the close effect fires on mount and
  // pulls focus to the opener on every lesson you open.
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) overlayRef.current?.focus();
    else if (wasOpen.current) openerRef.current?.focus();
    wasOpen.current = open;
  }, [open, openerRef]);

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
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onStep?.(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onStep?.(-1);
      }
      // Enter and Space are left alone: whatever is focused handles its own,
      // and handling them here as well would fire twice.
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose, onStep]);

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
      if (Math.hypot(dx, dy) > SWIPE_CLOSE_PX) onClose();
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
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="viewer-overlay"
      role="dialog"
      aria-modal="true"
      // Named by the visible heading rather than by a second copy of the name.
      aria-labelledby={labelledBy}
      tabIndex={-1}
      onClick={onClose}
    >
      {/* The way out, said out loud.

          This screen started with no ✕ at all, on the argument that an overlay
          holding one large picture tells you how to leave by having nothing
          else on it — tap anywhere off the figure. That argument is fine right
          up until someone looks for the button and does not find one, which is
          not a thing you get to talk them out of. Every way out still works;
          this is the one that does not have to be guessed at. */}
      <button
        type="button"
        className="viewer-close"
        aria-label="Close"
        onClick={(e) => {
          // The backdrop closes too, so this is belt and braces — but a click
          // that ran both handlers would be two closes on one press.
          e.stopPropagation();
          onClose();
        }}
      >
        <span aria-hidden="true">✕</span>
      </button>
      <div className="viewer-stage">{children}</div>
    </div>,
    document.body
  );
}

/**
 * Stops a click inside the stage from reaching the backdrop.
 *
 * Only the exhibit and its controls keep their clicks. Everything else in the
 * overlay — the margins, the caption, the whole backdrop — closes. The ✕ is
 * the same exit for anyone who would rather press a button than discover that.
 */
export const keepOpen = (e: React.MouseEvent) => e.stopPropagation();

export default ViewerShell;
