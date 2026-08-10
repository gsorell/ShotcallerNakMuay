import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { CATEGORY_META } from "@/features/learn/data/techniqueLibrary";
import { artworkForLevel, categoryForLevel } from "@/features/roadmap/artwork";

// Imported from the module rather than the feature barrel: the barrel also
// pulls in the log components, which reach for `document` at import time.
import {
  ACHIEVEMENT_CHARMS,
  type WorkoutLogLite,
} from "@/features/logs/constants/charms";
import {
  FOUNDATIONS,
  combosForLevel,
  cumulativeSingles,
  getLevel,
} from "@/features/roadmap/data/paths";
import {
  formatRest,
  isSequentialRound,
  poolForRound,
  roadmapLogLabel,
  roundKind,
} from "@/features/roadmap/session";
import {
  drawnCombos,
  isWithinVocabulary,
  levelTeaching,
  taughtSlugs,
  tokenizeCombo,
} from "@/features/roadmap/vocabulary";
import { getEntryForCallout } from "@/features/learn/data/techniqueIndex";
import {
  hasGraduated,
  isLevelCleared,
  isLevelUnlocked,
  markLevelCleared,
  nextLevelId,
  pathSummary,
} from "@/features/roadmap/storage";

// The app runs in a browser; the test runner does not. A tiny in-memory stand-in
// is enough for the progress store, which only ever does getItem/setItem.
function installLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

const level = (id: number) => getLevel(FOUNDATIONS.id, id)!;

describe("per-round pools", () => {
  it("drills only the new techniques in the introduction round", () => {
    const l4 = level(4);
    const pool = poolForRound(FOUNDATIONS, l4, 1).map((t) => t.text);
    expect(pool).toEqual(l4.introduces);
  });

  it("mixes in everything learned so far in the integration round", () => {
    const pool = poolForRound(FOUNDATIONS, level(4), 2).map((t) => t.text);
    for (const single of cumulativeSingles(FOUNDATIONS, 4)) {
      expect(pool, single).toContain(single);
    }
    // The point of the path: level 4 still calls the jab from level 1.
    expect(pool).toContain("Jab");
    expect(pool).toContain("Low Kick");
  });

  it("calls the numbers alongside the names in the integration round", () => {
    // The whole app speaks in numbers, so hearing "jab" and "1" mean the same
    // thing has to happen before the combination round starts calling "1 2".
    const pool = poolForRound(FOUNDATIONS, level(1), 2).map((t) => t.text);
    expect(pool).toEqual(expect.arrayContaining(["Jab", "Cross", "1", "2"]));

    const l2 = poolForRound(FOUNDATIONS, level(2), 2).map((t) => t.text);
    expect(l2).toEqual(expect.arrayContaining(["3", "4"]));
  });

  it("never calls a multi-number shorthand as if it were one technique", () => {
    // "1 1" is a double jab — a combination, not another name for the jab.
    for (const l of FOUNDATIONS.levels) {
      const pool = poolForRound(FOUNDATIONS, l, 2).map((t) => t.text);
      expect(
        pool.filter((t) => /^\d+(\s+\d+)+$/.test(t)),
        `L${l.id}`
      ).toEqual([]);
    }
  });

  it("gives no number to techniques that do not have one", () => {
    // Body punches have their own lesson with no numbering — aliasing them to
    // the head-level number would call for the wrong punch entirely.
    const pool = poolForRound(FOUNDATIONS, level(9), 2).map((t) => t.text);
    expect(pool).toContain("Jab to the Body");
    const numbers = pool.filter((t) => /^\d+$/.test(t));
    expect(numbers.sort()).toEqual(["1", "2", "3", "4"]);
  });

  it("calls this level's combos in the combination round", () => {
    const l4 = level(4);
    const pool = poolForRound(FOUNDATIONS, l4, 3).map((t) => t.text);
    expect(pool).toEqual(expect.arrayContaining(combosForLevel(FOUNDATIONS, l4)));
  });

  it("keeps drilling combos if a level ever runs more than three rounds", () => {
    const l4 = level(4);
    expect(roundKind(4)).toBe("combos");
    expect(poolForRound(FOUNDATIONS, l4, 9).map((t) => t.text)).toEqual(
      poolForRound(FOUNDATIONS, l4, 3).map((t) => t.text)
    );
  });

  it("orders only the introduction round", () => {
    expect(isSequentialRound(1)).toBe(true);
    expect(isSequentialRound(2)).toBe(false);
    expect(isSequentialRound(3)).toBe(false);
  });

  it("never hands the engine an empty pool", () => {
    for (const l of FOUNDATIONS.levels) {
      for (let round = 1; round <= l.session.roundsCount; round += 1) {
        expect(
          poolForRound(FOUNDATIONS, l, round).length,
          `L${l.id} round ${round}`
        ).toBeGreaterThan(0);
      }
    }
  });

  it("tags every callout so southpaw mirroring can treat them normally", () => {
    const pool = poolForRound(FOUNDATIONS, level(1), 1);
    expect(pool.every((t) => t.style === "roadmap")).toBe(true);
  });
});

