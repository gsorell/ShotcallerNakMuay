// ===========================================================================
// The shelf: every lesson the app teaches, as something you can look at.
// ---------------------------------------------------------------------------
// Learn used to browse in two steps — pick a category, then read a list of
// names — with the only silhouette in the section buried on the lesson page
// underneath. This is the one surface that replaced both.
//
// Two rules make it work with the sheets we actually have.
//
// A LESSON WITH TWO SHEETS GETS TWO TILES. Six lessons cover a mirrored pair,
// and "Left Elbow" and "Right Elbow" are separate callouts the app says out
// loud. Showing one sheet and calling it the elbow hides half of what was shot
// and half of what gets called.
//
// A LESSON WITH NO SHEET STILL GETS A TILE, carrying its category's artwork.
// Thirty-eight lessons have not been filmed — all thirteen feints among them —
// and a grid where those slots were empty would read as broken. A tile that was
// never figure-shaped reads as a tile. This is the same two-tier arrangement
// the roadmap ladder uses: bespoke art leads, category art is the floor.
// ===========================================================================

import {
  CATEGORY_META,
  TECHNIQUE_LIBRARY,
  type CategoryMeta,
  type LearnEntry,
  type TechniqueCategory,
} from "./techniqueLibrary";
import { spritesFor, type SpriteVariant } from "./techniqueSprites";

export interface GalleryTile {
  /** Unique across the shelf — a lesson with two sheets yields two keys. */
  key: string;
  entry: LearnEntry;
  /** The sheet this tile shows. Absent when the lesson has not been shot. */
  variant?: SpriteVariant;
  /** "Lead", "Left" — only when the lesson has more than one sheet to tell apart. */
  side?: string;
}

export interface GallerySection {
  meta: CategoryMeta;
  /** Lessons here — the count the library has always shown for this category. */
  lessonCount: number;
  /** Tiles here, which is larger wherever a lesson was shot from both sides. */
  tiles: GalleryTile[];
}

function tilesFor(entry: LearnEntry): GalleryTile[] {
  const sheets = spritesFor(entry.slug);
  if (sheets.length === 0) return [{ key: entry.slug, entry }];

  return sheets.map((variant, i) => ({
    key: `${entry.slug}:${i}`,
    entry,
    variant,
    // A lone sheet needs no side printed on it; there is nothing to tell apart.
    side: sheets.length > 1 ? variant.label : undefined,
  }));
}

/**
 * The shelf, in the library's own order: categories as declared, lessons as
 * declared within them, sheets in the order they were listed.
 */
export const GALLERY_SECTIONS: GallerySection[] = CATEGORY_META.map((meta) => {
  const entries = TECHNIQUE_LIBRARY.filter((e) => e.category === meta.key);
  return {
    meta,
    lessonCount: entries.length,
    tiles: entries.flatMap(tilesFor),
  };
});

/** Every tile on the shelf, flattened. */
export const ALL_TILES: GalleryTile[] = GALLERY_SECTIONS.flatMap((s) => s.tiles);

/** How many tiles actually carry a figure. */
export const FIGURE_COUNT = ALL_TILES.filter((t) => t.variant).length;
