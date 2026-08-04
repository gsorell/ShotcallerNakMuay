import { describe, expect, it } from "vitest";

import {
  FREE_EMPHASIS_KEYS,
  PRO_ENTITLEMENT_ID,
  isFreeEmphasis,
} from "@/features/entitlement/constants";
import type { EmphasisKey } from "@/types";

describe("free-tier gating", () => {
  it("unlocks exactly the basic timer, freestyle, and Nak Muay Newb", () => {
    expect(isFreeEmphasis("timer_only")).toBe(true);
    expect(isFreeEmphasis("freestyle")).toBe(true);
    expect(isFreeEmphasis("newb")).toBe(true);
    expect(FREE_EMPHASIS_KEYS.size).toBe(3);
  });

  it("locks every other fighting style behind Pro", () => {
    const locked: EmphasisKey[] = [
      "mat",
      "tae",
      "khao",
      "femur",
      "sok",
      "boxing",
      "two_piece",
      "southpaw",
    ];
    for (const key of locked) {
      expect(isFreeEmphasis(key)).toBe(false);
    }
  });

  it("pins the RevenueCat entitlement identifier to the dashboard value", () => {
    // Locked in the RevenueCat dashboard as "Pro" (capital P); code must match.
    expect(PRO_ENTITLEMENT_ID).toBe("Pro");
  });
});
