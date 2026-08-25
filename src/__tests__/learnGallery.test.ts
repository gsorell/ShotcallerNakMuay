import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ALL_TILES,
  FIGURE_COUNT,
  GALLERY_SECTIONS,
} from "@/features/learn/data/galleryTiles";
import {
  CATEGORY_META,
  TECHNIQUE_LIBRARY,
} from "@/features/learn/data/techniqueLibrary";
import { spritesFor } from "@/features/learn/data/techniqueSprites";

const onDisk = (src: string) =>
  existsSync(resolve(process.cwd(), "public", src.replace(/^\//, "")));

describe("the shelf covers the library", () => {
  it("gives every lesson at least one tile", () => {
    // The whole point of consolidating: this shelf IS the browse, so a lesson
    // missing from it is a lesson with no way in.
    const covered = new Set(ALL_TILES.map((t) => t.entry.slug));
    for (const entry of TECHNIQUE_LIBRARY) {
      expect(covered.has(entry.slug), `${entry.slug} has no tile`).toBe(true);
    }
    expect(covered.size).toBe(TECHNIQUE_LIBRARY.length);
  });

  it("keeps a section for every category, in library order", () => {
    expect(GALLERY_SECTIONS.map((s) => s.meta.key)).toEqual(
      CATEGORY_META.map((m) => m.key)
    );
    const total = GALLERY_SECTIONS.reduce((n, s) => n + s.lessonCount, 0);
    expect(total).toBe(TECHNIQUE_LIBRARY.length);
  });
});

describe("a lesson shot from both sides gets both tiles", () => {
  it("gives one tile per sheet, never one per lesson", () => {
    // The bug this replaced: the shelf showed spritesFor(slug)[0] and nothing
    // else, so "Right Elbow" and "Slip Right" were shot and then invisible.
    for (const entry of TECHNIQUE_LIBRARY) {
      const sheets = spritesFor(entry.slug);
      const tiles = ALL_TILES.filter((t) => t.entry.slug === entry.slug);
      expect(tiles, entry.slug).toHaveLength(Math.max(1, sheets.length));
    }
  });

  it("names the side only where there is another side to confuse it with", () => {
    for (const tile of ALL_TILES) {
      const sheets = spritesFor(tile.entry.slug);
      if (sheets.length > 1) {
        expect(tile.side, `${tile.key} should name its side`).toBeTruthy();
      } else {
        expect(tile.side, `${tile.key} should not name a side`).toBeUndefined();
      }
    }
  });

  it("shows every sheet that exists exactly once", () => {
    const shown = ALL_TILES.flatMap((t) => (t.variant ? [t.variant.src] : []));
    const every = TECHNIQUE_LIBRARY.flatMap((e) =>
      spritesFor(e.slug).map((v) => v.src)
    );
    expect(new Set(shown).size, "a sheet is shown twice").toBe(shown.length);
    expect(shown.sort()).toEqual(every.sort());
    expect(FIGURE_COUNT).toBe(every.length);
  });
});

describe("every tile has something to show", () => {
  it("points at a sheet that is on disk, or falls back to its category", () => {
    for (const tile of ALL_TILES) {
      if (tile.variant) {
        expect(onDisk(tile.variant.src), `${tile.key}: ${tile.variant.src}`).toBe(
          true
        );
        continue;
      }
      // No sheet: the tile carries its category's artwork instead, so the slot
      // is never empty. See the note at the top of galleryTiles.ts.
      const meta = CATEGORY_META.find((m) => m.key === tile.entry.category);
      expect(meta, `${tile.key} has no category meta`).toBeDefined();
      expect(meta!.iconPath, `${tile.key} has no fallback art`).toBeTruthy();
    }
  });

  it("has unique keys", () => {
    const keys = ALL_TILES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
