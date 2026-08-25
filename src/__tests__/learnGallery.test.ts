import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ENTRIES_BY_CATEGORY,
  SPRITED_ENTRIES,
} from "@/features/learn/data/techniqueIndex";
import {
  CATEGORY_META,
  TECHNIQUE_LIBRARY,
} from "@/features/learn/data/techniqueLibrary";
import {
  SPRITE_GROUPS,
  categoryHero,
  spritesFor,
} from "@/features/learn/data/techniqueSprites";

const onDisk = (src: string) =>
  existsSync(resolve(process.cwd(), "public", src.replace(/^\//, "")));

describe("the gallery's set", () => {
  it("is every lesson that has a sheet, and nothing else", () => {
    const expected = TECHNIQUE_LIBRARY.filter(
      (e) => spritesFor(e.slug).length > 0
    );
    expect(SPRITED_ENTRIES).toHaveLength(expected.length);
    expect(SPRITED_ENTRIES.map((e) => e.slug)).toEqual(
      expected.map((e) => e.slug)
    );
  });

  it("shows a sheet that is actually on disk for every tile", () => {
    // A tile renders the FIRST sheet of its lesson. `spritesFor` names files
    // rather than importing them, so a renamed sheet is invisible until the
    // shelf renders an empty square on someone's phone.
    for (const entry of SPRITED_ENTRIES) {
      const first = spritesFor(entry.slug)[0]!;
      expect(onDisk(first.src), `${entry.slug}: ${first.src}`).toBe(true);
    }
  });
});

describe("the gallery's filters", () => {
  it("partition the set — every figure in exactly one group", () => {
    const counts = new Map<string, number>();
    for (const entry of SPRITED_ENTRIES) {
      const hit = SPRITE_GROUPS.filter((g) =>
        g.categories.includes(entry.category)
      );
      expect(
        hit.map((g) => g.key),
        `${entry.slug} belongs to ${hit.length} groups`
      ).toHaveLength(1);
      counts.set(hit[0]!.key, (counts.get(hit[0]!.key) ?? 0) + 1);
    }

    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(SPRITED_ENTRIES.length);
  });

  it("never come back empty", () => {
    // An empty filter is a chip that looks broken when tapped.
    for (const group of SPRITE_GROUPS) {
      const n = SPRITED_ENTRIES.filter((e) =>
        group.categories.includes(e.category)
      ).length;
      expect(n, `${group.key} is empty`).toBeGreaterThan(0);
    }
  });
});

describe("category cards", () => {
  it("carry a figure exactly when the category has one to carry", () => {
    // The rule that keeps the shelf honest: a category with sheets shows one,
    // and a category with none keeps its neon icon rather than a blank slot.
    for (const meta of CATEGORY_META) {
      const anyShot = ENTRIES_BY_CATEGORY[meta.key].some(
        (e) => spritesFor(e.slug).length > 0
      );
      expect(
        categoryHero(meta.key) !== undefined,
        `${meta.key}: ${anyShot ? "has sheets but no hero" : "has a hero but nothing shot"}`
      ).toBe(anyShot);
    }
  });

  it("point at a sheet that is on disk", () => {
    for (const meta of CATEGORY_META) {
      const hero = categoryHero(meta.key);
      if (!hero) continue;
      expect(onDisk(hero.src), `${meta.key}: ${hero.src}`).toBe(true);
    }
  });
});
