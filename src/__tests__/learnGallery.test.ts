import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ALL_TILES,
  GALLERY_SECTIONS,
  SHELF_LESSON_COUNT,
} from "@/features/learn/data/galleryTiles";
import {
  CATEGORY_META,
  TECHNIQUE_LIBRARY,
} from "@/features/learn/data/techniqueLibrary";
import { sideLabel, spritesFor } from "@/features/learn/data/techniqueSprites";

const onDisk = (src: string) =>
  existsSync(resolve(process.cwd(), "public", src.replace(/^\//, "")));

describe("the shelf is exactly what has been shot", () => {
  it("carries every lesson that has a sheet", () => {
    const shot = TECHNIQUE_LIBRARY.filter((e) => spritesFor(e.slug).length > 0);
    const on = new Set(ALL_TILES.map((t) => t.entry.slug));
    for (const entry of shot) {
      expect(on.has(entry.slug), `${entry.slug} was shot but is not on the shelf`).toBe(
        true
      );
    }
    expect(on.size).toBe(shot.length);
    expect(SHELF_LESSON_COUNT).toBe(shot.length);
  });

  it("carries nothing that has not been shot", () => {
    // The rule that replaced the placeholder tiles: no sheet, no tile.
    for (const tile of ALL_TILES) {
      expect(
        spritesFor(tile.entry.slug).length,
        `${tile.entry.slug} is on the shelf with no sheet`
      ).toBeGreaterThan(0);
    }
  });

  it("drops a category with nothing shot rather than showing it empty", () => {
    for (const section of GALLERY_SECTIONS) {
      expect(section.tiles.length, `${section.meta.key} is empty`).toBeGreaterThan(0);
    }
    const shown = new Set(GALLERY_SECTIONS.map((s) => s.meta.key));
    for (const meta of CATEGORY_META) {
      const anyShot = TECHNIQUE_LIBRARY.some(
        (e) => e.category === meta.key && spritesFor(e.slug).length > 0
      );
      expect(shown.has(meta.key), `${meta.key}`).toBe(anyShot);
    }
  });

  it("keeps sections in library order", () => {
    const order = CATEGORY_META.map((m) => m.key);
    const shown = GALLERY_SECTIONS.map((s) => s.meta.key);
    expect(shown).toEqual(order.filter((k) => shown.includes(k)));
  });
});

describe("a lesson shot from both sides gets both tiles", () => {
  it("gives one tile per sheet, never one per lesson", () => {
    // The bug this replaced: the shelf showed spritesFor(slug)[0] and nothing
    // else, so "Right Elbow" and "Slip Right" were shot and then invisible.
    for (const entry of TECHNIQUE_LIBRARY) {
      const sheets = spritesFor(entry.slug);
      const tiles = ALL_TILES.filter((t) => t.entry.slug === entry.slug);
      expect(tiles, entry.slug).toHaveLength(sheets.length);
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
    const shown = ALL_TILES.map((t) => t.variant.src);
    const every = TECHNIQUE_LIBRARY.flatMap((e) =>
      spritesFor(e.slug).map((v) => v.src)
    );
    expect(new Set(shown).size, "a sheet is shown twice").toBe(shown.length);
    expect(shown.sort()).toEqual(every.sort());
  });
});

describe("every tile has something to show", () => {
  it("points at a sheet that is on disk", () => {
    for (const tile of ALL_TILES) {
      expect(onDisk(tile.variant.src), `${tile.key}: ${tile.variant.src}`).toBe(true);
    }
  });

  it("has unique keys", () => {
    const keys = ALL_TILES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("southpaw flips the label with the figure", () => {
  it("swaps a direction, because the picture it sits under is flipped", () => {
    expect(sideLabel("Left", true)).toBe("Right");
    expect(sideLabel("Right", true)).toBe("Left");
  });

  it("leaves lead and rear alone, because they are stance-relative", () => {
    // The lead leg is the lead leg whichever way you stand, so a mirrored
    // teep-lead sheet is still the lead teep. Swapping it would make it wrong.
    expect(sideLabel("Lead", true)).toBe("Lead");
    expect(sideLabel("Rear", true)).toBe("Rear");
  });

  it("changes nothing for an orthodox fighter", () => {
    for (const l of ["Left", "Right", "Lead", "Rear"]) {
      expect(sideLabel(l, false)).toBe(l);
    }
    expect(sideLabel(undefined, true)).toBeUndefined();
  });

  it("covers every label the sheets actually use", () => {
    // If a new pair ships with a label this helper has never seen, it would
    // pass through unflipped and silently contradict its own figure.
    const known = new Set(["Lead", "Rear", "Left", "Right"]);
    for (const tile of ALL_TILES) {
      if (!tile.side) continue;
      expect(known.has(tile.side), `unhandled side label "${tile.side}"`).toBe(true);
    }
  });
});
