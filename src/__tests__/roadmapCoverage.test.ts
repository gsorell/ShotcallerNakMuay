import { describe, expect, it } from "vitest";

import { INITIAL_TECHNIQUES } from "@/constants/techniques";
import { getEntryForCallout } from "@/features/learn/data/techniqueIndex";
import {
  FOUNDATIONS,
  ROADMAP_PATHS,
  combosForLevel,
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

  it("gives every level both combo forms and real teaching copy", () => {
    for (const path of ROADMAP_PATHS) {
      for (const level of path.levels) {
        const where = `${path.id} L${level.id}`;
        expect(level.title, where).toBeTruthy();
        expect(level.blurb.length, where).toBeGreaterThan(40);
        expect(level.introduces.length, where).toBeGreaterThan(0);
        expect(level.combosNumbered.length, where).toBeGreaterThan(0);
        expect(level.combosNamed.length, where).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the two combo forms in step with each other", () => {
    // They are the same combinations spoken two ways — a mismatch in count
    // means one form was edited without the other.
    for (const path of ROADMAP_PATHS) {
      for (const level of path.levels) {
        expect(level.combosNamed.length, `${path.id} L${level.id}`).toBe(
          level.combosNumbered.length
        );
      }
    }
  });

  it("marks exactly one core level free, and it is the first", () => {
    for (const path of ROADMAP_PATHS) {
      const free = path.levels.filter((l) => l.free);
      expect(free.map((l) => l.id), path.id).toEqual([1]);
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
        expect(level.session.restMinutes, where).toBeGreaterThanOrEqual(1);
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

describe("names-to-numbers hand-off", () => {
  it("speaks names before the hand-off and numbers after", () => {
    for (const level of FOUNDATIONS.levels) {
      const combos = combosForLevel(FOUNDATIONS, level);
      const expected =
        level.id >= FOUNDATIONS.numbersFromLevel
          ? level.combosNumbered
          : level.combosNamed;
      expect(combos, `L${level.id}`).toBe(expected);
    }
  });

  it("never speaks a number before the level that teaches numbers", () => {
    // A beginner cannot act on "1 2" until level 2's card explains it.
    const early = FOUNDATIONS.levels.filter(
      (l) => l.id < FOUNDATIONS.numbersFromLevel
    );
    for (const level of early) {
      for (const combo of combosForLevel(FOUNDATIONS, level)) {
        expect(combo, `L${level.id}: "${combo}"`).not.toMatch(/\d/);
      }
    }
  });

  it("explains the number system on the level before it is first used", () => {
    const handoff = getLevel(FOUNDATIONS.id, FOUNDATIONS.numbersFromLevel - 1);
    expect(handoff?.languageNote, "the hand-off level needs a language note")
      .toBeTruthy();
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
