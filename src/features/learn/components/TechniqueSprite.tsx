import { useState } from "react";

// The module rather than the workout barrel: the barrel reaches back into this
// feature, and a figure only needs to know which way round the user stands.
import { useSouthpaw } from "@/features/workout/contexts/WorkoutProvider";

import {
  SPRITE_FRAMES,
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
export function TechniqueSprite({ slug, name, className }: TechniqueSpriteProps) {
  const variants = spritesFor(slug);
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
  onBroken,
  className,
}: SpriteFigureProps) {
  // Every sheet was shot orthodox. A southpaw is looking at a picture of
  // someone standing the other way round, which is exactly the thing the
  // figure exists to show them, so flip it — and flip the label with it.
  const southpaw = useSouthpaw();
  const label = sideLabel(variant.label, southpaw);

  return (
    <figure className={`technique-sprite-figure${className ? ` ${className}` : ""}`}>
      <div
        className={`technique-sprite${southpaw ? " technique-sprite--mirrored" : ""}`}
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
          style={{ width: `${SPRITE_FRAMES * 100}%` }}
        />
      </div>
      {showLabel && label && (
        <figcaption className="technique-sprite-label">{label}</figcaption>
      )}
    </figure>
  );
}

export default TechniqueSprite;
