import { useState } from "react";

import { SPRITE_FRAMES, spriteFor } from "../data/techniqueSprites";
import "./TechniqueSprite.css";

interface TechniqueSpriteProps {
  /** Lesson slug. A lesson with no sheet renders nothing at all. */
  slug: string;
  /** Technique name, used for the accessible label. */
  name: string;
  className?: string;
}

/**
 * The looping silhouette beside a lesson's copy.
 *
 * The sheet is one wide image of `SPRITE_FRAMES` square cells, stepped through
 * by translating the image inside a fixed window. Translating by a PERCENTAGE
 * of the image rather than a pixel offset is what makes this work at any size:
 * -100% is the sheet's own width, so `steps(6)` advances exactly one cell per
 * tick whether the window is 150px or 132px. The obvious alternative —
 * animating `background-position` — cannot do this, because a percentage there
 * resolves against (container - image) rather than the image, and inverts.
 */
export function TechniqueSprite({ slug, name, className }: TechniqueSpriteProps) {
  const src = spriteFor(slug);
  const [failed, setFailed] = useState(false);

  // No sheet for this lesson yet, or the file did not load: show nothing rather
  // than an empty slot, so the copy simply takes the full width.
  if (!src || failed) return null;

  return (
    <div
      className={`technique-sprite${className ? ` ${className}` : ""}`}
      role="img"
      aria-label={`Animated silhouette of ${name}`}
    >
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={{ width: `${SPRITE_FRAMES * 100}%` }}
      />
    </div>
  );
}

export default TechniqueSprite;
