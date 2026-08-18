import { describe, expect, it } from "vitest";

import {
  CADENCE_PER_MIN,
  SLOWEST_INTERVAL_MS,
  rampedIntervalMs,
} from "@/features/workout/utils/cadence";

const perMinute = (intervalMs: number) => 60000 / intervalMs;

describe("guided round pace ramp", () => {
  it("opens at novice pace", () => {
    expect(perMinute(rampedIntervalMs(0))).toBeCloseTo(CADENCE_PER_MIN.easy, 5);
  });

  it("finishes at amateur pace", () => {
    expect(perMinute(rampedIntervalMs(1))).toBeCloseTo(
      CADENCE_PER_MIN.medium,
      5
    );
  });

  it("only ever speeds up", () => {
    let previous = Infinity;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const interval = rampedIntervalMs(p);
      expect(interval, `at ${p.toFixed(2)}`).toBeLessThanOrEqual(previous);
      previous = interval;
    }
  });

  it("never runs past amateur, however long the round", () => {
    // A round that overruns its nominal length must not keep accelerating.
    for (const p of [1.5, 3, 100]) {
      expect(perMinute(rampedIntervalMs(p))).toBeCloseTo(
        CADENCE_PER_MIN.medium,
        5
      );
    }
  });

  it("never opens slower than the floor it shares with the ceiling", () => {
    // The ramp starts at novice and the ceiling is novice — they have to be the
    // same number, or the first callout of every round would be clamped.
    expect(Math.round(rampedIntervalMs(0))).toBe(SLOWEST_INTERVAL_MS);
  });

  it("handles a progress value that is not a number yet", () => {
    // Elapsed/duration is NaN for a single tick if a round is measured before
    // it starts; the clamp has to survive it rather than schedule NaN.
    expect(Number.isFinite(rampedIntervalMs(Number.NaN))).toBe(true);
  });
});
