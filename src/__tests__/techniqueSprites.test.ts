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

/** Every block opened by `at`, matched by counting braces. */
function mediaBlocks(css: string, at: string): string[] {
  const out: string[] = [];
  let i = css.indexOf(at);
  while (i !== -1) {
    let depth = 0;
    let j = css.indexOf("{", i);
    const start = j;
    for (; j < css.length; j++) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}" && --depth === 0) break;
    }
    out.push(css.slice(start, j));
    i = css.indexOf(at, j);
  }
  return out;
}

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

  it("keeps the figure above the copy", () => {
    // The two surfaces reach the same place by different means, so this checks
    // each one's own mechanism. What must not happen either way is the figure
    // landing under the text: reading past a wall of copy to reach it defeats
    // the point of having shot it.
    const component = readFileSync(
      "src/features/learn/components/TechniqueSprite.tsx",
      "utf8"
    );
    expect(component).toContain(WRAPPER);

    // Learn puts the figure first in the DOM and stacks a column at every
    // width, so nothing has to reorder it. This used to lean on `order: -1`
    // against a row layout, which broke silently once: the component gained a
    // second variant, the wrapper was renamed to the plural, and the rule kept
    // naming the inner cell — putting the figure under the text on every
    // phone. Document order cannot come apart that way.
    const detail = readFileSync(
      "src/features/learn/components/LearnSection.tsx",
      "utf8"
    );
    const intro = detail.slice(detail.indexOf('className="learn-detail-intro"'));
    const figure = intro.indexOf("<TechniqueViewer");
    const copy = intro.indexOf("learn-detail-summary");
    expect(figure, "the detail page renders no figure").toBeGreaterThan(-1);
    expect(copy, "the detail page renders no summary").toBeGreaterThan(-1);
    expect(figure, "the summary comes before the figure").toBeLessThan(copy);

    // The roadmap card is a grid instead, because the figure also has to show
    // while the card is shut. It holds row one in both states and the copy
    // drops beneath it across both columns — so the figure grows in place
    // rather than moving when a card opens.
    const roadmap = readFileSync(
      "src/features/roadmap/components/RoadmapSection.css",
      "utf8"
    );
    const narrow = mediaBlocks(roadmap, "@media (max-width: 600px)").join("\n");
    expect(narrow, "no narrow-screen rules for the card").toContain(
      "roadmap-card"
    );
    expect(narrow).toMatch(
      /\.roadmap-card--open \.technique-sprites[^{]*\{[^}]*grid-row:\s*1;/
    );
    expect(narrow).toMatch(
      /\.roadmap-card--open \.roadmap-card-copy[^{]*\{[^}]*grid-column:\s*1 \/ -1;/
    );
  });

  it("steps through the frame count the sheets were cut with", () => {
    // The CSS translates by -100% over steps(SPRITE_FRAMES); a mismatch here
    // shows as the animation skipping or repeating cells.
    expect(SPRITE_FRAMES).toBe(6);
  });
});