describe("combinations drawn from the app", () => {
  it("splits a combination into its techniques", () => {
    expect(tokenizeCombo("1 2 3")).toEqual(["1", "2", "3"]);
    expect(tokenizeCombo("1 2, Right Body Kick")).toEqual([
      "1",
      "2",
      "Right Body Kick",
    ]);
    // A named segment stays whole — "3 to the Body" is one technique, and
    // splitting it would leave a bare "3" meaning the wrong punch.
    expect(tokenizeCombo("1 2, 3 to the Body")).toEqual([
      "1",
      "2",
      "3 to the Body",
    ]);
  });

  it("only draws combinations the level has fully taught", () => {
    // This is the invariant the whole feature rests on: nothing arrives uncued.
    for (const l of FOUNDATIONS.levels) {
      const taught = taughtSlugs(FOUNDATIONS, l.id);
      for (const combo of drawnCombos(FOUNDATIONS, l.id)) {
        for (const token of tokenizeCombo(combo)) {
          const entry = getEntryForCallout(token);
          expect(
            entry && taught.has(entry.slug),
            `L${l.id} draws "${combo}" but "${token}" has not been taught`
          ).toBe(true);
        }
      }
    }
  });

  it("rejects anything with a technique the level has not reached", () => {
    // Level 2 knows the four hands and nothing else.
    expect(isWithinVocabulary("1 2 3", FOUNDATIONS, 2)).toBe(true);
    expect(isWithinVocabulary("1 2, Low Kick", FOUNDATIONS, 2)).toBe(false);
    expect(isWithinVocabulary("1 2 5 2", FOUNDATIONS, 2)).toBe(false);
    // ...and the uppercuts arrive at level 10.
    expect(isWithinVocabulary("1 2 5 2", FOUNDATIONS, 10)).toBe(true);
  });

  it("fails closed on tokens it cannot resolve", () => {
    // "Step-in" and "Clinch" are not techniques the path ever teaches, so a
    // combination containing them must never be drawn, at any level.
    expect(
      isWithinVocabulary("1 2, Clinch, Double Knees", FOUNDATIONS, 11)
    ).toBe(false);
    expect(isWithinVocabulary("", FOUNDATIONS, 10)).toBe(false);
  });

  it("finds the common permutations that were missing", () => {
    // The complaint that prompted this: level 2 drilled three hand-written
    // combos and never produced any of these, though the app already had them.
    const drawn = drawnCombos(FOUNDATIONS, 2);
    for (const wanted of ["2 3", "1 1", "3 4", "2 3 2", "3 3 3", "1 2 3 2"]) {
      expect(drawn, wanted).toContain(wanted);
    }
  });

  it("gives the combination round real variety at every level", () => {
    for (const l of FOUNDATIONS.levels) {
      const pool = poolForRound(FOUNDATIONS, l, 3);
      expect(pool.length, `L${l.id} combination round`).toBeGreaterThanOrEqual(
        8
      );
    }
  });

  it("mixes single shots into the combination round", () => {
    const pool = poolForRound(FOUNDATIONS, level(4), 3).map((t) => t.text);
    expect(pool).toContain("Low Kick");
    expect(pool).toContain("Jab");
  });

  it("still guarantees the level's own combinations are drilled", () => {
    for (const l of FOUNDATIONS.levels) {
      const pool = poolForRound(FOUNDATIONS, l, 3).map((t) =>
        t.text.toLowerCase()
      );
      for (const combo of combosForLevel(FOUNDATIONS, l)) {
        expect(pool, `L${l.id}: ${combo}`).toContain(combo.toLowerCase());
      }
    }
  });
});

