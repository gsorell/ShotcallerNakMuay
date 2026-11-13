import { describe, expect, it } from "vitest";

import { MASTER, softClipCurve } from "@/features/session-video/reelRenderer";

describe("mastering the reel's sound", () => {
  it("never lets a sample past the ceiling", () => {
    const curve = softClipCurve(MASTER.ceiling);
    for (const y of curve) expect(Math.abs(y)).toBeLessThan(MASTER.ceiling);
  });

  it("leaves quiet sound almost untouched", () => {
    const curve = softClipCurve(MASTER.ceiling, 2001);
    // x = 0.1 sits at index 1100 of a -1..1 curve.
    expect(curve[1100]).toBeCloseTo(0.1, 2);
  });
});
