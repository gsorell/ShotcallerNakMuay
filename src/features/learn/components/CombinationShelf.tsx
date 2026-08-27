import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { useSouthpaw } from "@/features/workout/contexts/WorkoutProvider";

import { COMBINATIONS, type Combination } from "../data/combinations";
import type { TechniqueCategory } from "../data/techniqueLibrary";
import { LANDED_FRAME, SPRITE_FRAMES, displayName } from "../data/techniqueSprites";
import { SpriteFigure } from "./TechniqueSprite";
import { ViewerShell, activate, keepOpen } from "./ViewerShell";
import "./CombinationShelf.css";

/**
 * Frames dropped off the end of every beat but the last, when clipping.
 *
 * Each sheet was shot as an isolated rep that returns to guard, so played raw
 * a combination resets between every strike. Dropping the recovery is the
 * closest separately-shot footage gets to a linked combination — see the
 * caveat printed under the board, which says so in the reader's words.
 */
const TAIL = 2;

/** A beat of stillness on the last frame before the loop starts again. */
const REST = 450;

/**
 * Milliseconds per frame. Normal is the sheet's own tempo — 1.15s for six
 * frames, which is what the CSS loop on every other figure in the app runs at.
 */
const SPEEDS = [
  { label: "Slow", ms: 265 },
  { label: "Normal", ms: 192 },
  { label: "Fast", ms: 120 },
] as const;

/** Index into SPEEDS of the sheet's own tempo, which is where playback opens. */
const NORMAL_SPEED = 1;

/** One entry of the flat playlist: which beat, which frame of its sheet. */
interface Tick {
  beat: number;
  frame: number;
}

/**
 * The combination as a run of frames.
 *
 * The single-technique figures animate in CSS — one sheet, `steps(6)`, done.
 * A combination cannot, because it crosses sheets partway through, so it is
 * walked by hand instead. Flattening it to a playlist first means the player
 * itself is a cursor over an array and nothing more; clipping, stepping, and
 * marking the current beat all fall out of one index.
 */
function playlistFor(combo: Combination, clip: boolean): Tick[] {
  return combo.beats.flatMap((_, beat) => {
    const last = beat === combo.beats.length - 1;
    const frames = clip && !last ? SPRITE_FRAMES - TAIL : SPRITE_FRAMES;
    return Array.from({ length: frames }, (_, frame) => ({ beat, frame }));
  });
}

/**
 * Whether the reader has asked the system not to animate.
 *
 * The sprite CSS has its own rule for this, but it can only hold a frame — it
 * cannot stop a timer. The player has to know.
 *
 * Read during the first render rather than in an effect afterwards. The answer
 * decides whether playback starts at all, and a state that arrives one render
 * late means it has already started by the time the answer is no.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * Every sheet in the combination, in the browser's cache before anything moves.
 *
 * The tiles on the shelf load lazily and a beat boundary swaps the image
 * source, so the first pass through an unvisited combination would flash a
 * gap at every handoff. Waiting costs a moment on open and buys a clean first
 * loop, which is the one people judge it by.
 *
 * A sheet that fails to load resolves anyway. One missing figure is a hole in
 * the sequence; a player that never starts is the whole feature gone.
 */
function usePreloaded(combo: Combination): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    setReady(false);

    const sources = [...new Set(combo.beats.map((beat) => beat.variant.src))];
    void Promise.all(
      sources.map(
        (src) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = src;
          })
      )
    ).then(() => {
      if (live) setReady(true);
    });

    return () => {
      live = false;
    };
  }, [combo]);

  return ready;
}

// ------------------------------------------------------------------ board --

/**
 * The combination as a row of stills, one landed frame per beat.
 *
 * This is the whole sequence at a glance, which is what a moving figure can
 * never be: playback shows you one instant and asks you to remember the rest.
 * On the lesson page it is the entire section — static, and tappable. Inside
 * the viewer it is the strip, marking the beat currently on screen and taking
 * you to any other, so it is an index and a scrubber at once. Same markup for
 * both, because it is the same picture doing the same job at two sizes.
 */
