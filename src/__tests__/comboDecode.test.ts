import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  REST_COMBO_COUNT,
  decodeCombo,
  decodeCombos,
} from "@/features/roadmap/comboDecode";
import { FOUNDATIONS } from "@/features/roadmap/data/paths";

describe("decodeCombo", () => {
  it("reads a numeric combination out as its punches", () => {
    const { beats } = decodeCombo("1 2 3");
    expect(beats.map((b) => b.name)).toEqual(["Jab", "Cross", "Left Hook"]);
    expect(beats.map((b) => b.token)).toEqual(["1", "2", "3"]);
  });

  it("keeps a named segment whole", () => {
    const { beats } = decodeCombo("1 2, Head Kick");
    expect(beats.map((b) => b.name)).toEqual(["Jab", "Cross", "Head Kick"]);
  });

  it("gives every beat exactly one sheet", () => {
    for (const beat of decodeCombo("1 2, Left Teep").beats) {
      expect(beat.sprite, beat.token).toBeDefined();
    }
  });

  it("picks the side the callout names, on both labellings", () => {
    // Lead/Rear sheets — the same movement off different legs.
    expect(decodeCombo("Left Teep").beats[0]!.sprite!.src).toContain(
      "teep-lead"
    );
    expect(decodeCombo("Right Teep").beats[0]!.sprite!.src).toContain(
      "teep-rear"
    );
    // Left/Right sheets — mirror images.
    expect(decodeCombo("Slip Left").beats[0]!.sprite!.src).toContain(
      "slip-left"
    );
    expect(decodeCombo("Slip Right").beats[0]!.sprite!.src).toContain(
      "slip-right"
    );
  });

  it("takes the first sheet when the callout names no side", () => {
    // "Up Elbow" is called without a side, so there is nothing to choose with.
    const beat = decodeCombo("Up Elbow").beats[0]!;
    expect(beat.sprite).toBeDefined();
    expect(beat.sprite!.src).toContain("up-elbow-lead");
  });

  it("keeps the slot for a beat it cannot resolve", () => {
    const { beats } = decodeCombo("1 2, Cartwheel Kick");
    expect(beats).toHaveLength(3);
    expect(beats[2]).toEqual({ token: "Cartwheel Kick" });
  });
});

describe("decodeCombo · southpaw", () => {
  it("prints what will actually be called", () => {
    expect(decodeCombo("1, Left Teep", true).text).toBe("1, Right Teep");
  });

  it("shows the limb the mirrored callout names", () => {
    // A southpaw is told "Right Teep" and throws the right leg, which is their
    // lead. The rear sheet is the right leg, filmed from orthodox.
    expect(decodeCombo("1, Left Teep", true).beats[1]!.sprite!.src).toContain(
      "teep-rear"
    );
  });

  it("leaves the numbers alone, because they are stance-relative", () => {
    const { text, beats } = decodeCombo("1 2 3", true);
    expect(text).toBe("1 2 3");
    expect(beats.map((b) => b.name)).toEqual(["Jab", "Cross", "Left Hook"]);
  });
});

describe("decodeCombos", () => {
  it("shows at most REST_COMBO_COUNT, in authored order", () => {
    const level = FOUNDATIONS.levels.find((l) => l.combos.length > REST_COMBO_COUNT)!;
    const decoded = decodeCombos(level.combos);
    expect(decoded).toHaveLength(REST_COMBO_COUNT);
    expect(decoded.map((d) => d.text)).toEqual(
      level.combos.slice(0, REST_COMBO_COUNT)
    );
  });
});

describe("every authored combination decodes", () => {
  // The guard the authored combos never had. `isWithinVocabulary` filters the
  // DRAWN combinations, but a level's own `combos` are hand-written and went
  // straight into the round unchecked — which is how "4 to the Body" and
  // "3 to the Head" ended up being called with no lesson behind them.
  for (const level of FOUNDATIONS.levels) {
    for (const southpaw of [false, true]) {
      it(`L${level.id}${southpaw ? " southpaw" : ""}`, () => {
        for (const combo of level.combos) {
          for (const beat of decodeCombo(combo, southpaw).beats) {
            expect(beat.name, `"${combo}": "${beat.token}" resolves`).toBeDefined();
            expect(beat.sprite, `"${combo}": "${beat.token}" has a sheet`).toBeDefined();
          }
        }
      });
    }
  }
});

describe("every sheet the decoder asks for is on disk", () => {
  // `spritesFor` names files rather than importing them, so a renamed or
  // uncommitted sheet is invisible until the panel renders a broken figure on
  // someone's phone. The artwork tests guard the roadmap art the same way.
  it("resolves every beat of every level to a real file", () => {
    for (const level of FOUNDATIONS.levels) {
      for (const combo of level.combos) {
        for (const southpaw of [false, true]) {
          for (const beat of decodeCombo(combo, southpaw).beats) {
            const src = beat.sprite!.src;
            expect(
              existsSync(resolve(process.cwd(), "public", src.replace(/^\//, ""))),
              `L${level.id} "${combo}": ${src}`
            ).toBe(true);
          }
        }
      }
    }
  });
});
