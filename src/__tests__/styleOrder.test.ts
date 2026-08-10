import { describe, expect, it } from "vitest";

import { INITIAL_TECHNIQUES } from "@/constants/techniques";
import { CORE_ORDER } from "@/features/technique-editor/constants";
import { getSortedGroups } from "@/features/technique-editor/utils/groupSorting";
import type { TechniqueShape } from "@/utils/techniqueUtils";

// Modes rather than fighting styles: they carry no technique data of their own.
const MODES = new Set(["timer_only", "freestyle"]);

const shippedGroups = () =>
  Object.fromEntries(
    Object.entries(INITIAL_TECHNIQUES).map(([k, v]) => [k, v as TechniqueShape])
  ) as Record<string, TechniqueShape>;

describe("canonical style order", () => {
  it("names only styles that still exist", () => {
    // This is what drifted before: CORE_ORDER still listed `muay_tech` long
    // after the style was removed, so it silently sorted nothing.
    const unknown = CORE_ORDER.filter(
      (key) =>
        !MODES.has(key) &&
        !Object.prototype.hasOwnProperty.call(INITIAL_TECHNIQUES, key)
    );
    expect(unknown).toEqual([]);
  });

  it("covers every shipped style", () => {
    const missing = Object.keys(INITIAL_TECHNIQUES).filter(
      (key) => key !== "calisthenics" && !CORE_ORDER.includes(key)
    );
    expect(
      missing,
      "a shipped style with no place in the order falls to the end of both screens"
    ).toEqual([]);
  });

  it("lists no style twice", () => {
    expect(new Set(CORE_ORDER).size).toBe(CORE_ORDER.length);
  });

  it("leads with Nak Muay Newb", () => {
    // The beginner's door has to be the first thing a new user sees.
    expect(CORE_ORDER[0]).toBe("newb");
  });

  it("puts the modes last", () => {
    const tail = CORE_ORDER.slice(-2);
    expect(new Set(tail)).toEqual(new Set(["timer_only", "freestyle"]));
  });
});

describe("Manage Techniques matches the home screen", () => {
  it("orders shipped groups exactly as CORE_ORDER does", () => {
    const sorted = getSortedGroups(shippedGroups()).map(([key]) => key);
    const expected = CORE_ORDER.filter(
      (key) =>
        key !== "timer_only" &&
        Object.prototype.hasOwnProperty.call(INITIAL_TECHNIQUES, key)
    );
    expect(sorted.filter((k) => expected.includes(k))).toEqual(expected);
  });

  it("leads with Nak Muay Newb, like the home screen does", () => {
    const sorted = getSortedGroups(shippedGroups()).map(([key]) => key);
    expect(sorted[0]).toBe("newb");
  });

  it("keeps user-created groups after the shipped ones", () => {
    const withCustom = {
      ...shippedGroups(),
      my_own_style: { label: "My Own", singles: ["Jab"], combos: [] },
    } as Record<string, TechniqueShape>;
    const sorted = getSortedGroups(withCustom).map(([key]) => key);
    expect(sorted[sorted.length - 1]).toBe("my_own_style");
  });

  it("never lists the timer as an editable group", () => {
    const sorted = getSortedGroups(shippedGroups()).map(([key]) => key);
    expect(sorted).not.toContain("timer_only");
  });
});