describe("screen shows both name and number", () => {
  it("pairs a spoken number with its name on screen", () => {
    const pool = poolForRound(FOUNDATIONS, level(1), 2);
    const spokenNumber = pool.find((t) => t.text === "1");
    expect(spokenNumber?.display).toBe("1 · Jab");
  });

  it("pairs a spoken name with its number on screen", () => {
    const pool = poolForRound(FOUNDATIONS, level(1), 2);
    const spokenName = pool.find((t) => t.text === "Jab");
    expect(spokenName?.display).toBe("1 · Jab");
  });

  it("leaves techniques with no number showing just their name", () => {
    const pool = poolForRound(FOUNDATIONS, level(4), 2);
    const kick = pool.find((t) => t.text === "Low Kick");
    expect(kick?.display).toBeUndefined();
  });

  it("keeps calling names, not only numbers", () => {
    // Over half the curriculum has no number. A student drilled only on
    // numbers would freeze the first time a round calls "Left Check".
    const pool = poolForRound(FOUNDATIONS, level(5), 2).map((t) => t.text);
    expect(pool).toContain("Left Check");
    expect(pool).toContain("Jab");
    expect(pool).toContain("1");
  });
});

describe("rest between rounds", () => {
  it("says half a minute the way a person would", () => {
    expect(formatRest(0.5)).toBe("30 sec rest");
    expect(formatRest(1)).toBe("1 min rest");
    expect(formatRest(2)).toBe("2 min rest");
  });

  it("rests long enough for the warnings to still fire", () => {
    // The timer announces "10 seconds" and rings at 5 — a rest shorter than
    // that would skip its own cues.
    for (const l of FOUNDATIONS.levels) {
      const seconds = Math.round(l.session.restMinutes * 60);
      expect(seconds, `L${l.id}`).toBeGreaterThan(10);
    }
  });
});

describe("lesson to level cross-link", () => {
  it("points a lesson at the level that introduces it", () => {
    expect(levelTeaching(FOUNDATIONS, "jab")?.id).toBe(1);
    expect(levelTeaching(FOUNDATIONS, "teep")?.id).toBe(3);
    expect(levelTeaching(FOUNDATIONS, "straight-knee")?.id).toBe(8);
    expect(levelTeaching(FOUNDATIONS, "horizontal-elbow")?.id).toBe(11);
  });

  it("says nothing for techniques the path never teaches", () => {
    // Spinning elbows are Muay Sok's business, not the beginner path's.
    expect(levelTeaching(FOUNDATIONS, "spinning-elbow")).toBeUndefined();
  });

  it("agrees with the level that actually introduces the technique", () => {
    for (const l of FOUNDATIONS.levels) {
      for (const technique of l.introduces) {
        const slug = getEntryForCallout(technique)!.slug;
        expect(levelTeaching(FOUNDATIONS, slug)?.id, technique).toBe(l.id);
      }
    }
  });
});

describe("level artwork", () => {
  it("gives every level a picture that exists on disk", () => {
    // ImageWithFallback degrades silently to the emoji if a file 404s, so a
    // renamed asset would only ever show up as a visual regression.
    for (const l of FOUNDATIONS.levels) {
      const art = artworkForLevel(l);
      const file = resolve(__dirname, "../../public", art.iconPath.slice(1));
      expect(existsSync(file), `L${l.id} → ${art.iconPath}`).toBe(true);
      expect(art.icon, `L${l.id} needs an emoji fallback`).toBeTruthy();
    }
  });

  it("picks the category the level actually teaches", () => {
    expect(categoryForLevel(level(1))).toBe("punches"); // jab, cross
    expect(categoryForLevel(level(3))).toBe("kicks"); // teeps
    expect(categoryForLevel(level(4))).toBe("kicks"); // round kicks
    expect(categoryForLevel(level(8))).toBe("knees");
    expect(categoryForLevel(level(11))).toBe("elbows");
  });

  it("breaks a tie toward the technique the level leads with", () => {
    // Level 10 is three punches and two kicks — the punches lead and win.
    expect(categoryForLevel(level(10))).toBe("punches");
  });

  it("reuses the Learn section's own artwork rather than a second mapping", () => {
    const learnKicks = CATEGORY_META.find((m) => m.key === "kicks")!;
    expect(artworkForLevel(level(4)).iconPath).toBe(learnKicks.iconPath);
  });
});

