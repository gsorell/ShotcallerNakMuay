import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { INITIAL_TECHNIQUES } from "@/constants/techniques";
import {
  CATEGORY_META,
  TECHNIQUE_LIBRARY,
} from "@/features/learn/data/techniqueLibrary";
import {
  ENTRIES_BY_CATEGORY,
  findOrphanedEntries,
  findUncoveredCallouts,
  getEntryForCallout,
  getStylesForEntry,
  isCalisthenicsOnly,
} from "@/features/learn/data/techniqueIndex";

describe("technique library integrity", () => {
  it("has a unique slug for every entry", () => {
    const slugs = TECHNIQUE_LIBRARY.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("never maps the same callout to two different lessons", () => {
    const seen = new Map<string, string>();
    for (const entry of TECHNIQUE_LIBRARY) {
      for (const match of entry.matches) {
        const key = match.trim().toLowerCase().replace(/\s+/g, " ");
        const existing = seen.get(key);
        expect(
          existing,
          `"${match}" is claimed by both "${existing}" and "${entry.slug}"`
        ).toBeUndefined();
        seen.set(key, entry.slug);
      }
    }
  });

  it("gives every entry real teaching content", () => {
    for (const entry of TECHNIQUE_LIBRARY) {
      expect(entry.name, entry.slug).toBeTruthy();
      expect(entry.summary.length, entry.slug).toBeGreaterThan(40);
      expect(entry.keyPoints.length, entry.slug).toBeGreaterThanOrEqual(3);
      expect(entry.mistakes.length, entry.slug).toBeGreaterThanOrEqual(2);
      expect(entry.matches.length, entry.slug).toBeGreaterThan(0);
    }
  });

  it("points every category at artwork that actually exists", () => {
    // ImageWithFallback silently degrades to the emoji if the file 404s, so a
    // renamed asset would only show up as a visual regression. Catch it here.
    for (const meta of CATEGORY_META) {
      const file = resolve(__dirname, "../../public", meta.iconPath.slice(1));
      expect(existsSync(file), `${meta.key} → ${meta.iconPath}`).toBe(true);
      expect(meta.icon, `${meta.key} needs an emoji fallback`).toBeTruthy();
    }
  });

  it("puts every entry in a known category, and leaves no category empty", () => {
    const known = new Set(CATEGORY_META.map((c) => c.key));
    for (const entry of TECHNIQUE_LIBRARY) {
      expect(known.has(entry.category), entry.slug).toBe(true);
    }
    for (const meta of CATEGORY_META) {
      expect(ENTRIES_BY_CATEGORY[meta.key].length, meta.key).toBeGreaterThan(0);
    }
  });
});

describe("callout coverage", () => {
  it("explains every single-technique callout in every style", () => {
    // If this fails, someone added a technique to a style without adding a
    // lesson for it — either add an entry or extend an existing `matches`.
    expect(findUncoveredCallouts()).toEqual([]);
  });

  it("has no entry whose matches never appear in the callout data", () => {
    expect(findOrphanedEntries()).toEqual([]);
  });

  it("resolves callouts regardless of casing and spacing", () => {
    expect(getEntryForCallout("Left teep")?.slug).toBe("teep");
    expect(getEntryForCallout("LEFT TEEP")?.slug).toBe("teep");
    expect(getEntryForCallout("  Left   Teep ")?.slug).toBe("teep");
    expect(getEntryForCallout("1")?.slug).toBe("jab");
    expect(getEntryForCallout("Jab")?.slug).toBe("jab");
    expect(getEntryForCallout("not a technique")).toBeUndefined();
  });
});

describe("style attribution", () => {
  it("attributes the jab to the beginner style", () => {
    const styles = getStylesForEntry("jab").map((s) => s.key);
    expect(styles).toContain("newb");
  });

  it("lists each style at most once per lesson", () => {
    for (const entry of TECHNIQUE_LIBRARY) {
      const keys = getStylesForEntry(entry.slug).map((s) => s.key);
      expect(new Set(keys).size, entry.slug).toBe(keys.length);
    }
  });

  it("only attributes styles that actually exist", () => {
    const valid = new Set(Object.keys(INITIAL_TECHNIQUES));
    for (const entry of TECHNIQUE_LIBRARY) {
      for (const style of getStylesForEntry(entry.slug)) {
        expect(valid.has(style.key), `${entry.slug} → ${style.key}`).toBe(true);
      }
    }
  });

  it("never offers calisthenics as a drill target", () => {
    // It is an "Add Calisthenics" advanced setting, not a selectable tile —
    // drilling it would select a style the user has no way to see or clear.
    for (const entry of TECHNIQUE_LIBRARY) {
      const keys = getStylesForEntry(entry.slug).map((s) => s.key);
      expect(keys, entry.slug).not.toContain("calisthenics");
    }
  });

  it("gives every lesson either a drill style or a calisthenics explanation", () => {
    for (const entry of TECHNIQUE_LIBRARY) {
      const drillable = getStylesForEntry(entry.slug).length > 0;
      expect(
        drillable || isCalisthenicsOnly(entry.slug),
        `${entry.slug} has no drill styles and is not calisthenics-only — the detail view would show no way to practise it`
      ).toBe(true);
    }
  });

  it("flags the conditioning lessons as calisthenics-only", () => {
    for (const entry of TECHNIQUE_LIBRARY.filter(
      (e) => e.category === "conditioning"
    )) {
      expect(isCalisthenicsOnly(entry.slug), entry.slug).toBe(true);
    }
  });
});
