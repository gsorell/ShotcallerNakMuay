// The sprite manifest is hand-maintained: a slug is added to it when a sheet
// lands in public/assets/technique. Two ways that drifts, both silent in the UI
// — a slug listed with no file gives a broken slot, and a file with no slug
// listed never gets shown. This fails the build on either.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { TECHNIQUE_LIBRARY } from "@/features/learn/data/techniqueLibrary";
import { SPRITE_FRAMES, spriteFor } from "@/features/learn/data/techniqueSprites";

const SPRITE_DIR = join(process.cwd(), "public", "assets", "technique");

const slugsWithSprite = TECHNIQUE_LIBRARY.map((e) => e.slug).filter((slug) =>
  Boolean(spriteFor(slug))
);

const filesOnDisk = existsSync(SPRITE_DIR)
  ? readdirSync(SPRITE_DIR).filter((f) => f.endsWith(".webp"))
  : [];

describe("technique sprites", () => {
  it("every listed lesson has a sheet on disk", () => {
    const missing = slugsWithSprite.filter(
      (slug) => !existsSync(join(SPRITE_DIR, `${slug}.webp`))
    );
    expect(missing).toEqual([]);
  });

  it("every sheet on disk belongs to a lesson that will show it", () => {
    const orphans = filesOnDisk
      .map((f) => f.replace(/\.webp$/, ""))
      .filter((slug) => !slugsWithSprite.includes(slug));
    expect(orphans).toEqual([]);
  });

  it("only resolves slugs that exist in the library", () => {
    expect(spriteFor("not-a-technique")).toBeUndefined();
  });

  it("steps through the frame count the sheets were cut with", () => {
    // The CSS translates by -100% over steps(SPRITE_FRAMES); a mismatch here
    // shows as the animation skipping or repeating cells.
    expect(SPRITE_FRAMES).toBe(6);
  });
});
