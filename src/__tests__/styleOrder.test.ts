import { describe, expect, it } from "vitest";

import { INITIAL_TECHNIQUES } from "@/constants/techniques";
import { CORE_ORDER } from "@/features/technique-editor/constants";
import { getSortedGroups } from "@/features/technique-editor/utils/groupSorting";
import { prependGroup, type TechniqueShape } from "@/utils/techniqueUtils";

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

describe("Manage Techniques ordering", () => {
  const custom = (label: string) =>
    ({ label, singles: ["Jab"], combos: [] }) as TechniqueShape;

  it("orders shipped groups exactly as CORE_ORDER does", () => {
    const sorted = getSortedGroups(shippedGroups()).map(([key]) => key);
    const expected = CORE_ORDER.filter(
      (key) =>
        key !== "timer_only" &&
        Object.prototype.hasOwnProperty.call(INITIAL_TECHNIQUES, key)
    );
    expect(sorted.filter((k) => expected.includes(k))).toEqual(expected);
  });

  it("leads with Nak Muay Newb when the user has no styles of their own", () => {
    const sorted = getSortedGroups(shippedGroups()).map(([key]) => key);
    expect(sorted[0]).toBe("newb");
  });

  it("puts the user's own styles ahead of the shipped ones", () => {
    // Deliberately unlike the home grid, which still leads with Nak Muay Newb:
    // this page is for editing your own styles, so burying a style you just
    // made under eighteen shipped ones is the wrong default here.
    const sorted = getSortedGroups({
      ...shippedGroups(),
      my_own_style: custom("My Own"),
    }).map(([key]) => key);

    expect(sorted[0]).toBe("my_own_style");
  });

  it("shows the user's own styles newest first", () => {
    // Carried by insertion order, which is why every path that adds a style
    // goes through prependGroup rather than spreading.
    let groups = shippedGroups();
    groups = prependGroup(groups, "older", custom("Older"));
    groups = prependGroup(groups, "newer", custom("Newer"));

    const sorted = getSortedGroups(groups).map(([key]) => key);
    expect(sorted.slice(0, 2)).toEqual(["newer", "older"]);
  });

  it("never lists the timer as an editable group", () => {
    const sorted = getSortedGroups(shippedGroups()).map(([key]) => key);
    expect(sorted).not.toContain("timer_only");
  });
});

describe("prependGroup", () => {
  it("puts the new key first and keeps the rest in order", () => {
    const next = prependGroup({ a: 1, b: 2 }, "c", 3);
    expect(Object.keys(next)).toEqual(["c", "a", "b"]);
  });

  it("moves an existing key to the front rather than duplicating it", () => {
    const next = prependGroup({ a: 1, b: 2, c: 3 }, "c", 9);
    expect(Object.keys(next)).toEqual(["c", "a", "b"]);
    expect(next["c"]).toBe(9);
  });

  it("does not mutate the original", () => {
    const original = { a: 1 };
    prependGroup(original, "b", 2);
    expect(Object.keys(original)).toEqual(["a"]);
  });
});
