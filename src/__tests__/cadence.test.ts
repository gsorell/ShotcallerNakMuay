import { describe, expect, it } from "vitest";

import {
  CADENCE_PER_MIN,
  MIN_REST_AFTER_SPEECH_MS,
  SLOWEST_INTERVAL_MS,
  rampedIntervalMs,
  restAfterCalloutMs,
  voiceTailMs,
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

describe("rest after a callout", () => {
  const medium = 60000 / CADENCE_PER_MIN.medium;
  // The Microsoft voices in Chrome: a bare "Check" measures about 1.3s.
  const tail = voiceTailMs(1300);

  it("measures the voice tail from its shortest word, within bounds", () => {
    expect(voiceTailMs(null)).toBe(0);
    expect(tail).toBe(900);
    expect(voiceTailMs(200)).toBe(0);
    expect(voiceTailMs(5000)).toBe(1200);
    expect(voiceTailMs(Number.NaN)).toBe(0);
  });

  it("keeps the silence after a single technique short", () => {
    // "Right Elbow" measured 1.57s and used to be followed by 2.1s more.
    const rest = restAfterCalloutMs({ durationMs: 1570, tailMs: tail, baseDelayMs: medium });
    expect(tail + rest).toBeLessThan(1400);
  });

  it("gives a long combination more, up to a ceiling", () => {
    const single = restAfterCalloutMs({ durationMs: 1300, tailMs: tail, baseDelayMs: medium });
    const combo = restAfterCalloutMs({ durationMs: 3000, tailMs: tail, baseDelayMs: medium });
    const long = restAfterCalloutMs({ durationMs: 6000, tailMs: tail, baseDelayMs: medium });
    expect(combo).toBeGreaterThan(single);
    expect(long).toBeGreaterThanOrEqual(combo);
    expect(tail + long).toBeLessThanOrEqual(Math.ceil(medium * 0.85));
  });

  it("follows the pace factor and never collapses to nothing", () => {
    const base = { durationMs: 3000, tailMs: tail, baseDelayMs: medium };
    expect(restAfterCalloutMs({ ...base, pace: 1.3 })).toBeGreaterThan(restAfterCalloutMs(base));
    expect(restAfterCalloutMs({ ...base, durationMs: Number.NaN })).toBe(MIN_REST_AFTER_SPEECH_MS);
    expect(restAfterCalloutMs({ ...base, pace: Number.NaN })).toBe(restAfterCalloutMs(base));
    expect(restAfterCalloutMs({ durationMs: 300, tailMs: 1200, baseDelayMs: 1400 })).toBe(MIN_REST_AFTER_SPEECH_MS);
  });
});
