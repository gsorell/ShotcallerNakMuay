// ===========================================================================
// The shelf: the techniques we can show, as something you can look at.
// ---------------------------------------------------------------------------
// Learn used to browse in two steps — pick a category, then read a list of
// names — with the only silhouette in the section buried on the lesson page
// underneath. This is the one surface that replaced both.
//
// Two rules decide what is on it.
//
// A LESSON WITH TWO SHEETS GETS TWO TILES. Six lessons cover a mirrored pair,
// and "Left Elbow" and "Right Elbow" are separate callouts the app says out
// loud. Showing one sheet and calling it the elbow hides half of what was shot
// and half of what gets called.
//
// A LESSON WITH NO SHEET IS NOT HERE AT ALL. The shelf is the figures; a tile
// standing in for a technique nobody has filmed is a placeholder pretending to
// be content, and a grid full of them reads as a half-built page rather than a
// library. The written lessons for those techniques still exist in
// `techniqueLibrary`, and the moment a sheet lands the tile appears with no
// other change. What is still un-shot is tracked in
// docs/TECHNIQUE_SHOT_LIST.md.
// ===========================================================================

import {
  CATEGORY_META,
  TECHNIQUE_LIBRARY,
  type CategoryMeta,
  type LearnEntry,
} from "./techniqueLibrary";
import { spritesFor, type SpriteVariant } from "./techniqueSprites";

export interface GalleryTile {
  /** Unique across the shelf — a lesson with two sheets yields two keys. */
  key: string;
  entry: LearnEntry;
  /** The sheet this tile shows. Every tile has one. */
  variant: SpriteVariant;
  /**
   * Which of the lesson's sheets this is, by position in `spritesFor`.
   *
   * The tile is also an address: opening one opens THAT side's page, so the
   * index has to survive the trip. A page cannot re-derive it from the sheet
   * alone without matching on a file path, which is a fragile way to say
   * "the second one".
   */
  variantIndex: number;
  /** "Lead", "Left" — only when the lesson has more than one sheet to tell apart. */
  side?: string;
}

export interface GallerySection {
  meta: CategoryMeta;
  /**
   * Lessons shown here. Categories with nothing shot never become a section.
   *
   * Not what the filter chips print — see SHELF_TILE_COUNT for why the number
   * a reader is shown counts tiles instead.
   */
  lessonCount: number;
  /** Tiles here, which is larger wherever a lesson was shot from both sides. */
  tiles: GalleryTile[];
}

function tilesFor(entry: LearnEntry): GalleryTile[] {
  const sheets = spritesFor(entry.slug);
  return sheets.map((variant, i) => ({
    key: `${entry.slug}:${i}`,
    entry,
    variant,
    variantIndex: i,
    // A lone sheet needs no side printed on it; there is nothing to tell apart.
    side: sheets.length > 1 ? variant.label : undefined,
  }));
}

/**
 * The shelf, in the library's own order: categories as declared, lessons as
 * declared within them, sheets in the order they were listed.
 *
 * A category with nothing shot is dropped rather than rendered empty, so the
 * filter row can never offer a chip that leads to a blank grid.
 */
export const GALLERY_SECTIONS: GallerySection[] = CATEGORY_META.flatMap(
  (meta) => {
    const entries = TECHNIQUE_LIBRARY.filter(
      (e) => e.category === meta.key && spritesFor(e.slug).length > 0
    );
    if (entries.length === 0) return [];
    return [
      { meta, lessonCount: entries.length, tiles: entries.flatMap(tilesFor) },
    ];
  }
);

/** Every tile on the shelf, flattened. */
export const ALL_TILES: GalleryTile[] = GALLERY_SECTIONS.flatMap((s) => s.tiles);

/** Distinct lessons on the shelf — fewer than the tiles, which count sheets. */
export const SHELF_LESSON_COUNT = GALLERY_SECTIONS.reduce(
  (n, s) => n + s.lessonCount,
  0
);

/**
 * Tiles on the shelf, which is the number the filter chips print.
 *
 * The chips used to count LESSONS while the grid underneath drew tiles, so
 * "Knees 1" sat directly above two knees. Every tile now opens a page of its
 * own, which settles which of the two numbers is the honest one: a chip is a
 * promise about what tapping it puts on screen.
 */
export const SHELF_TILE_COUNT = ALL_TILES.length;
