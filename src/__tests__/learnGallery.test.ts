import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ALL_TILES,
  GALLERY_SECTIONS,
  SHELF_LESSON_COUNT,
  SHELF_TILE_COUNT,
} from "@/features/learn/data/galleryTiles";
import {
  CATEGORY_META,
  TECHNIQUE_LIBRARY,
  lessonCard,
  type SideLesson,
} from "@/features/learn/data/techniqueLibrary";
import {
  displayName,
  sideLabel,
  spritesFor,
} from "@/features/learn/data/techniqueSprites";

/** Everything a card says, minus its heading. */
const prose = (card: SideLesson) =>
  [card.summary, ...card.keyPoints, ...card.mistakes];

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
    // The hooks and uppercuts upstairs, and nothing else. Note what is NOT
    // here: Body Hooks covers both sides in one lesson, so it names no side
    // and has nothing to flip — which is the point of naming it that way.
    const moved = TECHNIQUE_LIBRARY.filter(
      (e) => displayName(e.name, true) !== e.name
    ).map((e) => e.slug);
    expect(moved.sort()).toEqual(
      ["lead-hook", "lead-uppercut", "rear-hook", "rear-uppercut"].sort()
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

describe("a tile and a card, one to one", () => {
  it("carries the index of the sheet it is showing", () => {
    // Opening a tile opens THAT side's card, and the index is how the page is
    // told which side. A tile whose index points at the other sheet would show
    // the lead teep under the heading "Rear Teep".
    for (const tile of ALL_TILES) {
      const sheets = spritesFor(tile.entry.slug);
      expect(sheets[tile.variantIndex]?.src, tile.key).toBe(tile.variant.src);
    }
  });

  it("gives every sheet of a paired lesson a card of its own", () => {
    // The 1:1 rule, and the reason a new pair of sheets cannot ship without
    // copy: two tiles landing on one set of words is the bug this replaced.
    for (const entry of TECHNIQUE_LIBRARY) {
      const labels = spritesFor(entry.slug).map((s) => s.label);
      if (labels.length < 2) {
        expect(
          entry.sides,
          `${entry.slug} has one sheet and should have no side copy`
        ).toBeUndefined();
        continue;
      }
      expect(Object.keys(entry.sides ?? {}).sort(), entry.slug).toEqual(
        [...labels].sort() as string[]
      );
    }
  });

  it("writes each side differently from its sibling and from the lesson", () => {
    // Side copy that merely repeats the lesson is the shared page again, wearing
    // a different heading.
    for (const entry of TECHNIQUE_LIBRARY) {
      const sides = Object.values(entry.sides ?? {});
      if (sides.length === 0) continue;
      const written = sides.map((s) => prose(s).join("\n"));
      expect(new Set(written).size, `${entry.slug}: the sides share copy`).toBe(
        written.length
      );
      for (const text of written) {
        expect(text, `${entry.slug}: a side just repeats the lesson`).not.toBe(
          prose(entry).join("\n")
        );
      }
    }
  });

  it("never lands two tiles on the same heading, in either stance", () => {
    for (const southpaw of [false, true]) {
      const headings = ALL_TILES.map((t) =>
        displayName(lessonCard(t.entry, t.side).name, southpaw)
      );
      expect(new Set(headings).size, `southpaw=${southpaw}`).toBe(
        headings.length
      );
    }
  });

  it("writes side copy in lead and rear, never in left and right", () => {
    // The figure mirrors for a southpaw and the prose does not, so a line of
    // side copy naming a direction would contradict the picture above it. The
    // base copy has the same rule; this is the half a test can enforce
    // outright, because the new copy was written knowing about it.
    for (const entry of TECHNIQUE_LIBRARY) {
      for (const [label, side] of Object.entries(entry.sides ?? {})) {
        for (const line of prose(side)) {
          expect(
            /\b(left|right)\b/i.test(line),
            `${entry.slug} ${label}: "${line}"`
          ).toBe(false);
        }
      }
    }
  });

  it("mirrors a side NAME that carries a direction, and only that", () => {
    // "Slip Left" is the other way round for a southpaw, and has to be: the
    // callout engine mirrors it on the way to the speaker too. "Lead Teep" is
    // the lead teep from either stance.
    expect(displayName("Slip Left", true)).toBe("Slip Right");
    expect(displayName("Lead Teep", true)).toBe("Lead Teep");
    for (const entry of TECHNIQUE_LIBRARY) {
      for (const [label, side] of Object.entries(entry.sides ?? {})) {
        const mirrors = displayName(side.name, true) !== side.name;
        expect(mirrors, `${side.name} (${label})`).toBe(
          label === "Left" || label === "Right"
        );
      }
    }
  });

  it("has no switcher on the card to put the sides back together", () => {
    // The two sides are chosen on the shelf. A control on the card offering the
    // other one is the shared page again, one tap further away.
    const page = readFileSync(
      "src/features/learn/components/LearnSection.tsx",
      "utf8"
    );
    expect(page).not.toContain("learn-sides");
    expect(page).not.toContain("onSelectVariant");
  });
});

describe("the filter chips count what tapping them shows", () => {
  it("counts tiles, which is more than the lessons wherever a pair was shot", () => {
    // "Knees 1" printed above two knees was the complaint. Every tile is a page
    // now, so a chip counts pages.
    expect(SHELF_TILE_COUNT).toBe(ALL_TILES.length);
    expect(SHELF_TILE_COUNT).toBe(
      GALLERY_SECTIONS.reduce((n, s) => n + s.tiles.length, 0)
    );
    expect(SHELF_TILE_COUNT).toBeGreaterThan(SHELF_LESSON_COUNT);
  });

  it("is what the shelf actually prints", () => {
    // The counts and the grid came from two different numbers, and only the
    // grid was right. Nothing in the component may reach for the lesson count
    // again.
    const gallery = readFileSync(
      "src/features/learn/components/TechniqueGallery.tsx",
      "utf8"
    );
    expect(gallery).toContain("SHELF_TILE_COUNT");
    expect(gallery, "the chips are back to counting lessons").not.toContain(
      "lessonCount"
    );
  });
});
