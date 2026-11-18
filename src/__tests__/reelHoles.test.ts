import { describe, expect, it } from "vitest";

import { closeHolesInParts, closedTime, findHoles } from "@/features/session-video/reelHoles";

/** Frames every 1/30 s from `from` to `to` (seconds). */
const frames = (from: number, to: number) => {
  const out: number[] = [];
  for (let t = from; t < to - 1e-9; t += 1 / 30) out.push(t);
  return out;
};

describe("findHoles", () => {
  it("finds none in a recording with a frame every step", () => {
    const { holes, stepS } = findHoles(frames(0, 5));
    expect(holes).toEqual([]);
    expect(stepS).toBeCloseTo(1 / 30, 5);
  });

  it("closes the holes in build 103's reel down to one frame step", () => {
    // One frame, then nothing for 0.76 s and 1.15 s (TestFlight build 103).
    const ts = [...frames(3.6, 4.2), ...frames(4.957, 5.81), ...frames(6.95, 7.6)];
    const { holes, stepS } = findHoles(ts);
    expect(holes).toHaveLength(2);
    expect(holes[0].cutS).toBeCloseTo(4.957 - ts[ts.indexOf(4.957) - 1] - stepS, 5);
    expect(holes[1].cutS).toBeGreaterThan(1);
    // After closing, no gap is longer than a step.
    const closed = ts.map((t) => closedTime(t, holes));
    for (let i = 1; i < closed.length; i++) {
      expect(closed[i] - closed[i - 1]).toBeLessThan(stepS + 1e-6);
      expect(closed[i]).toBeGreaterThan(closed[i - 1]);
    }
  });

  it("leaves a frame before a hole where it was", () => {
    const ts = [0, 1 / 30, 2 / 30, 1.5, 1.5 + 1 / 30];
    const { holes } = findHoles(ts);
    expect(closedTime(2 / 30, holes)).toBeCloseTo(2 / 30, 6);
    expect(closedTime(1.5, holes)).toBeCloseTo(3 / 30, 6);
  });
});

describe("closeHolesInParts", () => {
  it("leaves the parts alone when there are no holes", () => {
    const parts = [{ durMs: 2000, soundFromMs: 5000 }, { durMs: 2500 }];
    expect(closeHolesInParts(parts, [])).toEqual(parts);
  });

  it("splits a clip's part at a hole and cuts the sound the hole spanned", () => {
    const parts = [
      { durMs: 2000, soundFromMs: 10_000 },
      { durMs: 3000, soundFromMs: 40_000 },
      { durMs: 2500 },
    ];
    // A 0.75 s hole 0.5 s into the second clip.
    const out = closeHolesInParts(parts, [{ atS: 2.5, cutS: 0.75 }]);
    expect(out).toEqual([
      { durMs: 2000, soundFromMs: 10_000 },
      { durMs: 500, soundFromMs: 40_000 },
      { durMs: 1750, soundFromMs: 41_250 },
      { durMs: 2500 },
    ]);
    // The reel is as much shorter as was cut.
    const total = (ps: { durMs: number }[]) => ps.reduce((n, p) => n + p.durMs, 0);
    expect(total(out)).toBe(total(parts) - 750);
  });

  it("carries a hole over a part's end into the next", () => {
    const parts = [{ durMs: 1000, soundFromMs: 0 }, { durMs: 1000, soundFromMs: 9000 }];
    const out = closeHolesInParts(parts, [{ atS: 0.8, cutS: 0.5 }]);
    expect(out).toEqual([
      { durMs: 800, soundFromMs: 0 },
      { durMs: 700, soundFromMs: 9300 },
    ]);
  });

  it("only shortens a card", () => {
    const out = closeHolesInParts([{ durMs: 2500 }], [{ atS: 1, cutS: 0.5 }]);
    expect(out).toEqual([{ durMs: 1000 }, { durMs: 1000 }]);
  });
});
