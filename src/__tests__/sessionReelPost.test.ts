import { describe, expect, it } from "vitest";

import { MASTER, softClipCurve } from "@/features/session-video/reelRenderer";
import { SHORT_BODY_MS, pickShortSegments } from "@/features/session-video/shortCut";

const seg = (fromMs: number, toMs: number, score: number) => ({ fromMs, toMs, score });

describe("the short cut", () => {
  const reel = [
    seg(0, 3000, 2),
    seg(3000, 6500, 9),
    seg(6500, 9000, 1),
    seg(9000, 13000, 7),
    seg(13000, 16000, 5),
    seg(16000, 21000, 8),
  ];

  it("keeps the best that fit, in the order they happened", () => {
    const picks = pickShortSegments(reel);
    const total = picks.reduce((s, p) => s + p.toMs - p.fromMs, 0);
    expect(total).toBeLessThanOrEqual(SHORT_BODY_MS);
    // 9 and 8 make 8.5s; the 7 would overrun, so the 5 fills the rest.
    expect(picks.map((p) => p.score)).toEqual([9, 5, 8]);
    expect(picks.map((p) => p.fromMs)).toEqual([3000, 13000, 16000]);
  });

  it("always has something, even if the best alone runs long", () => {
    expect(pickShortSegments([seg(0, 20000, 3)])).toHaveLength(1);
  });
});

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
