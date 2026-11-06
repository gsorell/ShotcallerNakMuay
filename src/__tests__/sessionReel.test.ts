import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ClipScheduler,
  PREROLL_MS,
  REEL_TARGET_MS,
  CLIP_MS,
  clipGapMs,
  shouldStartClip,
  strikesIn,
  tailAfterSpeechMs,
} from "@/features/session-video/clipScheduler";

/** A tape that logs when it rolls and cuts, in fake-clock milliseconds. */
const makeTape = () => {
  const log: string[] = [];
  const t0 = Date.now();
  return {
    log,
    tape: {
      roll: () => log.push(`roll@${Date.now() - t0}`),
      cut: () => log.push(`cut@${Date.now() - t0}`),
    },
  };
};

describe("clip timing", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts filming before the callout and stops after the combination lands", () => {
    const { log, tape } = makeTape();
    // A short session: no spacing, every callout is filmed.
    const s = new ClipScheduler(tape, 20_000, () => Date.now());
    s.event({ type: "scheduled", delayMs: 3000 });
    vi.advanceTimersByTime(3000);
    s.event({ type: "called" });
    vi.advanceTimersByTime(1500);
    s.event({ type: "spoken", phrase: "Jab, cross, left kick" });
    vi.advanceTimersByTime(5000);

    expect(log).toEqual([
      `roll@${3000 - PREROLL_MS}`,
      `cut@${4500 + tailAfterSpeechMs("Jab, cross, left kick")}`,
    ]);
  });

  it("ends the clip when an unfilmed callout comes before the tail is up", () => {
    const { log, tape } = makeTape();
    // A long session: clips are spaced, so the next call is not filmed.
    const s = new ClipScheduler(tape, 3 * 3 * 60_000, () => Date.now());
    s.event({ type: "scheduled", delayMs: 1000 });
    vi.advanceTimersByTime(1000);
    s.event({ type: "called" });
    vi.advanceTimersByTime(800);
    s.event({ type: "spoken", phrase: "Jab, cross, hook, cross" });
    // The next call is scheduled 600ms out, inside the tail.
    s.event({ type: "scheduled", delayMs: 600 });
    vi.advanceTimersByTime(600);
    s.event({ type: "called" });

    expect(log).toEqual([`roll@${1000 - PREROLL_MS}`, "cut@2400"]);
    expect(s.clips).toBe(1);
  });

  it("keeps rolling when the callout it is waiting for is pushed back", () => {
    const { log, tape } = makeTape();
    const s = new ClipScheduler(tape, 20_000, () => Date.now());
    s.event({ type: "scheduled", delayMs: 1000 });
    vi.advanceTimersByTime(900); // rolling, armed
    // The voice was still busy: the engine reschedules the same call.
    s.event({ type: "scheduled", delayMs: 250 });
    vi.advanceTimersByTime(250);
    s.event({ type: "called" });
    expect(log).toEqual([`roll@${1000 - PREROLL_MS}`]);
  });

  it("drops a planned clip when the session pauses before it starts", () => {
    const { log, tape } = makeTape();
    const s = new ClipScheduler(tape, 20_000, () => Date.now());
    s.event({ type: "scheduled", delayMs: 3000 });
    vi.advanceTimersByTime(1000);
    s.hold();
    vi.advanceTimersByTime(10_000);
    expect(log).toEqual([]);
  });

  it("cuts on a backstop if the voice never reports finishing", () => {
    const { log, tape } = makeTape();
    const s = new ClipScheduler(tape, 20_000, () => Date.now());
    s.event({ type: "scheduled", delayMs: 1000 });
    vi.advanceTimersByTime(1000);
    s.event({ type: "called" });
    vi.advanceTimersByTime(20_000);
    expect(log.length).toBe(2);
    expect(log[1]!.startsWith("cut@")).toBe(true);
  });
});

describe("clip spacing", () => {
  it("spreads a 3×3 session's clips across all three rounds", () => {
    const workMs = 3 * 3 * 60_000;
    const gapMs = clipGapMs(workMs);
    const maxMs = REEL_TARGET_MS + CLIP_MS * 2;
    let lastClipEnd = -Infinity;
    let recordedMs = 0;
    const starts: number[] = [];
    for (let now = 3000; now < workMs; now += 3000) {
      if (shouldStartClip({ now, lastClipEnd, gapMs, recordedMs, maxMs })) {
        starts.push(now);
        lastClipEnd = now + CLIP_MS;
        recordedMs += CLIP_MS;
      }
    }
    expect(recordedMs).toBeGreaterThanOrEqual(REEL_TARGET_MS * 0.8);
    expect(starts[starts.length - 1]).toBeGreaterThan((workMs * 2) / 3);
  });

  it("records every callout when the session is shorter than the reel", () => {
    expect(clipGapMs(20_000)).toBe(0);
  });
});

describe("tail after the voice", () => {
  it("grows with the strikes called, within bounds", () => {
    expect(strikesIn("Jab")).toBe(1);
    expect(strikesIn("Jab, cross, left kick")).toBe(3);
    expect(tailAfterSpeechMs("Jab")).toBeLessThan(
      tailAfterSpeechMs("Jab, cross, hook, cross")
    );
    expect(tailAfterSpeechMs("a, b, c, d, e, f, g, h")).toBe(2500);
  });
});
