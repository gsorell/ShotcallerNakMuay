import { describe, expect, it } from "vitest";

import {
  BLEND_ALL,
  DEFAULT_ROUND_STRUCTURE,
  FASTEST_PACE,
  SLOWEST_PACE,
  buildRoundPool,
  describeRound,
  finisherSeconds,
  isDefaultStructure,
  paceFactors,
  pickFromShares,
  planRounds,
  planVaries,
  reconcileStyleOrder,
  sanitizeRoundStructure,
  structureSummary,
  type RoundStructure,
} from "@/features/workout/utils/roundPlan";
import { generateTechniquePool } from "@/utils/techniqueUtils";

const structure = (patch: Partial<RoundStructure> = {}): RoundStructure => ({
  ...DEFAULT_ROUND_STRUCTURE,
  ...patch,
});

const plan = (
  patch: Partial<RoundStructure>,
  styles: string[],
  roundsCount: number,
  addCalisthenics = false
) =>
  planRounds({
    structure: structure(patch),
    styles,
    roundsCount,
    addCalisthenics,
  });

const stylesOf = (rounds: ReturnType<typeof planRounds>) =>
  rounds.map((r) => r.styles.join("+"));

// A big style and a small one, which is the case blending has to get right.
const groups = {
  big: {
    label: "big",
    singles: ["B1", "B2", "B3", "B4", "B5", "B6"],
    combos: ["B7", "B8", "B9", "B10", "B11", "B12"],
  },
  small: { label: "small", singles: ["S1"], combos: ["S2"] },
  combosOnly: { label: "combosOnly", singles: [], combos: ["C1", "C2"] },
  calisthenics: { singles: ["Burpee", "High Knees"], combos: [] },
} as any;
const index = Object.fromEntries(Object.keys(groups).map((k) => [k, k]));

describe("the order styles were picked in", () => {
  it("appends a newly selected style to the end", () => {
    const first = reconcileStyleOrder([], { sok: true } as any);
    const second = reconcileStyleOrder(first, { khao: true, sok: true } as any);
    // `khao` comes first in the map; it was still picked second.
    expect(second).toEqual(["sok", "khao"]);
  });

  it("drops a deselected style and keeps the rest in place", () => {
    expect(
      reconcileStyleOrder(["sok", "khao", "mat"], {
        sok: true,
        khao: false,
        mat: true,
      } as any)
    ).toEqual(["sok", "mat"]);
  });

  it("never treats a mode as a style", () => {
    expect(
      reconcileStyleOrder([], { timer_only: true, freestyle: true } as any)
    ).toEqual([]);
  });
});

describe("planning rounds", () => {
  it("leaves a standard session as the same round every time", () => {
    const rounds = plan({}, ["a", "b"], 3);
    expect(stylesOf(rounds)).toEqual(["a+b", "a+b", "a+b"]);
    expect(planVaries(rounds)).toBe(false);
    expect(rounds.every((r) => r.content === "all" && r.paceFactor === 1)).toBe(
      true
    );
  });

  it("gives each style a round and cycles when there are rounds to spare", () => {
    expect(stylesOf(plan({ mixMode: "by_round" }, ["a", "b"], 5))).toEqual([
      "a",
      "b",
      "a",
      "b",
      "a",
    ]);
  });

  it("blends the leftovers into the last round rather than dropping them", () => {
    expect(
      stylesOf(plan({ mixMode: "by_round" }, ["a", "b", "c", "d", "e"], 3))
    ).toEqual(["a", "b", "c+d+e"]);
  });

  it("ignores a mix mode when there is only one style to mix", () => {
    const rounds = plan({ mixMode: "by_round" }, ["a"], 3);
    expect(stylesOf(rounds)).toEqual(["a", "a", "a"]);
    expect(planVaries(rounds)).toBe(false);
  });

  it("lets a round be set by hand, leaving the rest to the rotation", () => {
    expect(
      stylesOf(
        plan(
          { mixMode: "by_round", customRounds: ["b", null, BLEND_ALL] },
          ["a", "b"],
          4
        )
      )
    ).toEqual(["b", "b", "a+b", "b"]);
  });

  it("returns a round to the rotation when its style is no longer selected", () => {
    expect(
      stylesOf(
        plan({ mixMode: "by_round", customRounds: ["gone", "a"] }, ["a", "b"], 2)
      )
    ).toEqual(["a", "a"]);
  });

  it("ignores hand-set rounds while blending", () => {
    expect(
      stylesOf(plan({ mixMode: "blend", customRounds: ["b"] }, ["a", "b"], 2))
    ).toEqual(["a+b", "a+b"]);
  });

  it("reads the retired custom mode as the default", () => {
    expect(sanitizeRoundStructure({ mixMode: "custom" }).mixMode).toBe("blend");
  });

  it("makes round 1 singles-only for a warm-up, and only round 1", () => {
    expect(plan({ buildUp: true }, ["a"], 3).map((r) => r.content)).toEqual([
      "singles",
      "all",
      "all",
    ]);
    // One round has nothing to warm up for.
    expect(plan({ buildUp: true }, ["a"], 1)[0]!.content).toBe("all");
  });

  it("hands the last round to calisthenics and plans styles over the rest", () => {
    const rounds = plan(
      { mixMode: "by_round", calisthenics: "final_round" },
      ["a", "b"],
      3,
      true
    );
    expect(stylesOf(rounds)).toEqual(["a", "b", ""]);
    expect(rounds.map((r) => r.calisthenics)).toEqual(["none", "none", "only"]);
  });

  it("mixes calisthenics in when a one-round session has no last round to give", () => {
    const rounds = plan({ calisthenics: "final_round" }, ["a"], 1, true);
    expect(rounds).toHaveLength(1);
    expect(rounds[0]!.calisthenics).toBe("sprinkled");
  });

  it("leaves calisthenics out entirely when they are switched off", () => {
    const rounds = plan({ calisthenics: "finisher" }, ["a"], 3, false);
    expect(rounds.every((r) => r.calisthenics === "none")).toBe(true);
    expect(rounds).toHaveLength(3);
  });

  it("always plans exactly as many rounds as the session has", () => {
    for (const rounds of [1, 2, 3, 7, 20]) {
      expect(
        plan(
          { mixMode: "by_round", calisthenics: "final_round", buildUp: true },
          ["a", "b", "c"],
          rounds,
          true
        )
      ).toHaveLength(rounds);
    }
  });
});

