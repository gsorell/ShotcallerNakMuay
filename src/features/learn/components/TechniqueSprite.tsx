import { useState } from "react";

import { SPRITE_FRAMES, spritesFor } from "../data/techniqueSprites";
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
        <figure className="technique-sprite-figure" key={variant.src}>
          <div
            className="technique-sprite"
            role="img"
            aria-label={
              variant.label
                ? `Animated silhouette of ${name}, ${variant.label.toLowerCase()} side`
                : `Animated silhouette of ${name}`
            }
          >
            <img
              src={variant.src}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              onError={() => setBroken((b) => [...b, variant.src])}
              style={{ width: `${SPRITE_FRAMES * 100}%` }}
            />
          </div>
          {/* Only worth naming when there is another one to tell it apart from. */}
          {variant.label && usable.length > 1 && (
            <figcaption className="technique-sprite-label">
              {variant.label}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

export default TechniqueSprite;