describe("progress store", () => {
  beforeEach(installLocalStorage);

  it("starts with only the first level open", () => {
    expect(isLevelUnlocked(FOUNDATIONS.id, 1)).toBe(true);
    expect(isLevelUnlocked(FOUNDATIONS.id, 2)).toBe(false);
    expect(nextLevelId(FOUNDATIONS)).toBe(1);
  });

  it("opens the next level once the previous one clears", () => {
    markLevelCleared(FOUNDATIONS.id, 1);
    expect(isLevelCleared(FOUNDATIONS.id, 1)).toBe(true);
    expect(isLevelUnlocked(FOUNDATIONS.id, 2)).toBe(true);
    expect(isLevelUnlocked(FOUNDATIONS.id, 3)).toBe(false);
    expect(nextLevelId(FOUNDATIONS)).toBe(2);
  });

  it("reports a first clear once, and replays as replays", () => {
    expect(markLevelCleared(FOUNDATIONS.id, 1)).toBe(true);
    expect(markLevelCleared(FOUNDATIONS.id, 1)).toBe(false);
    expect(markLevelCleared(FOUNDATIONS.id, 1)).toBe(false);
  });

  it("keeps the original clear date across replays", () => {
    markLevelCleared(FOUNDATIONS.id, 1);
    const first = JSON.parse(
      localStorage.getItem("shotcaller_roadmap_progress")!
    ).paths.foundations.levels["1"].firstClearedAt;
    markLevelCleared(FOUNDATIONS.id, 1);
    const after = JSON.parse(
      localStorage.getItem("shotcaller_roadmap_progress")!
    ).paths.foundations.levels["1"];
    expect(after.firstClearedAt).toBe(first);
    expect(after.sessions).toBe(2);
  });

  it("never walks the highest-cleared marker backwards on a replay", () => {
    markLevelCleared(FOUNDATIONS.id, 1);
    markLevelCleared(FOUNDATIONS.id, 2);
    markLevelCleared(FOUNDATIONS.id, 1);
    expect(nextLevelId(FOUNDATIONS)).toBe(3);
  });

  it("graduates only when every core level is cleared", () => {
    const core = FOUNDATIONS.levels.filter((l) => !l.bonus);
    core.slice(0, -1).forEach((l) => markLevelCleared(FOUNDATIONS.id, l.id));
    expect(hasGraduated(FOUNDATIONS)).toBe(false);
    markLevelCleared(FOUNDATIONS.id, core[core.length - 1]!.id);
    expect(hasGraduated(FOUNDATIONS)).toBe(true);
  });

  it("does not need the bonus level to graduate", () => {
    FOUNDATIONS.levels
      .filter((l) => !l.bonus)
      .forEach((l) => markLevelCleared(FOUNDATIONS.id, l.id));
    expect(hasGraduated(FOUNDATIONS)).toBe(true);
    expect(isLevelCleared(FOUNDATIONS.id, 11)).toBe(false);
  });

  it("summarises an untouched path as not started", () => {
    const s = pathSummary(FOUNDATIONS);
    expect(s.started).toBe(false);
    expect(s.nextLevelId).toBe(1);
    expect(s.levelsCleared).toBe(0);
    expect(s.known).toBe(0);
    expect(s.percent).toBe(0);
    expect(s.totalLevels).toBe(10);
    expect(s.total).toBe(32);
  });

  it("tracks the vocabulary as levels are cleared", () => {
    // This is what the home card reads — it must move with real progress.
    markLevelCleared(FOUNDATIONS.id, 1);
    let s = pathSummary(FOUNDATIONS);
    expect(s.started).toBe(true);
    expect(s.nextLevelId).toBe(2);
    expect(s.known).toBe(2); // jab, cross
    expect(s.percent).toBe(6);

    markLevelCleared(FOUNDATIONS.id, 2);
    markLevelCleared(FOUNDATIONS.id, 3);
    s = pathSummary(FOUNDATIONS);
    expect(s.nextLevelId).toBe(4);
    expect(s.levelsCleared).toBe(3);
    expect(s.known).toBe(6); // + both hooks, both teeps
  });

  it("reads 32 of 32 at graduation without the bonus overflowing it", () => {
    FOUNDATIONS.levels
      .filter((l) => !l.bonus)
      .forEach((l) => markLevelCleared(FOUNDATIONS.id, l.id));
    expect(pathSummary(FOUNDATIONS)).toMatchObject({
      graduated: true,
      known: 32,
      total: 32,
      percent: 100,
      levelsCleared: 10,
    });

    // Clearing the bonus elbows must not push the count past its own total.
    markLevelCleared(FOUNDATIONS.id, 11);
    const s = pathSummary(FOUNDATIONS);
    expect(s.known).toBe(32);
    expect(s.percent).toBe(100);
    expect(s.levelsCleared).toBe(10);
  });

  it("survives a corrupt progress value", () => {
    localStorage.setItem("shotcaller_roadmap_progress", "{not json");
    expect(isLevelCleared(FOUNDATIONS.id, 1)).toBe(false);
    expect(nextLevelId(FOUNDATIONS)).toBe(1);
  });
});

