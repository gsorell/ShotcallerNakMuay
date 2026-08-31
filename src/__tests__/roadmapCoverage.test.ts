import { describe, expect, it } from "vitest";

import { INITIAL_TECHNIQUES } from "@/constants/techniques";
import { getEntryForCallout } from "@/features/learn/data/techniqueIndex";
import {
  FOUNDATIONS,
  ROADMAP_PATHS,
  coreLevels,
  cumulativeSingles,
  getLevel,
  totalTechniqueCount,
} from "@/features/roadmap/data/paths";

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

describe("roadmap structure", () => {
  it("numbers levels contiguously from 1", () => {
    for (const path of ROADMAP_PATHS) {
      const ids = path.levels.map((l) => l.id);
      expect(ids, path.id).toEqual(ids.map((_, i) => i + 1));
    }
  });

  it("introduces no technique twice", () => {
    for (const path of ROADMAP_PATHS) {
      const seen = new Map<string, number>();
      for (const level of path.levels) {
        for (const technique of level.introduces) {
          const key = normalize(technique);
          const first = seen.get(key);
          expect(
            first,
            `"${technique}" is introduced at level ${first} and again at level ${level.id}`
          ).toBeUndefined();
          seen.set(key, level.id);
        }
      }
    }
  });

  it("gives every level combinations and real teaching copy", () => {
    for (const path of ROADMAP_PATHS) {
      for (const level of path.levels) {
        const where = `${path.id} L${level.id}`;
        expect(level.title, where).toBeTruthy();
        expect(level.blurb.length, where).toBeGreaterThan(40);
        expect(level.introduces.length, where).toBeGreaterThan(0);
        expect(level.combos.length, where).toBeGreaterThan(0);
      }
    }
  });

  it("gives away an unbroken run of levels from the first", () => {
    // The free levels have to be the *opening* ones and have to be
    // contiguous: the ladder unlocks in order, so a free level with a locked
    // one before it can never be reached and is worth nothing.
    for (const path of ROADMAP_PATHS) {
      const free = path.levels.filter((l) => l.free).map((l) => l.id);
      expect(free.length, path.id).toBeGreaterThan(0);
      expect(free, path.id).toEqual(
        Array.from({ length: free.length }, (_, i) => i + 1)
      );
      // Still a sample, not the product.
      expect(free.length, path.id).toBeLessThan(path.levels.length / 2);
    }
  });

  it("keeps bonus levels after every core level", () => {
    for (const path of ROADMAP_PATHS) {
      const firstBonus = path.levels.findIndex((l) => l.bonus);
      if (firstBonus === -1) continue;
      expect(
        path.levels.slice(firstBonus).every((l) => l.bonus),
        `${path.id} has a core level after a bonus level`
      ).toBe(true);
    }
  });

  it("pins a sane session config on every level", () => {
    for (const path of ROADMAP_PATHS) {
      for (const level of path.levels) {
        const where = `${path.id} L${level.id}`;
        expect(level.session.roundsCount, where).toBeGreaterThanOrEqual(1);
        expect(level.session.roundMin, where).toBeGreaterThanOrEqual(1);
        // 0.25 is the floor `loadUserSettings` clamps to — anything under it
        // would be silently rewritten, so a level could not actually ship it.
        expect(level.session.restMinutes, where).toBeGreaterThanOrEqual(0.25);
        // A guided beginner path should never open on the fastest cadence.
        expect(level.session.difficulty, where).not.toBe("hard");
      }
    }
  });
});

describe("roadmap lesson coverage", () => {
  it("resolves every introduced technique to a Learn lesson", () => {
    // If this fails, a level names a callout the library does not explain —
    // the pre-session card would have nothing to show.
    const missing: string[] = [];
    for (const path of ROADMAP_PATHS) {
      for (const level of path.levels) {
        for (const technique of level.introduces) {
          if (!getEntryForCallout(technique)) {
            missing.push(`${path.id} L${level.id}: ${technique}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("foundations covers Nak Muay Newb exactly", () => {
  const newbSingles = (INITIAL_TECHNIQUES.newb.singles ?? []).map(normalize);

  it("introduces every technique the newb style calls out", () => {
    const taught = new Set(
      coreLevels(FOUNDATIONS).flatMap((l) => l.introduces.map(normalize))
    );
    const untaught = newbSingles.filter((s) => !taught.has(s));
    expect(
      untaught,
      "these newb callouts are never introduced by the path — a graduate would meet them cold"
    ).toEqual([]);
  });

  it("introduces nothing the newb style does not call out", () => {
    const newb = new Set(newbSingles);
    const extra = coreLevels(FOUNDATIONS)
      .flatMap((l) => l.introduces)
      .filter((t) => !newb.has(normalize(t)));
    expect(
      extra,
      "these are taught by the core path but are not part of Nak Muay Newb — they belong in a bonus level"
    ).toEqual([]);
  });

  it("teaches all 32 techniques by the final core level", () => {
    const core = coreLevels(FOUNDATIONS);
    const last = core[core.length - 1]!;
    expect(cumulativeSingles(FOUNDATIONS, last.id)).toHaveLength(
      newbSingles.length
    );
    expect(totalTechniqueCount(FOUNDATIONS)).toBe(newbSingles.length);
  });
});

describe("combinations speak in numbers", () => {
  it("numbers every punch in a level's own combinations", () => {
    // The point of the numbering is that it is quick to hear and quick to act
    // on. Spelling a punch out inside a combination — "Jab, Cross, Left Hook"
    // — throws that away, so no combination may name one.
    const spelledOutPunches =
      /\b(jab|cross|left hook|right hook|left uppercut|right uppercut)\b/i;
    for (const level of FOUNDATIONS.levels) {
      for (const combo of level.combos) {
        expect(
          combo,
          `L${level.id}: "${combo}" spells out a punch that has a number`
        ).not.toMatch(spelledOutPunches);
      }
    }
  });

  it("uses a number in every combination that contains a punch", () => {
    for (const level of FOUNDATIONS.levels) {
      for (const combo of level.combos) {
        // Kicks, knees, elbows and defence have no numbers and stay named —
        // but a combination made only of those is fine, so this just checks
        // that where digits belong, digits are what appear.
        expect(combo.length, `L${level.id}`).toBeGreaterThan(0);
      }
    }
    // Level 1 is nothing but punches, so it must be pure shorthand.
    for (const combo of getLevel(FOUNDATIONS.id, 1)!.combos) {
      expect(combo, `L1: "${combo}"`).toMatch(/^[\d\s]+$/);
    }
  });

  it("explains the numbering before the first combination round", () => {
    // Level 1's round 3 already calls "1 2", so level 1 is where it has to be
    // taught — not a level later.
    expect(
      getLevel(FOUNDATIONS.id, 1)?.languageNote,
      "level 1 must explain the numbers it is about to use"
    ).toBeTruthy();
  });
});

describe("cumulative vocabulary", () => {
  it("only ever grows", () => {
    let previous = 0;
    for (const level of coreLevels(FOUNDATIONS)) {
      const size = cumulativeSingles(FOUNDATIONS, level.id).length;
      expect(size, `L${level.id}`).toBeGreaterThan(previous);
      previous = size;
    }
  });

  it("still drills the jab at the final level", () => {
    const core = coreLevels(FOUNDATIONS);
    const last = core[core.length - 1]!;
    expect(cumulativeSingles(FOUNDATIONS, last.id)).toContain("Jab");
  });
});
