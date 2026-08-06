import { describe, expect, it } from "vitest";

import { isGrandfatheredByInstallTime } from "@/features/entitlement/installInfo";

// The Android grandfather check: a device that installed the app before the
// price flip installed it while the app still cost money, so that user paid.
//
// The failure modes are asymmetric and both bad, which is why this is pinned
// down so tightly: granting too widely gives the product away for free, and
// granting too narrowly locks a paying customer out of what they bought.

const FLIP = Date.parse("2026-08-13T17:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("grandfathering by install time", () => {
  it("grandfathers an install from before the flip", () => {
    expect(isGrandfatheredByInstallTime(FLIP - DAY, FLIP)).toBe(true);
    expect(isGrandfatheredByInstallTime(FLIP - 365 * DAY, FLIP)).toBe(true);
  });

  it("does not grandfather an install from after the flip", () => {
    expect(isGrandfatheredByInstallTime(FLIP + 1000, FLIP)).toBe(false);
    expect(isGrandfatheredByInstallTime(FLIP + 30 * DAY, FLIP)).toBe(false);
  });

  it("treats the exact flip instant as not grandfathered", () => {
    // The flip date is set slightly after the real switch, so the boundary
    // itself lands in already-free territory.
    expect(isGrandfatheredByInstallTime(FLIP, FLIP)).toBe(false);
  });

  it("grants nothing before the flip date is configured", () => {
    // A null transition date means "not flipped yet" — it must never be read
    // as "grandfather everyone".
    expect(isGrandfatheredByInstallTime(FLIP - DAY, null)).toBe(false);
    expect(isGrandfatheredByInstallTime(null, null)).toBe(false);
  });

  it("never grandfathers on an unknown install time", () => {
    // A plugin failure, or a non-Android platform, resolves to null. Treating
    // that as a very old install would unlock the app for every user.
    expect(isGrandfatheredByInstallTime(null, FLIP)).toBe(false);
  });

  it("rejects nonsense install times instead of trusting them", () => {
    expect(isGrandfatheredByInstallTime(0, FLIP)).toBe(false);
    expect(isGrandfatheredByInstallTime(-1, FLIP)).toBe(false);
    expect(isGrandfatheredByInstallTime(Number.NaN, FLIP)).toBe(false);
    expect(isGrandfatheredByInstallTime(Number.POSITIVE_INFINITY, FLIP)).toBe(
      false
    );
    // Negative infinity is "infinitely old", which is exactly the sort of
    // value that must not be allowed to satisfy the comparison.
    expect(isGrandfatheredByInstallTime(Number.NEGATIVE_INFINITY, FLIP)).toBe(
      false
    );
  });
});
