import { describe, expect, it } from "vitest";

import { isGrandfatheredByOriginalVersion } from "@/features/entitlement/originalVersion";

// iOS grandfathering by the originally-purchased CFBundleVersion.
//
// The build number of the first free iOS release. Anyone whose original build
// is below it bought the app while it still cost money.
const FLIP_BUILD = 57;

describe("grandfathering by original iOS build", () => {
  it("grandfathers someone who bought an earlier build", () => {
    expect(isGrandfatheredByOriginalVersion("56", FLIP_BUILD)).toBe(true);
    expect(isGrandfatheredByOriginalVersion("52", FLIP_BUILD)).toBe(true);
    // The Xcode project's own default CFBundleVersion, used before CI took
    // over build numbering.
    expect(isGrandfatheredByOriginalVersion("1", FLIP_BUILD)).toBe(true);
  });

  it("does not grandfather someone who arrived on the free build or later", () => {
    expect(isGrandfatheredByOriginalVersion("57", FLIP_BUILD)).toBe(false);
    expect(isGrandfatheredByOriginalVersion("58", FLIP_BUILD)).toBe(false);
    expect(isGrandfatheredByOriginalVersion("120", FLIP_BUILD)).toBe(false);
  });

  it("never grandfathers a sandbox receipt", () => {
    // Apple returns exactly "1.0" in the sandbox environment, and App Review
    // runs in sandbox. Parsing it naively yields 1, which is below any real
    // transition build — the reviewer would be silently granted Pro, never see
    // the paywall, and reject the IAPs as untestable. This single assertion is
    // the difference between a passing and a rejected iOS submission.
    expect(isGrandfatheredByOriginalVersion("1.0", FLIP_BUILD)).toBe(false);
  });

  it("still honours a plain '1', which is a real build number", () => {
    // Guards the sandbox check against over-reach: "1" and "1.0" must not be
    // treated as the same thing.
    expect(isGrandfatheredByOriginalVersion("1", FLIP_BUILD)).toBe(true);
  });

  it("grants nothing before the transition build is configured", () => {
    expect(isGrandfatheredByOriginalVersion("52", null)).toBe(false);
    expect(isGrandfatheredByOriginalVersion(null, null)).toBe(false);
  });

  it("never grandfathers on a missing or unusable value", () => {
    // Android returns null for this field, and a failed lookup must not be
    // read as "very old".
    expect(isGrandfatheredByOriginalVersion(null, FLIP_BUILD)).toBe(false);
    expect(isGrandfatheredByOriginalVersion(undefined, FLIP_BUILD)).toBe(false);
    expect(isGrandfatheredByOriginalVersion("", FLIP_BUILD)).toBe(false);
    expect(isGrandfatheredByOriginalVersion("   ", FLIP_BUILD)).toBe(false);
    expect(isGrandfatheredByOriginalVersion("not-a-build", FLIP_BUILD)).toBe(
      false
    );
    expect(isGrandfatheredByOriginalVersion("0", FLIP_BUILD)).toBe(false);
    expect(isGrandfatheredByOriginalVersion("-5", FLIP_BUILD)).toBe(false);
  });

  it("tolerates surrounding whitespace", () => {
    expect(isGrandfatheredByOriginalVersion("  52  ", FLIP_BUILD)).toBe(true);
    expect(isGrandfatheredByOriginalVersion(" 1.0 ", FLIP_BUILD)).toBe(false);
  });
});