describe("guided sessions in the workout log", () => {
  const charm = (id: string) => ACHIEVEMENT_CHARMS.find((c) => c.id === id)!;

  const roadmapLog = (
    levelId: number,
    status = "completed"
  ): WorkoutLogLite => ({
    timestamp: new Date().toISOString(),
    emphases: [roadmapLogLabel(level(levelId))],
    roundsCompleted: 3,
    status,
    roadmap: { pathId: FOUNDATIONS.id, levelId },
  });

  it("labels a session with the level it drilled", () => {
    expect(roadmapLogLabel(level(3))).toBe("Start Here · Level 3");
  });

  it("earns the first-step charm from a cleared level 1", () => {
    expect(charm("first_step").isEarned([roadmapLog(1)])).toBe(true);
    expect(charm("first_step").isEarned([roadmapLog(2)])).toBe(false);
  });

  it("does not count an abandoned level as cleared", () => {
    expect(charm("first_step").isEarned([roadmapLog(1, "abandoned")])).toBe(
      false
    );
  });

  it("cannot farm a path charm by replaying one level", () => {
    const fiveReplays = [1, 1, 1, 1, 1].map(() => roadmapLog(1));
    expect(charm("half_the_alphabet").isEarned(fiveReplays)).toBe(false);
    expect(charm("half_the_alphabet").progress!(fiveReplays).current).toBe(1);

    const fiveLevels = [1, 2, 3, 4, 5].map((id) => roadmapLog(id));
    expect(charm("half_the_alphabet").isEarned(fiveLevels)).toBe(true);
  });

  it("graduates only on all ten core levels", () => {
    const nine = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((id) => roadmapLog(id));
    expect(charm("graduate").isEarned(nine)).toBe(false);
    expect(charm("graduate").progress!(nine)).toEqual({
      current: 9,
      target: 10,
    });
    expect(charm("graduate").isEarned([...nine, roadmapLog(10)])).toBe(true);
  });

  it("keeps guided levels out of the distinct-styles count", () => {
    // Otherwise a beginner would earn "Jack of All Trades" — five distinct
    // styles — without ever having picked a style.
    const logs = [1, 2, 3, 4, 5].map((id) => roadmapLog(id));
    expect(charm("jack_of_all_trades").isEarned(logs)).toBe(false);
    expect(charm("jack_of_all_trades").progress!(logs).current).toBe(0);
  });

  it("still counts guided sessions toward volume charms and streaks", () => {
    // The session really happened — it belongs in the history like any other.
    expect(charm("first_blood").isEarned([roadmapLog(1)])).toBe(true);
  });
});
