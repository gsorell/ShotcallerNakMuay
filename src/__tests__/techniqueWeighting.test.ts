import { describe, expect, it } from "vitest";

import { INITIAL_TECHNIQUES, techniqueText } from "@/constants/techniques";
import type { EmphasisKey } from "@/types";
import { entryWeight, generateTechniquePool } from "@/utils/techniqueUtils";

const noEmphasis = {} as Record<EmphasisKey, boolean>;

const poolFor = (groups: Record<string, any>, keys: string[]) =>
  generateTechniquePool(
    groups as any,
    { ...noEmphasis, ...Object.fromEntries(keys.map((k) => [k, true])) } as any,
    false,
    Object.fromEntries(Object.keys(groups).map((k) => [k, k]))
  ).map((t) => t.text);

const count = (pool: string[], text: string) =>
  pool.filter((t) => t === text).length;

describe("technique weighting", () => {
  it("reads a weight off an entry", () => {
    expect(entryWeight("Jab")).toBe(1);
    expect(entryWeight({ text: "Jab" })).toBe(1);
    expect(entryWeight({ text: "Jab", weight: 3 })).toBe(3);
  });

  it("treats a starred technique as weighted", () => {
    // The star has been in the editor all along; the weighting behind it never
    // worked, because the old dedupe ran after it and threw the extra away.
    expect(entryWeight({ text: "Jab", favorite: true })).toBe(2);
    // An explicit weight wins over the star.
    expect(entryWeight({ text: "Jab", favorite: true, weight: 4 })).toBe(4);
  });

  it("refuses nonsense weights rather than trusting them", () => {
    expect(entryWeight({ text: "Jab", weight: 0 })).toBe(1);
    expect(entryWeight({ text: "Jab", weight: -5 })).toBe(1);
    expect(entryWeight({ text: "Jab", weight: Number.NaN })).toBe(1);
    // A typo like 500 would otherwise flood the pool so nothing else is called.
    expect(entryWeight({ text: "Jab", weight: 500 })).toBe(6);
  });

  it("calls a weighted technique more often", () => {
    const pool = poolFor(
      {
        test: {
          label: "test",
          singles: ["Jab", { text: "Left Check", weight: 3 }, "Cross"],
          combos: [],
        },
      },
      ["test"]
    );
    expect(count(pool, "Left Check")).toBe(3);
    expect(count(pool, "Jab")).toBe(1);
    expect(count(pool, "Cross")).toBe(1);
  });

  it("adds duplicates together instead of discarding them", () => {
    // Writing something out three times is the obvious way to ask for it more
    // often. It used to do nothing at all.
    const pool = poolFor(
      {
        test: {
          label: "test",
          singles: ["Jab", "Jab", "Jab", "Cross"],
          combos: [],
        },
      },
      ["test"]
    );
    expect(count(pool, "Jab")).toBe(3);
    expect(count(pool, "Cross")).toBe(1);
  });

  it("calls everything once before repeating a weighted technique", () => {
    // Read in order, a weighted pool must not say the same thing three times
    // running — every technique gets a turn first.
    const pool = poolFor(
      {
        test: {
          label: "test",
          singles: [{ text: "Left Check", weight: 3 }, "Jab", "Cross"],
          combos: [],
        },
      },
      ["test"]
    );
    expect(pool.slice(0, 3)).toEqual(["Left Check", "Jab", "Cross"]);
    expect(pool).toEqual(["Left Check", "Jab", "Cross", "Left Check", "Left Check"]);
  });

  it("still contains every technique exactly once at weight 1", () => {
    const pool = poolFor(
      { newb: INITIAL_TECHNIQUES.newb as any },
      ["newb"]
    );
    for (const single of INITIAL_TECHNIQUES.newb.singles) {
      expect(count(pool, techniqueText(single)), techniqueText(single)).toBe(1);
    }
  });
});

describe("shipped style hygiene", () => {
  it("lists no technique twice in any style", () => {
    // Repeats now add up rather than being dropped, so an accidental one
    // silently skews a style. Weight is the way to say it on purpose.
    const offenders: string[] = [];
    for (const [key, group] of Object.entries(INITIAL_TECHNIQUES)) {
      for (const field of ["singles", "combos"] as const) {
        const seen = new Set<string>();
        for (const entry of group[field] ?? []) {
          const text = techniqueText(entry).trim().toLowerCase();
          if (!text) continue;
          if (seen.has(text)) offenders.push(`${key}.${field}: "${text}"`);
          seen.add(text);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the weighting the duplicates used to stand for", () => {
    const tae = poolFor({ tae: INITIAL_TECHNIQUES.tae as any }, ["tae"]);
    expect(count(tae, "Left Check")).toBe(3);
    expect(count(tae, "Right Check")).toBe(2);

    const femur = poolFor({ femur: INITIAL_TECHNIQUES.femur as any }, ["femur"]);
    expect(count(femur, "Left Check")).toBe(2);
    expect(count(femur, "Right Check")).toBe(2);
  });

  it("names no empty technique", () => {
    for (const [key, group] of Object.entries(INITIAL_TECHNIQUES)) {
      for (const field of ["singles", "combos"] as const) {
        for (const entry of group[field] ?? []) {
          expect(techniqueText(entry).trim(), `${key}.${field}`).toBeTruthy();
        }
      }
    }
  });

  it("leaves no stray whitespace in a callout", () => {
    // These are spoken, and a double space is a stumble in the voice.
    for (const [key, group] of Object.entries(INITIAL_TECHNIQUES)) {
      for (const field of ["singles", "combos"] as const) {
        for (const entry of group[field] ?? []) {
          const text = techniqueText(entry);
          expect(text, `${key}.${field}: "${text}"`).toBe(text.trim());
          expect(text.includes("  "), `${key}.${field}: "${text}"`).toBe(false);
        }
      }
    }
  });
});
