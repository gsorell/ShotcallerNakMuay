import { useMemo, useState } from "react";

import {
  GALLERY_SECTIONS,
  SHELF_LESSON_COUNT,
  type GalleryTile,
} from "../data/galleryTiles";
import type { LearnEntry, TechniqueCategory } from "../data/techniqueLibrary";
import { SpriteFigure } from "./TechniqueSprite";
import "./TechniqueGallery.css";

interface TechniqueGalleryProps {
  /** Opening a tile opens its lesson — Pro-gated the same way it always was. */
  onOpenLesson: (entry: LearnEntry) => void;
}

type Filter = "all" | TechniqueCategory;

/**
 * The whole of Learn's browse, on one screen.
 *
 * Categories are a filter rather than a step: picking one narrows the shelf in
 * place instead of pushing a second screen, so looking a technique up is one
 * tap and a scroll rather than three taps and a back button.
 *
 * The pause control is here because the figures are the content. Thirty-two
 * of them stepping at once is a lot to read past when you are trying to find
 * one particular thing, and holding them still is the difference between a
 * shelf you can scan and a shelf that keeps moving while you scan it.
 */
export function TechniqueGallery({ onOpenLesson }: TechniqueGalleryProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [paused, setPaused] = useState(false);

  const sections = useMemo(
    () =>
      filter === "all"
        ? GALLERY_SECTIONS
        : GALLERY_SECTIONS.filter((s) => s.meta.key === filter),
    [filter]
  );

  return (
    <section className={`shelf${paused ? " shelf--paused" : ""}`}>
      <div className="shelf-head">
        <div>
          <h2 className="learn-section-heading">Browse every technique</h2>
          <p className="learn-subtitle shelf-lede">
            Every technique we have filmed, from both sides where both sides
            matter. Tap any one for the lesson.
          </p>
        </div>
        <button
          type="button"
          className="shelf-pause"
          aria-pressed={paused}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "▶" : "❚❚"}
          <span className="shelf-pause-label">{paused ? "Play" : "Pause"}</span>
        </button>
      </div>

      <div className="shelf-filters" role="group" aria-label="Filter techniques">
        <button
          type="button"
          className={`shelf-filter${filter === "all" ? " is-on" : ""}`}
          aria-pressed={filter === "all"}
          onClick={() => setFilter("all")}
        >
          All<span className="shelf-filter-count">{SHELF_LESSON_COUNT}</span>
        </button>
        {GALLERY_SECTIONS.map((s) => (
          <button
            key={s.meta.key}
            type="button"
            className={`shelf-filter${filter === s.meta.key ? " is-on" : ""}`}
            aria-pressed={filter === s.meta.key}
            onClick={() => setFilter(s.meta.key)}
          >
            {s.meta.label}
            <span className="shelf-filter-count">{s.lessonCount}</span>
          </button>
        ))}
      </div>

      {sections.map((section) => (
        <div className="shelf-section" key={section.meta.key}>
          <h3 className="shelf-section-title">
            {section.meta.label}
            <span className="shelf-section-count">{section.lessonCount}</span>
          </h3>
          <p className="shelf-section-blurb">{section.meta.blurb}</p>
          <div className="shelf-grid">
            {section.tiles.map((tile) => (
              <Tile key={tile.key} tile={tile} onOpen={onOpenLesson} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function Tile({
  tile,
  onOpen,
}: {
  tile: GalleryTile;
  onOpen: (entry: LearnEntry) => void;
}) {
  const { entry, variant, side } = tile;

  return (
    <button
      type="button"
      className="shelf-tile"
      onClick={() => onOpen(entry)}
      aria-label={side ? `${entry.name}, ${side.toLowerCase()} side` : entry.name}
    >
      <SpriteFigure variant={variant} name={entry.name} />
      <span className="shelf-tile-name">{entry.name}</span>
      <span className="shelf-tile-meta">
        {side && <span className="shelf-tile-side">{side}</span>}
        {entry.numbering && (
          <span className="shelf-tile-number">{entry.numbering}</span>
        )}
      </span>
    </button>
  );
}

export default TechniqueGallery;
