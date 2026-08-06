import { describe, expect, it } from "vitest";

import {
  isLegacyClaimAvailable,
  legacyClaimDaysRemaining,
  validateOrderId,
} from "@/features/entitlement/legacyClaim";
import {
  ANDROID_FREE_TRANSITION_DATE,
  LEGACY_CLAIM_WINDOW_DAYS,
} from "@/features/entitlement/releaseConfig";

const DAY_MS = 24 * 60 * 60 * 1000;

// These assert behaviour on BOTH sides of the flip rather than pinning the
// current config, so they keep testing something real once
// ANDROID_FREE_TRANSITION_DATE is set for release instead of failing.
describe("legacy claim window", () => {
  it("stays open right up to the deadline, and closes after it", () => {
    if (ANDROID_FREE_TRANSITION_DATE == null) {
      // Pre-flip: the app still costs money, so there is nothing to steal and
      // the claim never closes.
      expect(isLegacyClaimAvailable(Date.now() + 5000 * DAY_MS)).toBe(true);
      return;
    }

    const closesAt =
      ANDROID_FREE_TRANSITION_DATE + LEGACY_CLAIM_WINDOW_DAYS * DAY_MS;
    expect(isLegacyClaimAvailable(closesAt - 60_000)).toBe(true);
    expect(isLegacyClaimAvailable(closesAt)).toBe(false);
    expect(isLegacyClaimAvailable(closesAt + 60_000)).toBe(false);
  });

  it("counts down the remaining days, and reports none once closed", () => {
    if (ANDROID_FREE_TRANSITION_DATE == null) {
      expect(legacyClaimDaysRemaining()).toBeNull();
      return;
    }

    const closesAt =
      ANDROID_FREE_TRANSITION_DATE + LEGACY_CLAIM_WINDOW_DAYS * DAY_MS;
    expect(legacyClaimDaysRemaining(closesAt - 3 * DAY_MS)).toBe(3);
    expect(legacyClaimDaysRemaining(closesAt + DAY_MS)).toBeNull();
  });

  it("opens the claim window at the flip, not before it", () => {
    if (ANDROID_FREE_TRANSITION_DATE == null) return;
    // A claim made the instant the app goes free must still be honoured.
    expect(isLegacyClaimAvailable(ANDROID_FREE_TRANSITION_DATE)).toBe(true);
  });

  it("uses a window long enough for owners to surface", () => {
    // Real owners appear within days of the flip, on their first launch after
    // it. The window only needs to outlast the stragglers.
    expect(LEGACY_CLAIM_WINDOW_DAYS).toBeGreaterThanOrEqual(30);
  });
});

describe("order id validation (Android)", () => {
  const ok = (v: string) => validateOrderId(v, "android").valid;

  it("accepts a well-formed Play order number", () => {
    expect(ok("GPA.1234-5678-9012-34567")).toBe(true);
  });

  it("accepts it case-insensitively and with surrounding spaces", () => {
    expect(ok("  gpa.1234-5678-9012-34567  ")).toBe(true);
  });

  it("rejects empty input with a prompt rather than a format complaint", () => {
    const result = validateOrderId("   ", "android");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/enter your order number/i);
  });

  it("rejects near-misses that would otherwise sail through", () => {
    expect(ok("GPA.1234-5678-9012-3456")).toBe(false); // last group too short
    expect(ok("GPA.1234-5678-9012-345678")).toBe(false); // too long
    expect(ok("GPA.1234567890123456")).toBe(false); // no separators
    expect(ok("1234-5678-9012-34567")).toBe(false); // missing prefix
    expect(ok("GPA.abcd-5678-9012-34567")).toBe(false); // non-numeric
    expect(ok("yes I bought it")).toBe(false);
  });

  it("explains the expected shape when the format is wrong", () => {
    const result = validateOrderId("nope", "android");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/GPA/);
  });
});

describe("order id validation (iOS)", () => {
  const ok = (v: string) => validateOrderId(v, "ios").valid;

  it("is deliberately loose, since Apple references vary by era", () => {
    expect(ok("MT7GH2Q9KL")).toBe(true);
    expect(ok("123456789012345")).toBe(true);
  });

  it("still rejects empty and obviously junk input", () => {
    expect(ok("")).toBe(false);
    expect(ok("   ")).toBe(false);
    expect(ok("abc")).toBe(false); // too short to be a real reference
    expect(ok("!!!!!!")).toBe(false);
  });
});
