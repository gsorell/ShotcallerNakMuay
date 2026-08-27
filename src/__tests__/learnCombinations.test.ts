import { describe, expect, it } from "vitest";

import { COMBINATIONS, beatFor } from "@/features/learn/data/combinations";
import { GALLERY_SECTIONS } from "@/features/learn/data/galleryTiles";
import { getEntry, getEntryForCallout } from "@/features/learn/data/techniqueIndex";
import {
  displayName,
  spritesFor,
} from "@/features/learn/data/techniqueSprites";
import { FOUNDATIONS } from "@/features/roadmap/data/paths";
import { tokenizeCombo } from "@/features/roadmap/vocabulary";

/** Every combination string the path names, level order, duplicates included. */
const authored = FOUNDATIONS.levels.flatMap((level) => level.combos);

/** A token names a technique nobody has filmed yet. */
const unshot = (token: string) => {
  const entry = getEntryForCallout(token);
  return !entry || spritesFor(entry.slug).length === 0;
};

describe("a combination is drawn whole or not at all", () => {
  it("gives every beat a sheet", () => {
    for (const combo of COMBINATIONS) {
      for (const beat of combo.beats) {
        expect(beat.variant, `${combo.label} has a beat with no sheet`).toBeTruthy();
        expect(spritesFor(beat.slug)[beat.variantIndex]).toEqual(beat.variant);
      }
    }
  });

  it("has one beat per token, in the order they are called", () => {
    for (const combo of COMBINATIONS) {
      expect(combo.beats.map((b) => b.token)).toEqual(tokenizeCombo(combo.label));
    }
  });

  it("drops only the combinations naming something un-shot", () => {
    // The invariant that keeps a silent gap impossible: a combination is
    // missing from the section only because a technique in it has no sheet,
    // never because a token failed to resolve.
    const drawn = new Set(COMBINATIONS.map((c) => c.label));
    for (const label of authored) {
      if (drawn.has(label)) continue;
      expect(
        tokenizeCombo(label).some(unshot),
        `${label} was dropped but every technique in it has been shot`
      ).toBe(true);
    }
  });

  it("keeps the earliest level to name a combination", () => {
    for (const combo of COMBINATIONS) {
      const first = FOUNDATIONS.levels.find((level) =>
        level.combos.includes(combo.label)
      );
      expect(combo.levelId).toBe(first?.id);
    }
  });
});

describe("a callout resolves to the side it names", () => {
  /** The sheet's own label, which is what the resolution has to land on. */
  const sheetOf = (token: string) => {
    const beat = beatFor(token);
    return beat && spritesFor(beat.slug)[beat.variantIndex]?.label;
  };

  it("reads Left as the lead where the pair is labelled lead and rear", () => {
    // The library is written orthodox, so a left teep is the lead teep.
    expect(sheetOf("Left Teep")).toBe("Lead");
    expect(sheetOf("Right Teep")).toBe("Rear");
    expect(sheetOf("Left Check")).toBe("Lead");
    expect(sheetOf("Right Knee")).toBe("Rear");
    expect(sheetOf("Left Elbow")).toBe("Lead");
  });

  it("also answers to lead and rear, which some callouts use instead", () => {
    expect(sheetOf("Rear Knee")).toBe("Rear");
    expect(sheetOf("Rear Knee")).toBe(sheetOf("Right Knee"));
  });

  it("reads a direction as a direction where the pair is a direction", () => {
    // For the slip and the roll the side IS the technique, so these match
    // straight across rather than through lead and rear.
    expect(sheetOf("Slip Left")).toBe("Left");
    expect(sheetOf("Slip Right")).toBe("Right");
    expect(sheetOf("Roll Left")).toBe("Left");
    expect(sheetOf("Roll Right")).toBe("Right");
  });

  it("does not read a side into a name that has none", () => {
    // "Overhand" is not a right and "Lean Back" is not a lead. Both are single
    // sheets anyway, so this is guarding the regex rather than the lookup.
    expect(beatFor("Overhand")?.variantIndex).toBe(0);
    expect(beatFor("Lean Back")?.variantIndex).toBe(0);
  });

  it("prints the callout it was given, never the side it picked", () => {
    // A handful of callouts name a paired lesson with no side — the figure is
    // a guess, and the label must not dress that guess up as a call the app
    // made. "Slip" stays "Slip".
    for (const token of ["Slip", "Elbow", "Up Elbow"]) {
      const beat = beatFor(token);
      if (!beat) continue;
      expect(beat.token).toBe(token);
      expect(spritesFor(beat.slug).length).toBeGreaterThan(1);
    }
  });

  it("resolves nothing it cannot name", () => {
    expect(beatFor("Cartwheel")).toBeNull();
    expect(beatFor("")).toBeNull();
  });
});

describe("the shelf filter narrows the combinations with the grid", () => {
  it("files a combination under every category it touches", () => {
    for (const combo of COMBINATIONS) {
      const touched = new Set(
        combo.beats.map((beat) => getEntry(beat.slug)?.category)
      );
      expect([...combo.categories].sort()).toEqual(
        [...touched].filter(Boolean).sort()
      );
    }
  });

  it("keeps a combination that crosses categories under both", () => {
    // The ones worth showing are exactly the ones that cross — a punch into a
    // kick belongs on Punches and on Kicks, and filing it under one would hide
    // it from the half of the shelf it teaches most.
    const crossing = COMBINATIONS.filter(
      (c) => c.categories.has("punches") && c.categories.has("kicks")
    );
    expect(crossing.length).toBeGreaterThan(0);
    for (const combo of crossing) {
      expect(combo.beats.some((b) => getEntry(b.slug)?.category === "punches")).toBe(
        true
      );
      expect(combo.beats.some((b) => getEntry(b.slug)?.category === "kicks")).toBe(
        true
      );
    }
  });

  it("never offers a filter a row it cannot fill", () => {
    // Every category with tiles on the shelf has at least one combination, so
    // narrowing to it never leaves the heading standing over nothing. A
    // category that stops earning a row makes the component return null, which
    // this is here to notice rather than to forbid.
    for (const section of GALLERY_SECTIONS) {
      const matching = COMBINATIONS.filter((c) =>
        c.categories.has(section.meta.key)
      );
      expect(
        matching.length,
        `${section.meta.key} has tiles but no combination`
      ).toBeGreaterThan(0);
    }
  });

  it("counts every combination under the unfiltered shelf", () => {
    for (const combo of COMBINATIONS) {
      expect(combo.categories.size).toBeGreaterThan(0);
    }
  });
});

describe("southpaw reads a combination the way the app calls it", () => {
  it("mirrors the sides in a label and leaves the numbers alone", () => {
    expect(displayName("1 2, Left Teep", true)).toBe("1 2, Right Teep");
    expect(displayName("Slip Left, 2 3", true)).toBe("Slip Right, 2 3");
    expect(displayName("1 2 3", true)).toBe("1 2 3");
  });

  it("changes nothing for an orthodox fighter", () => {
    for (const combo of COMBINATIONS) {
      expect(displayName(combo.label, false)).toBe(combo.label);
    }
  });

  it("mirrors a label the same way it mirrors the beats inside it", () => {
    // The board prints tokens and the chip prints the whole string; if those
    // two disagreed, a southpaw would read one name on the chip and another
    // under the figures.
    for (const combo of COMBINATIONS) {
      const fromBeats = combo.beats.map((b) => displayName(b.token, true));
      const fromLabel = tokenizeCombo(displayName(combo.label, true));
      expect(fromLabel).toEqual(fromBeats);
    }
  });
});
