import { useMemo, useState } from "react";

import { SPRITED_ENTRIES } from "../data/techniqueIndex";
import { SPRITE_GROUPS, spritesFor } from "../data/techniqueSprites";
import type { LearnEntry } from "../data/techniqueLibrary";
import { SpriteFigure } from "./TechniqueSprite";
import "./TechniqueGallery.css";

interface TechniqueGalleryProps {
  /** Opening a figure opens its lesson — Pro-gated the same way the list is. */
  onOpenLesson: (entry: LearnEntry) => void;
}

/**
 * The shelf of figures at the top of Learn.
 *
 * Every technique with a silhouette, which is exactly the set the guided path
 * teaches — twenty-five for twenty-five, no more and no less. That is why this
 * can lead the page while the library below it stays text: the gallery is a
 * complete thing in its own right, so it has no holes to explain, where a
 * figure beside every one of the sixty-three lessons would be blank more often
 * than not.
 *
 * One sheet per tile even for the lessons that carry two. A tile is an index
 * entry, not the lesson: it says "this exists and this is roughly its shape",
 * and the pair is waiting inside for anyone who taps it.
 */
export function TechniqueGallery({ onOpenLesson }: TechniqueGalleryProps) {
  const [group, setGroup] = useState<string>("all");

  const shown = useMemo(() => {
    if (group === "all") return SPRITED_ENTRIES;
    const match = SPRITE_GROUPS.find((g) => g.key === group);
    if (!match) return SPRITED_ENTRIES;
    return SPRITED_ENTRIES.filter((e) => match.categories.includes(e.category));
  }, [group]);

  const filters = useMemo(
    () => [
      { key: "all", label: "All", count: SPRITED_ENTRIES.length },
      ...SPRITE_GROUPS.map((g) => ({
        key: g.key,
        label: g.label,
        count: SPRITED_ENTRIES.filter((e) => g.categories.includes(e.category))
          .length,
      })),
    ],
    []
  );

  if (SPRITED_ENTRIES.length === 0) return null;

  return (
    <section className="technique-gallery">
      <h2 className="learn-section-heading">Every technique Start Here teaches</h2>
      <p className="learn-subtitle">
        {SPRITED_ENTRIES.length} techniques, shot on the court. Tap any one to
        read the lesson.
      </p>

      <div className="gallery-filters" role="group" aria-label="Filter figures">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`gallery-filter${group === f.key ? " is-on" : ""}`}
            aria-pressed={group === f.key}
            onClick={() => setGroup(f.key)}
          >
            {f.label}
            <span className="gallery-filter-count">{f.count}</span>
          </button>
        ))}
      </div>

      <div className="gallery-grid">
        {shown.map((entry) => (
          <button
            key={entry.slug}
            type="button"
            className="gallery-tile"
            onClick={() => onOpenLesson(entry)}
          >
            <SpriteFigure
              variant={spritesFor(entry.slug)[0]!}
              name={entry.name}
            />
            <span className="gallery-tile-name">{entry.name}</span>
            {entry.numbering && (
              <span className="gallery-tile-number">{entry.numbering}</span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

export default TechniqueGallery;
