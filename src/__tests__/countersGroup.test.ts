import { describe, expect, it } from "vitest";
import { INITIAL_TECHNIQUES } from "../constants/techniques";

const combos = (INITIAL_TECHNIQUES.counters!.combos ?? []) as string[];

// The group's defining rule: defense first, and the incoming attack is always
// named while numbers are only ever your own output. Asserted rather than the
// list's exact length, so the callouts stay editable.
describe("counters group", () => {
  it("opens every callout with a defensive technique", () => {
    const OPENERS =
      /^(Parry|Slip|Block|Catch|Check|Roll|Duck|Cover|Lean Back|Step Back|Frame|Long Guard|Push Off)/;
    expect(combos.filter((c) => !OPENERS.test(c))).toEqual([]);
  });

  it("never leads with a number, which would read as your own strike", () => {
    expect(combos.filter((c) => /^\d/.test(c))).toEqual([]);
  });

  it("covers every basic attack you have to answer", () => {
    const ATTACKS = [
      "Jab",
      "Cross",
      "Hook",
      "Uppercut",
      "Low Kick",
      "Body Kick",
      "Head Kick",
      "Teep",
      "Knee",
      "Elbow",
    ];
    const uncovered = ATTACKS.filter(
      (attack) => !combos.some((c) => c.includes(`the ${attack}`))
    );
    expect(uncovered).toEqual([]);
  });
});
