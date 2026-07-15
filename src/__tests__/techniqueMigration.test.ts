import { describe, expect, it } from "vitest";
import { INITIAL_TECHNIQUES } from "../constants/techniques";
import { mergeTechniques } from "../features/technique-editor/hooks/useTechniqueData";

// The shipped defaults, as a user who has never customized anything would have
// them saved. Deep-cloned so tests can mutate freely.
const shippedCopy = () =>
  JSON.parse(JSON.stringify(INITIAL_TECHNIQUES)) as Record<string, any>;

// Stand-ins for "any core group"; `femur` doubles as a group the user's saved
// data predates, the way a newly shipped group would.
const MISSING = "femur";
const EDITED = "khao";

describe("technique migration on version bump", () => {
  it("adds newly shipped groups to existing saved data", () => {
    const stored = shippedCopy();
    delete stored[MISSING];
    const baseline = shippedCopy();
    delete baseline[MISSING];

    const merged = mergeTechniques(stored, baseline);

    expect(merged[MISSING]).toEqual(INITIAL_TECHNIQUES[MISSING]);
  });

  it("keeps user-created groups", () => {
    const stored = shippedCopy();
    stored.my_style = {
      label: "my_style",
      title: "My Style",
      singles: ["1"],
      combos: ["1 2"],
    };

    const merged = mergeTechniques(stored, shippedCopy());

    expect(merged.my_style).toEqual(stored.my_style);
  });

  it("keeps edits to a core group instead of overwriting them", () => {
    const stored = shippedCopy();
    stored[EDITED].combos = ["My Only Combo"];

    const merged = mergeTechniques(stored, shippedCopy());

    expect(merged[EDITED].combos).toEqual(["My Only Combo"]);
  });

  it("delivers updated content to a core group the user never touched", () => {
    // Baseline represents older shipped content; stored matches it exactly, so
    // the group is untouched and should pick up the newer default.
    const stored = shippedCopy();
    const baseline = shippedCopy();
    baseline[EDITED].combos = ["Old Shipped Combo"];
    stored[EDITED].combos = ["Old Shipped Combo"];

    const merged = mergeTechniques(stored, baseline);

    expect(merged[EDITED].combos).toEqual(INITIAL_TECHNIQUES[EDITED]!.combos);
  });

  it("preserves everything when no baseline exists (first run of the merge)", () => {
    const stored = shippedCopy();
    delete stored[MISSING];
    stored[EDITED].combos = ["Hand Written"];
    stored.my_style = {
      label: "my_style",
      title: "My Style",
      singles: [],
      combos: [],
    };

    const merged = mergeTechniques(stored, null);

    expect(merged[EDITED].combos).toEqual(["Hand Written"]);
    expect(merged.my_style).toEqual(stored.my_style);
    expect(merged[MISSING]).toEqual(INITIAL_TECHNIQUES[MISSING]);
  });

  it("is lossless when an untouched library upgrades to defaults with a new group", () => {
    // Saved data is the current defaults minus a group, which is the shape of
    // any release whose only content change is an addition.
    const saved = shippedCopy();
    delete saved[MISSING];

    const merged = mergeTechniques(saved, null);

    expect(merged).toEqual(INITIAL_TECHNIQUES);
  });
});
