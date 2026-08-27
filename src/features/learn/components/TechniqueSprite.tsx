import { useState } from "react";

// The module rather than the workout barrel: the barrel reaches back into this
// feature, and a figure only needs to know which way round the user stands.
import { useSouthpaw } from "@/features/workout/contexts/WorkoutProvider";

import {
  SPRITE_FRAMES,
  inkOffset,
  sideLabel,
  spritesFor,
  type SpriteVariant,
} from "../data/techniqueSprites";
import "./TechniqueSprite.css";

interface TechniqueSpriteProps {
  /** Lesson slug. A lesson with no sheet renders nothing at all. */
  slug: string;
  /** Technique name, used for the accessible label. */
  name: string;
  /** Hold one frame across every sheet this lesson shows. */
  frame?: number | null;
  /**
   * Show only this sheet, by position in `spritesFor`.
   *
   * A lesson page is now one side per page, so it names the side it wants and
   * gets a single full-size figure. Omitted, every sheet the lesson has is
   * shown side by side — which is what the roadmap card still wants, because
   * there a level teaches both halves at once.
   */
  variantIndex?: number | null;
  className?: string;
}

/**
 * The looping silhouette beside a lesson's copy — one per side where a lesson
 * shows both.
 *
 * The sheet is one wide image of `SPRITE_FRAMES` square cells, stepped through
 * by translating the image inside a fixed window. Translating by a PERCENTAGE
 * of the image rather than a pixel offset is what makes this work at any size:
 * -100% is the sheet's own width, so `steps(6)` advances exactly one cell per
 * tick whether the window is 150px or 116px. The obvious alternative —
 * animating `background-position` — cannot do this, because a percentage there
 * resolves against (container - image) rather than the image, and inverts.
 */
export function TechniqueSprite({
  slug,
  name,
  frame = null,
  variantIndex = null,
  className,
}: TechniqueSpriteProps) {
  const sheets = spritesFor(slug);
  // An out-of-range index is treated as "no such sheet" rather than clamped: a
  // page asking for the rear teep should not quietly draw the lead one.
  const variants =
    variantIndex === null ? sheets : sheets.slice(variantIndex, variantIndex + 1);
  const [broken, setBroken] = useState<string[]>([]);

  const usable = variants.filter((v) => !broken.includes(v.src));

  // No sheet for this lesson yet, or none of them loaded: show nothing rather
  // than an empty slot, so the copy simply takes the full width.
  if (usable.length === 0) return null;

  return (
    <div
      className={
        `technique-sprites technique-sprites--${usable.length}` +
        (className ? ` ${className}` : "")
      }
    >
      {usable.map((variant) => (
        <SpriteFigure
          key={variant.src}
          variant={variant}
          name={name}
          frame={frame}
          // Only worth naming when there is another one to tell it apart from.
          showLabel={usable.length > 1}
          onBroken={() => setBroken((b) => [...b, variant.src])}
        />
      ))}
    </div>
  );
}

interface SpriteFigureProps {
  variant: SpriteVariant;
  /** Technique name, used for the accessible label. */
  name: string;
  /** Whether to print the variant's side under the figure. */
  showLabel?: boolean;
  /**
   * Hold one frame instead of running the loop. Zero-based; null or omitted
   * plays.
   *
   * Two callers want this for different reasons. A host where the figure
   * illustrates a destination rather than demonstrating a technique holds
   * LANDED_FRAME, because one still pose reads as a picture where a lone
   * looping figure reads as a thing demanding to be watched. And the lesson
   * viewer holds whichever frame the reader is stepping through.
   */
  frame?: number | null;
  /** Called when the sheet fails to load, so the host can drop this figure. */
  onBroken?: () => void;
  className?: string;
}

/**
 * One figure: a single sheet, stepped.
 *
 * Split out from `TechniqueSprite` because a host sometimes knows which of a
 * paired lesson's two sheets it wants. The combination decoder does — "Left
 * Teep" is one beat of a combination and gets one figure, not the pair — while
 * a lesson card shows every sheet it has and lets `TechniqueSprite` do the
 * picking. Both render the same markup, so the CSS only exists once.
 */
export function SpriteFigure({
  variant,
  name,
  showLabel = false,
  frame = null,
  onBroken,
  className,
}: SpriteFigureProps) {
  // Every sheet was shot orthodox. A southpaw is looking at a picture of
  // someone standing the other way round, which is exactly the thing the
  // figure exists to show them, so flip it — and flip the label with it.
  const southpaw = useSouthpaw();
  const label = sideLabel(variant.label, southpaw);

  // A handful of sheets were framed with the figure off to one side, so the
  // window is slid to put the figure back in the middle of whatever holds it.
  //
  // On the WINDOW, and composed with the mirror rather than fighting it. The
  // image already carries the frame-stepping transform, so a second one there
  // would collide — the same reason mirroring lives out here. Order matters
  // and is doing real work: under `scaleX(-1)` the slide flips too, which is
  // exactly right, because a figure sitting left of centre sits right of
  // centre once you mirror it.
  const offset = inkOffset(variant.src);
  const transform =
    `${southpaw ? "scaleX(-1) " : ""}${offset ? `translateX(${offset}%)` : ""}`.trim();

  return (
    <figure className={`technique-sprite-figure${className ? ` ${className}` : ""}`}>
      <div
        className={
          "technique-sprite" + (southpaw ? " technique-sprite--mirrored" : "")
        }
        style={transform ? { transform } : undefined}
        role="img"
        aria-label={
          label
            ? `Animated silhouette of ${name}, ${label.toLowerCase()} side`
            : `Animated silhouette of ${name}`
        }
      >
        <img
          src={variant.src}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          onError={onBroken}
          style={{
            width: `${SPRITE_FRAMES * 100}%`,
            // Inline so it beats both the running animation and the
            // reduced-motion rule, which holds a frame of its own.
            ...(frame === null
              ? null
              : {
                  animation: "none",
                  transform: `translateX(-${(frame * 100) / SPRITE_FRAMES}%)`,
                }),
          }}
        />
      </div>
      {showLabel && label && (
        <figcaption className="technique-sprite-label">{label}</figcaption>
      )}
    </figure>
  );
}

export default TechniqueSprite;