function ComboBoard({
  combo,
  southpaw,
  current,
  onPick,
}: {
  combo: Combination;
  southpaw: boolean;
  /** Beat to mark as playing. Omitted on the page, where nothing is playing. */
  current?: number;
  /** Makes the beats tappable. Omitted on the page, where the board is one target. */
  onPick?: (beat: number) => void;
}) {
  return (
    <div className="combo-board">
      {combo.beats.map((beat, i) => {
        // The token as the app would SAY it to this reader. A southpaw hears
        // "Right Teep" for the sheet an orthodox fighter hears "Left Teep"
        // called on, and the figure beside it is mirrored to match. This is a
        // callout, not lesson prose — the one kind of string that mirrors.
        const token = displayName(beat.token, southpaw);
        const marked = current === i;

        const figure = (
          <>
            <span className="combo-beat-window">
              <SpriteFigure
                variant={beat.variant}
                name={token}
                frame={LANDED_FRAME}
              />
            </span>
            <span className="combo-beat-token">{token}</span>
          </>
        );

        return (
          <div className="combo-beat-slot" key={`${beat.slug}:${i}`}>
            {i > 0 && (
              <span className="combo-arrow" aria-hidden="true">
                →
              </span>
            )}
            {onPick ? (
              <div
                className={"combo-beat" + (marked ? " combo-beat--on" : "")}
                role="button"
                tabIndex={0}
                aria-pressed={marked}
                aria-label={`Hold on ${token}, beat ${i + 1} of ${combo.beats.length}`}
                onClick={() => onPick(i)}
                onKeyDown={activate(() => onPick(i))}
              >
                {figure}
              </div>
            ) : (
              <div className="combo-beat">{figure}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------- player --

/**
 * The combination, played.
 *
 * Opens into the same screen a single figure opens into, and for the same
 * reason: a five-beat sequence at the size the lesson page can spare is a
 * smear. The controls here are the ones the artifact this came from earned —
 * a speed, a pause, and the honesty toggle.
 */
function CombinationPlayer({
  combo,
  open,
  onClose,
  openerRef,
  southpaw,
}: {
  combo: Combination;
  open: boolean;
  onClose: () => void;
  openerRef: React.RefObject<HTMLElement | null>;
  southpaw: boolean;
}) {
  const titleId = useId();
  const reduced = usePrefersReducedMotion();
  const ready = usePreloaded(combo);

  const [clip, setClip] = useState(true);
  // The interval itself rather than a position in SPEEDS: the loop wants a
  // number of milliseconds and the buttons can mark themselves by comparing
  // one, so an index would only be a second thing to keep in step.
  const [frameMs, setFrameMs] = useState<number>(SPEEDS[NORMAL_SPEED].ms);
  // Reduced motion decides whether this OPENS playing, and nothing more. It is
  // a request not to be moved at without asking, not a refusal to ever show
  // the combination — so the transport still works, and a reader who presses
  // Play gets exactly what they pressed. Paused, the cursor parks on the first
  // technique landed rather than on frame one, which is a guard stance and
  // says nothing.
  const [playing, setPlaying] = useState(!reduced);
  const [pos, setPos] = useState(() => (reduced ? LANDED_FRAME : 0));

  const playlist = useMemo(() => playlistFor(combo, clip), [combo, clip]);

  // Clipping changes the length of the playlist under the cursor, so the
  // cursor goes back to the top rather than landing somewhere arbitrary in a
  // sequence the reader just asked to see differently. Back to the same place
  // it opened on, which for a reader who is not being animated at is the first
  // technique landed rather than the guard stance before it.
  useEffect(() => setPos(reduced ? LANDED_FRAME : 0), [playlist, reduced]);

  // The loop. One timeout per frame rather than an interval, so the pause on
  // the final frame can be longer than the rest — a combination that runs
  // straight back into itself never reads as having finished.
  useEffect(() => {
    if (!open || !playing || !ready || playlist.length === 0) return;

    const end = pos === playlist.length - 1;
    const timer = setTimeout(
      () => setPos(end ? 0 : pos + 1),
      end ? REST : frameMs
    );
    return () => clearTimeout(timer);
  }, [open, playing, ready, playlist, pos, frameMs]);

  // Stepping pauses, because stepping IS the request to stop. Unlike the
  // single-technique viewer this can hold the exact frame it was on: the
  // frames are driven here rather than by a CSS animation whose position
  // cannot be read back.
  const step = useCallback(
    (delta: number) => {
      setPlaying(false);
      setPos((p) => (p + delta + playlist.length) % playlist.length);
    },
    [playlist.length]
  );

  const pickBeat = useCallback(
    (beat: number) => {
      setPlaying(false);
      const first = playlist.findIndex((tick) => tick.beat === beat);
      if (first < 0) return;
      // The landed frame of that beat, or its last if clipping took it — the
      // pose the sheet was built around, which is what "show me this one"
      // means.
      const frames = playlist.filter((tick) => tick.beat === beat).length;
      setPos(first + Math.min(LANDED_FRAME, frames - 1));
    },
    [playlist]
  );

  const tick: Tick = playlist[pos] ?? { beat: 0, frame: LANDED_FRAME };

  const beat = combo.beats[tick.beat];
  const label = displayName(combo.label, southpaw);
  const token = beat ? displayName(beat.token, southpaw) : label;

  return (
    <ViewerShell
      open={open}
      onClose={onClose}
      onStep={step}
      openerRef={openerRef}
      labelledBy={titleId}
    >
      <div
        className="viewer-figure combo-port"
        role="button"
        tabIndex={0}
        aria-pressed={!playing}
        aria-label={playing ? `Hold ${label} still` : `Play ${label}`}
        onClick={(e) => {
          keepOpen(e);
          setPlaying((p) => !p);
        }}
        onKeyDown={activate(() => setPlaying((p) => !p))}
      >
        {beat && (
          <SpriteFigure variant={beat.variant} name={token} frame={tick.frame} />
        )}
        {/* Which technique is on screen right now. The board underneath says
            it too, but the board is small and this is the thing being
            watched. */}
        <span className="combo-now" aria-hidden="true">
          {token}
        </span>
      </div>

      <div
        className="viewer-strip combo-strip"
        role="group"
        aria-label={`${label} beats`}
        onClick={keepOpen}
      >
        <ComboBoard
          combo={combo}
          southpaw={southpaw}
          current={tick.beat}
          onPick={pickBeat}
        />
      </div>

      <div className="viewer-controls combo-controls" onClick={keepOpen}>
        <button
          type="button"
          className={"combo-btn" + (playing ? "" : " combo-btn--on")}
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? "Pause" : "Play"}
        </button>

        <div
          className="combo-speed"
          role="group"
          aria-label="Playback speed"
        >
          {SPEEDS.map((option) => (
            <button
              key={option.label}
              type="button"
              className={
                "combo-btn" + (frameMs === option.ms ? " combo-btn--on" : "")
              }
              aria-pressed={frameMs === option.ms}
              onClick={() => setFrameMs(option.ms)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="viewer-controls combo-controls" onClick={keepOpen}>
        <button
          type="button"
          className={"combo-btn" + (clip ? " combo-btn--on" : "")}
          aria-pressed={clip}
          onClick={() => setClip((c) => !c)}
        >
          Clip the recovery
        </button>
      </div>

      <div className="viewer-caption">
        <h2 className="viewer-title" id={titleId}>
          {label}
        </h2>
        <p className="viewer-summary">
          Shot as separate reps, so each one returns to guard before the next
          begins. Clipping the recovery drops the last frames of every
          technique but the final one.
        </p>
      </div>
    </ViewerShell>
  );
}

// ------------------------------------------------------------------- rail --

interface CombinationShelfProps {
  /**
   * The shelf's category filter, so this row narrows with the grid under it.
   * "all" shows everything.
   */
  filter: TechniqueCategory | "all";
  /**
   * Asked before anything opens. Returns false when the reader cannot have it
   * — the paywall goes up instead, exactly as it does on a tile.
   */
  onRequestOpen: (label: string) => boolean;
}

/** Where the third row starts, and how tall the first two actually are. */
interface Clip {
  /** Index of the first chip past the fold. */
  from: number;
  /** Pixels, measured — the exact bottom of the second row. */
  height: number;
}

/**
 * Where two rows of chips end, or null while they all fit in two.
 *
 * Two rows is a fact about layout, not a number of chips: these run from "1 2"
 * to "High Guard Block, 2, Low Kick", so any count that fills two rows on one
 * phone spills onto four on a narrower one. And now that the chips are the
 * shelf's own pills, their height comes from padding and line box rather than
 * from a number this file chose, so the clamp cannot be arithmetic either.
 * Both answers are read back off the laid-out DOM instead.
 *
 * Chips share an `offsetTop` with the rest of their row, so the distinct tops
 * ARE the rows: the third one is where clipping begins, and the bottom of a
 * second-row chip is where the container should end. `offsetTop` is relative
 * to the nearest positioned ancestor, which the container makes itself so that
 * the number is measured from where the clamp is applied.
 *
 * Clipping does not disturb any of this — `overflow: hidden` paints less, it
 * does not lay out differently — so the chips below the fold report true
 * positions from behind it. They do come out of the tab order while they are
 * down there: a control you cannot see and can still focus is worse than one
 * that is merely hidden.
 *
 * Measured only while collapsed. Expanded, the container grows to fit and the
 * cut would read as "no overflow", which would take away the Less button on
 * the row that needs it.
 */
function useClip(
  ref: React.RefObject<HTMLDivElement | null>,
  expanded: boolean,
  filter: string
): Clip | null {
  const [clip, setClip] = useState<Clip | null>(null);

  useEffect(() => {
    if (expanded) return;

    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const chips = [...el.children] as HTMLElement[];
      const tops = chips.map((chip) => chip.offsetTop);
      const rows = [...new Set(tops)].sort((a, b) => a - b);
      const second = rows[1];
      const third = rows[2];

      if (second === undefined || third === undefined) {
        setClip(null);
        return;
      }

      const onSecondRow = chips.find((chip) => chip.offsetTop === second);
      setClip({
        from: tops.findIndex((top) => top >= third),
        height: second + (onSecondRow?.offsetHeight ?? 0),
      });
    };

    measure();

    // A webfont arriving changes how wide every chip is, and so changes which
    // ones fall on which row — while the container it wraps inside stays
    // exactly as wide and as tall as it was. Nothing else here would notice.
    document.fonts?.ready.then(measure).catch(() => {});

    // Rotating the phone rewraps the row, and so does the app's own layout
    // settling after the figures below it load.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, expanded, filter]);

  return clip;
}

/**
 * The combinations, as chips on the shelf.
 *
 * The shelf browses techniques one at a time, which is the right unit for
 * looking something up and the wrong one for the question most people arrive
 * with. A combination is the app's other vocabulary — the thing it actually
 * calls out — and it belongs on the browse screen rather than buried at the
 * bottom of whichever lesson happens to contain it.
 *
 * Chips rather than figures. A combination is a phrase before it is a picture:
 * "1 2, Low Kick" is read in a moment where four silhouettes have to be
 * compared, and the pictures are what opening one is for.
 *
 * They sit under the category filter and answer to it. That was the argument
 * against putting them here — a row of chips beneath a row of chips, where the
 * top row narrows the grid and the bottom row would not — so the bottom row
 * narrows too, and the two read as one control over one shelf.
 *
 * Two rows of them, then More. Forty-eight chips pushes the grid — the thing
 * this screen is for — most of a phone height down the page, and a browse
 * surface you have to scroll past something else to reach is a worse shelf
 * than it was before.
 */
export function CombinationShelf({
  filter,
  onRequestOpen,
}: CombinationShelfProps) {
  const southpaw = useSouthpaw();
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState<Combination | null>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  // Set by the toggle, read by the effect below. Only a deliberate collapse
  // scrolls — see there.
  const snapBack = useRef(false);

  const combos = useMemo(
    () =>
      filter === "all"
        ? COMBINATIONS
        : COMBINATIONS.filter((combo) => combo.categories.has(filter)),
    [filter]
  );

  // Narrowing the shelf is a fresh look at it, so a row left expanded under
  // one filter does not arrive already open under the next.
  useEffect(() => setExpanded(false), [filter]);

  const clip = useClip(chipsRef, expanded, filter);

  /**
   * Collapsing takes about thirty rows out of the page under the reader.
   *
   * Whatever they were looking at goes with it: the scroll position does not
   * move, so the same offset that was the middle of the chip row is now
   * somewhere down in the technique grid, and the button they just pressed is
   * far above them. So the section comes back to the top of the screen, with
   * the row and the control that closed it.
   *
   * Only when the reader closed it. The filter also collapses this row, and
   * that happens from a chip at the top of the shelf — scrolling then would
   * carry them away from the control they just used, which is the same
   * complaint in the other direction.
   */
  useEffect(() => {
    if (expanded || !snapBack.current) return;
    snapBack.current = false;
    sectionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [expanded]);

  // Read rather than mutated inside the updater: StrictMode runs updaters
  // twice, and they have to stay pure.
  const toggle = () => {
    if (expanded) snapBack.current = true;
    setExpanded(!expanded);
  };

  if (combos.length === 0) return null;

  const open = (combo: Combination, el: HTMLButtonElement | null) => {
    if (!onRequestOpen(combo.label)) return;
    openerRef.current = el;
    setPlaying(combo);
  };

  const clipped = (i: number) => !expanded && !!clip && i >= clip.from;

  return (
    <div className="shelf-combos" ref={sectionRef}>
      <h3 className="shelf-combos-head">
        Combinations
        <span className="shelf-section-count">{combos.length}</span>
      </h3>
      <p className="shelf-combos-blurb">
        The same techniques strung together, the way the path drills them.
      </p>

      {/* Every chip is rendered whatever the state; collapsing is the CSS
          clamping the height. Slicing the list instead would need a count that
          means two rows, and there is no such count — see useClippedFrom. */}
      <div
        ref={chipsRef}
        className={`shelf-combo-chips${expanded ? " is-open" : ""}`}
        // The measured height wins over the stylesheet's estimate, which is
        // only there to keep the first paint from flashing the whole list.
        style={expanded || !clip ? undefined : { maxHeight: clip.height }}
        role="group"
        aria-label="Combinations"
      >
        {combos.map((combo, i) => (
          <button
            key={combo.key}
            type="button"
            className="shelf-combo"
            tabIndex={clipped(i) ? -1 : undefined}
            aria-hidden={clipped(i) || undefined}
            onClick={(e) => open(combo, e.currentTarget)}
          >
            {/* Where it is taught, which is also roughly how hard it is. The
                bonus level has no number worth printing. */}
            <span className="shelf-combo-level" aria-hidden="true">
              {combo.bonus ? "B" : `L${combo.levelId}`}
            </span>
            {displayName(combo.label, southpaw)}
          </button>
        ))}
      </div>

      {/* Only once there is something to open. A More under two rows that are
          the whole list is a control that does nothing. */}
      {(clip !== null || expanded) && (
        <div className="shelf-combos-more-row">
          <button
            type="button"
            className="shelf-combos-more"
            aria-expanded={expanded}
            onClick={toggle}
          >
            {expanded ? "Less" : "More"}
            <span
              className={`shelf-combos-caret${expanded ? " is-open" : ""}`}
              aria-hidden="true"
            >
              ▼
            </span>
          </button>
        </div>
      )}

      {/* Mounted only while something is playing, so a shelf of forty-eight
          chips is not forty-eight players waiting. That costs the shell's own
          focus return, which fires on close rather than on unmount — so the
          chip gets focus back from here instead. */}
      {playing && (
        <CombinationPlayer
          combo={playing}
          open
          onClose={() => {
            setPlaying(null);
            openerRef.current?.focus();
          }}
          openerRef={openerRef}
          southpaw={southpaw}
        />
      )}
    </div>
  );
}

export default CombinationShelf;
