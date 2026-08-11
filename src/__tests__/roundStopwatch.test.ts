import { describe, expect, it } from "vitest";

import {
  bankSegment,
  createRoundStopwatch,
  elapsedMs,
  resetRound,
  startSegment,
} from "@/features/workout/utils/roundStopwatch";

describe("round stopwatch", () => {
  it("counts time while the round is running", () => {
    const sw = createRoundStopwatch();
    resetRound(sw, 1000);
    expect(elapsedMs(sw, 1000)).toBe(0);
    expect(elapsedMs(sw, 4000)).toBe(3000);
  });

  it("does not count time spent paused", () => {
    const sw = createRoundStopwatch();
    resetRound(sw, 0);
    bankSegment(sw, 10_000); // paused after ten seconds of work
    // Sixty seconds go by with the session paused.
    expect(elapsedMs(sw, 70_000)).toBe(10_000);
  });

  it("picks the ramp back up where it left off after a resume", () => {
    // The behaviour this exists for: pausing to catch your breath must not
    // rewind the pace, and it must not skip it forward either.
    const sw = createRoundStopwatch();
    resetRound(sw, 0);
    bankSegment(sw, 20_000); // 20s of work, then pause
    startSegment(sw, 200_000); // resume three minutes later
    expect(elapsedMs(sw, 200_000)).toBe(20_000);
    expect(elapsedMs(sw, 205_000)).toBe(25_000);
  });

  it("survives several pauses in one round", () => {
    const sw = createRoundStopwatch();
    resetRound(sw, 0);
    bankSegment(sw, 5_000);
    startSegment(sw, 60_000);
    bankSegment(sw, 65_000);
    startSegment(sw, 120_000);
    expect(elapsedMs(sw, 123_000)).toBe(13_000);
  });

  it("throws the work away at a new round", () => {
    const sw = createRoundStopwatch();
    resetRound(sw, 0);
    bankSegment(sw, 45_000);
    resetRound(sw, 100_000);
    expect(elapsedMs(sw, 100_000)).toBe(0);
    expect(elapsedMs(sw, 102_000)).toBe(2_000);
  });

  it("banks idempotently", () => {
    // The effect that banks can run more than once for a single stop.
    const sw = createRoundStopwatch();
    resetRound(sw, 0);
    bankSegment(sw, 8_000);
    bankSegment(sw, 50_000);
    bankSegment(sw, 90_000);
    expect(elapsedMs(sw, 90_000)).toBe(8_000);
  });

  it("does not lose a segment when restarted without an explicit bank", () => {
    // A dependency change can re-run the start effect mid-round.
    const sw = createRoundStopwatch();
    resetRound(sw, 0);
    startSegment(sw, 6_000);
    expect(elapsedMs(sw, 9_000)).toBe(9_000);
  });

  it("never goes backwards if the clock jumps", () => {
    const sw = createRoundStopwatch();
    resetRound(sw, 10_000);
    expect(elapsedMs(sw, 5_000)).toBe(0);
  });
});
