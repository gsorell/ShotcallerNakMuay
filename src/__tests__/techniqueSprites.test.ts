// The sprite manifest is hand-maintained: a slug is added to it when a sheet
// lands in public/assets/technique. Two ways that drifts, both silent in the UI
// — a slug listed with no file gives a broken slot, and a file with no slug
// listed never gets shown. This fails the build on either.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { TECHNIQUE_LIBRARY } from "@/features/learn/data/techniqueLibrary";
import {
  SPRITE_FRAMES,
  spritesFor,
} from "@/features/learn/data/techniqueSprites";

const SPRITE_DIR = join(process.cwd(), "public", "assets", "technique");

const librarySlugs = TECHNIQUE_LIBRARY.map((e) => e.slug);

/** Every sheet the app can ask for, as a path under public/. */
const referenced = librarySlugs.flatMap((slug) =>
  spritesFor(slug).map((v) => v.src)
);

const filesOnDisk = existsSync(SPRITE_DIR)
  ? readdirSync(SPRITE_DIR).filter((f) => f.endsWith(".webp"))
  : [];

/** The wrapper element that orders itself against the lesson copy. */
const WRAPPER = "technique-sprites";

describe("technique sprites", () => {
  it("every referenced sheet exists on disk", () => {
    const missing = referenced.filter(
      (src) => !existsSync(join(SPRITE_DIR, src.split("/").pop() as string))
    );
    expect(missing).toEqual([]);
  });

  it("every sheet on disk is referenced by a lesson", () => {
    const wanted = new Set(referenced.map((src) => src.split("/").pop()));
    expect(filesOnDisk.filter((f) => !wanted.has(f))).toEqual([]);
  });

  it("only resolves slugs that exist in the library", () => {
    expect(spritesFor("not-a-technique")).toEqual([]);
  });

  it("labels every variant when a lesson shows more than one", () => {
    // An unlabelled pair is two figures with no way to tell which side is which.
    for (const slug of librarySlugs) {
      const variants = spritesFor(slug);
      if (variants.length > 1) {
        expect(variants.every((v) => Boolean(v.label))).toBe(true);
      }
    }
  });

  it("stacks the figure above the copy on narrow screens", () => {
    // Ordering belongs to the WRAPPER. When the component gained a second
    // variant the wrapper was renamed to the plural and these rules kept naming
    // the inner cell, which silently dropped the figure below the text on every
    // phone — the layout still worked, it was just upside down. Nothing else
    // catches that.
    const component = readFileSync(
      "src/features/learn/components/TechniqueSprite.tsx",
      "utf8"
    );
    expect(component).toContain(WRAPPER);

    for (const css of [
      "src/features/roadmap/components/RoadmapSection.css",
      "src/features/learn/components/LearnSection.css",
    ]) {
      const text = readFileSync(css, "utf8");
      const rules = text.match(
        /\.technique-sprites?[^{]*\{[^}]*order:\s*-1[^}]*\}/g
      );
      expect(rules, css + " has no order rule for the sprite").toBeTruthy();
      for (const rule of rules ?? []) {
        expect(rule, css + " orders the inner cell, not the wrapper").toContain(
          "." + WRAPPER
        );
      }
    }
  });

  it("steps through the frame count the sheets were cut with", () => {
    // The CSS translates by -100% over steps(SPRITE_FRAMES); a mismatch here
    // shows as the animation skipping or repeating cells.
    expect(SPRITE_FRAMES).toBe(6);
  });
});