describe("pace across rounds", () => {
  it("is flat when steady, and for a single round", () => {
    expect(paceFactors("steady", 4)).toEqual([1, 1, 1, 1]);
    expect(paceFactors("ramp", 1)).toEqual([1]);
  });

  it("ramps from easiest to fastest", () => {
    const pace = paceFactors("ramp", 4);
    expect(pace[0]).toBe(SLOWEST_PACE);
    expect(pace[3]).toBe(FASTEST_PACE);
    expect([...pace].sort((a, b) => b - a)).toEqual(pace);
  });

  it("peaks in the middle for a pyramid", () => {
    const pace = paceFactors("pyramid", 5);
    expect(pace[2]).toBe(FASTEST_PACE);
    expect(pace[0]).toBe(SLOWEST_PACE);
    expect(pace[4]).toBe(SLOWEST_PACE);
  });

  it("never produces a pace the callout loop cannot schedule", () => {
    for (const shape of ["steady", "ramp", "pyramid"] as const) {
      for (const n of [1, 2, 3, 20]) {
        for (const f of paceFactors(shape, n)) {
          expect(Number.isFinite(f) && f > 0).toBe(true);
        }
      }
    }
  });
});

describe("the calisthenics finisher window", () => {
  it("is thirty seconds of a normal round", () => {
    expect(finisherSeconds(3)).toBe(30);
  });
  it("shrinks with a short round", () => {
    expect(finisherSeconds(1)).toBe(20);
  });
  it("is skipped when the round is too short to split", () => {
    expect(finisherSeconds(0.25)).toBe(0);
  });
});

describe("building a round's pool", () => {
  it("builds a single-style round exactly as the app always has", () => {
    const built = buildRoundPool(
      groups,
      { styles: ["big"], content: "all", calisthenics: "sprinkled", paceFactor: 1 },
      index
    );
    expect(built.shares).toBeNull();
    expect(built.flat).toEqual(
      generateTechniquePool(groups, { big: true } as any, true, index)
    );
  });

  it("gives blended styles an equal share whatever their size", () => {
    const built = buildRoundPool(
      groups,
      { styles: ["big", "small"], content: "all", calisthenics: "none", paceFactor: 1 },
      index
    );
    expect(built.shares).toHaveLength(2);
    expect(built.shares![0]!.share).toBeCloseTo(0.5);
    expect(built.shares![1]!.share).toBeCloseTo(0.5);
    // Nothing is lost from the in-order walk.
    expect(built.flat).toHaveLength(14);
  });

  it("alternates styles when the pool is read in order", () => {
    const built = buildRoundPool(
      groups,
      { styles: ["big", "small"], content: "all", calisthenics: "none", paceFactor: 1 },
      index
    );
    expect(built.flat.slice(0, 4).map((t) => t.text)).toEqual([
      "B1",
      "S1",
      "B2",
      "S2",
    ]);
  });

  it("keeps calisthenics at the share of the list they always had", () => {
    const built = buildRoundPool(
      groups,
      { styles: ["big", "small"], content: "all", calisthenics: "sprinkled", paceFactor: 1 },
      index
    );
    const cal = built.shares!.find((s) => s.entries[0]!.style === "calisthenics")!;
    expect(cal.share).toBeCloseTo(2 / 16);
    const total = built.shares!.reduce((sum, s) => sum + s.share, 0);
    expect(total).toBeCloseTo(1);
  });

  it("calls only singles in a warm-up round", () => {
    const built = buildRoundPool(
      groups,
      { styles: ["big"], content: "singles", calisthenics: "none", paceFactor: 1 },
      index
    );
    expect(built.flat.map((t) => t.text)).toEqual([
      "B1",
      "B2",
      "B3",
      "B4",
      "B5",
      "B6",
    ]);
  });

  it("still gives a combinations-only style its warm-up round", () => {
    const built = buildRoundPool(
      groups,
      { styles: ["combosOnly"], content: "singles", calisthenics: "none", paceFactor: 1 },
      index
    );
    expect(built.flat.map((t) => t.text)).toEqual(["C1", "C2"]);
  });

  it("calls nothing but calisthenics in a calisthenics round", () => {
    const built = buildRoundPool(
      groups,
      { styles: [], content: "all", calisthenics: "only", paceFactor: 1 },
      index
    );
    expect(built.flat.map((t) => t.text)).toEqual(["Burpee", "High Knees"]);
    expect(built.flat.every((t) => t.style === "calisthenics")).toBe(true);
  });
});

