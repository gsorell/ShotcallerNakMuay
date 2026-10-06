import { describe, expect, it } from "vitest";

import { INITIAL_TECHNIQUES } from "@/constants/techniques";
import { CORE_ORDER } from "@/features/technique-editor/constants";
import { getSortedGroups } from "@/features/technique-editor/utils/groupSorting";
import {
  applyDisplayOrder,
  moveStyleKey,
} from "@/features/technique-editor/utils/styleDisplayOrder";
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

  it("lists the user's own styles after the shipped ones, as the home grid does", () => {
    // The two screens have to agree: a style is moved up or down this list a
    // row at a time, which only means something if it is the home order.
    const sorted = getSortedGroups({
      ...shippedGroups(),
      my_own_style: custom("My Own"),
    }).map(([key]) => key);

    expect(sorted[0]).toBe("newb");
    expect(sorted.indexOf("my_own_style")).toBeGreaterThan(
      sorted.indexOf("southpaw")
    );
  });

  it("keeps Freestyle last, outside the order", () => {
    // Freestyle ships no technique data, so it only has a row here if a
    // library was saved with one. Where it does, it is a mode, not a style.
    const sorted = getSortedGroups(
      {
        ...shippedGroups(),
        freestyle: custom("Freestyle"),
        my_own_style: custom("My Own"),
      },
      ["my_own_style", "freestyle", "newb"]
    ).map(([key]) => key);
    expect(sorted[sorted.length - 1]).toBe("freestyle");
  });

  it("follows a saved order", () => {
    const sorted = getSortedGroups(shippedGroups(), ["tae", "newb"]).map(
      ([key]) => key
    );
    // Everything the saved order does not name leads; the named ones follow
    // in the order given.
    const styles = sorted.filter((k) => k !== "freestyle");
    expect(styles.slice(-2)).toEqual(["tae", "newb"]);
  });

  it("shows the user's own styles newest first", () => {
    // Carried by insertion order, which is why every path that adds a style
    // goes through prependGroup rather than spreading.
    let groups = shippedGroups();
    groups = prependGroup(groups, "older", custom("Older"));
    groups = prependGroup(groups, "newer", custom("Newer"));

    const sorted = getSortedGroups(groups).map(([key]) => key);
    expect(sorted.indexOf("newer")).toBe(sorted.indexOf("older") - 1);
  });

  it("never lists the timer as an editable group", () => {
    const sorted = getSortedGroups(shippedGroups()).map(([key]) => key);
    expect(sorted).not.toContain("timer_only");
  });
});

describe("the user's own home-screen order", () => {
  const tiles = (...keys: string[]) => keys.map((key) => ({ key }));
  const keysOf = (items: { key: string }[]) => items.map((i) => i.key);

  it("changes nothing until an order has been saved", () => {
    const items = tiles("newb", "mat", "tae", "timer_only", "freestyle");
    expect(keysOf(applyDisplayOrder(items, []))).toEqual(keysOf(items));
  });

  it("puts styles in the saved order", () => {
    expect(
      keysOf(applyDisplayOrder(tiles("newb", "mat", "tae"), ["tae", "newb", "mat"]))
    ).toEqual(["tae", "newb", "mat"]);
  });

  it("leads with a style the saved order has never seen", () => {
    // Made or imported after the order was saved: it should be noticed, not
    // filed at the bottom of a list arranged by hand.
    expect(
      keysOf(applyDisplayOrder(tiles("newb", "mat", "brand_new"), ["mat", "newb"]))
    ).toEqual(["brand_new", "mat", "newb"]);
  });

  it("ignores a saved style that no longer exists", () => {
    expect(
      keysOf(applyDisplayOrder(tiles("newb", "mat"), ["deleted", "mat", "newb"]))
    ).toEqual(["mat", "newb"]);
  });

  it("keeps the modes at the end whatever the order says", () => {
    expect(
      keysOf(
        applyDisplayOrder(tiles("newb", "mat", "timer_only", "freestyle"), [
          "freestyle",
          "mat",
          "newb",
        ])
      )
    ).toEqual(["mat", "newb", "timer_only", "freestyle"]);
  });

  it("moves a style one place at a time", () => {
    expect(moveStyleKey(["a", "b", "c"], "c", "up")).toEqual(["a", "c", "b"]);
    expect(moveStyleKey(["a", "b", "c"], "a", "down")).toEqual(["b", "a", "c"]);
  });

  it("leaves a style at the end of the list where it is", () => {
    expect(moveStyleKey(["a", "b"], "a", "up")).toEqual(["a", "b"]);
    expect(moveStyleKey(["a", "b"], "b", "down")).toEqual(["a", "b"]);
    expect(moveStyleKey(["a", "b"], "zzz", "up")).toEqual(["a", "b"]);
  });

  it("never loses or duplicates a style", () => {
    const items = tiles("a", "b", "c", "d");
    const out = keysOf(applyDisplayOrder(items, ["c", "c", "zzz", "a"]));
    expect([...out].sort()).toEqual(["a", "b", "c", "d"]);
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
