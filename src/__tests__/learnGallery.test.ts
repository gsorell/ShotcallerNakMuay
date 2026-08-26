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
import {
  displayName,
  sideLabel,
  spritesFor,
} from "@/features/learn/data/techniqueSprites";

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
    // If a new set ships with a label this helper has never seen, it would pass
    // through unflipped and silently contradict its own figure.
    //
    // A bare number is fine unflipped, and deliberately so: the numbers are
    // stance-relative, so 3 is the lead hook whichever way you stand.
    const known = new Set(["Lead", "Rear", "Left", "Right"]);
    for (const tile of ALL_TILES) {
      if (!tile.side) continue;
      if (/^\d+$/.test(tile.side)) {
        expect(sideLabel(tile.side, true), `number ${tile.side} must not flip`).toBe(
          tile.side
        );
        continue;
      }
      expect(known.has(tile.side), `unhandled side label "${tile.side}"`).toBe(true);
    }
  });
});

describe("southpaw flips the name with the figure", () => {
  it("swaps the four names that carry a side", () => {
    expect(displayName("Left Hook", true)).toBe("Right Hook");
    expect(displayName("Right Hook", true)).toBe("Left Hook");
    expect(displayName("Left Uppercut", true)).toBe("Right Uppercut");
    expect(displayName("Right Uppercut", true)).toBe("Left Uppercut");
  });

  it("leaves the numbering to mean what it always meant", () => {
    // 3 is the lead hook whichever way you stand, so a southpaw's tile reads
    // "Right Hook · 3" — the name flips, the number does not.
    const hook = TECHNIQUE_LIBRARY.find((e) => e.slug === "lead-hook")!;
    expect(displayName(hook.name, true)).toBe("Right Hook");
    expect(hook.numbering).toBe("3");
  });

  it("changes nothing for an orthodox fighter", () => {
    for (const entry of TECHNIQUE_LIBRARY) {
      expect(displayName(entry.name, false)).toBe(entry.name);
    }
  });

  it("touches only the names that carry a side, and no others", () => {
    // The hooks and uppercuts, upstairs and down. All of them are named from
    // orthodox and all of them flip: a southpaw's lead hook to the body is
    // their RIGHT hook to the body.
    const moved = TECHNIQUE_LIBRARY.filter(
      (e) => displayName(e.name, true) !== e.name
    ).map((e) => e.slug);
    expect(moved.sort()).toEqual(
      [
        "lead-hook",
        "lead-hook-to-body",
        "lead-uppercut",
        "rear-hook",
        "rear-hook-to-body",
        "rear-uppercut",
      ].sort()
    );
  });

  it("is never let near lesson prose", () => {
    // The copy is written in lead and rear so it needs no flipping, and the
    // stray "right"s in it are English. One lesson says "right before it stops
    // being harmless", which this would turn into "left before it stops".
    const prose = TECHNIQUE_LIBRARY.flatMap((e) => [
      e.summary,
      ...e.keyPoints,
      ...e.mistakes,
    ]);
    const idiom = prose.find((t) => t.includes("right before it stops"));
    expect(idiom, "the canary sentence moved — check this still holds").toBeDefined();
    expect(displayName(idiom!, true)).not.toBe(idiom);
  });
});