describe("picking by share", () => {
  const shares = [
    { entries: [{ text: "A", style: "a" }], share: 0.5 },
    { entries: [{ text: "B", style: "b" }], share: 0.5 },
  ];

  it("picks the lane the roll lands in", () => {
    const rolls = (...values: number[]) => () => values.shift() ?? 0;
    expect(pickFromShares(shares, rolls(0.1, 0))!.text).toBe("A");
    expect(pickFromShares(shares, rolls(0.9, 0))!.text).toBe("B");
  });

  it("splits evenly between a big style and a small one", () => {
    const built = buildRoundPool(
      groups,
      { styles: ["big", "small"], content: "all", calisthenics: "none", paceFactor: 1 },
      index
    );
    // Deterministic generator, so the test cannot flake.
    let seed = 12345;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    let small = 0;
    const draws = 4000;
    for (let i = 0; i < draws; i += 1) {
      if (pickFromShares(built.shares!, rng)!.style === "small") small += 1;
    }
    // Off the flat pool this would be 2 in 14, about 14%.
    expect(small / draws).toBeGreaterThan(0.45);
    expect(small / draws).toBeLessThan(0.55);
  });

  it("returns nothing rather than throwing on an empty set", () => {
    expect(pickFromShares([])).toBeUndefined();
  });
});

describe("structure settings", () => {
  it("reads garbage as the default", () => {
    expect(sanitizeRoundStructure(null)).toEqual(DEFAULT_ROUND_STRUCTURE);
    expect(sanitizeRoundStructure("nope")).toEqual(DEFAULT_ROUND_STRUCTURE);
    expect(
      sanitizeRoundStructure({ mixMode: "sideways", intensity: 7 })
    ).toEqual(DEFAULT_ROUND_STRUCTURE);
  });

  it("keeps what is valid", () => {
    const kept = sanitizeRoundStructure({
      mixMode: "by_round",
      buildUp: true,
      customRounds: ["a", 3, "", "b"],
    });
    expect(kept.mixMode).toBe("by_round");
    expect(kept.buildUp).toBe(true);
    expect(kept.customRounds).toEqual(["a", null, null, "b"]);
  });

  it("knows the default from anything else", () => {
    expect(isDefaultStructure(structure())).toBe(true);
    expect(isDefaultStructure(structure({ buildUp: true }))).toBe(false);
    expect(isDefaultStructure(structure({ between: "jab" }))).toBe(false);
  });

  it("keeps a between-callouts choice and drops an unknown one", () => {
    expect(sanitizeRoundStructure({ between: "check" }).between).toBe("check");
    expect(sanitizeRoundStructure({ between: "either" }).between).toBe(
      "either"
    );
    expect(sanitizeRoundStructure({ between: "hook" }).between).toBe("off");
    expect(structureSummary(structure({ between: "jab" }), 1, false)).toBe(
      "Jab between"
    );
  });

  it("summarises itself in one line", () => {
    expect(structureSummary(structure(), 1, false)).toBe("Standard");
    expect(structureSummary(structure(), 2, false)).toBe("Blended");
    expect(
      structureSummary(
        structure({ mixMode: "by_round", calisthenics: "finisher" }),
        3,
        true
      )
    ).toBe("One style per round · Finisher");
    // A placement means nothing while calisthenics are off.
    expect(
      structureSummary(structure({ calisthenics: "finisher" }), 1, false)
    ).toBe("Standard");
  });

  it("describes a round in words", () => {
    const d = describeRound(
      { styles: ["a", "b"], content: "singles", calisthenics: "finisher", paceFactor: 0.9 },
      (k) => k.toUpperCase()
    );
    expect(d.title).toBe("A + B");
    expect(d.notes).toEqual([
      "Single techniques only",
      "Calisthenics finisher",
      "Faster pace",
    ]);
  });
});
