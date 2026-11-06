import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CLIP_MS,
  ClipScheduler,
  MAX_CLIP_MS,
  PREROLL_MS,
  REEL_TARGET_MS,
  clipGapMs,
  shouldStartClip,
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

/** A long session, so clips are spaced and the next call is not filmed. */
const LONG_SESSION_MS = 3 * 3 * 60_000;

describe("clip timing", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("films from just before a callout until the next callout begins", () => {
    const { log, tape } = makeTape();
    const s = new ClipScheduler(tape, LONG_SESSION_MS, () => Date.now());
    s.event({ type: "scheduled", delayMs: 3000 });
    vi.advanceTimersByTime(3000);
    s.event({ type: "called" });
    // The voice finishes and the engine schedules the next call.
    vi.advanceTimersByTime(1800);
    s.event({ type: "scheduled", delayMs: 2200 });
    vi.advanceTimersByTime(2200);
    s.event({ type: "called" });

    expect(log).toEqual([`roll@${3000 - PREROLL_MS}`, "cut@7000"]);
    expect(s.clips).toBe(1);
  });

  it("runs straight on through every callout in a short session", () => {
    const { log, tape } = makeTape();
    // Shorter than the reel: no spacing, so every callout is filmed.
    const s = new ClipScheduler(tape, 20_000, () => Date.now());
    s.event({ type: "scheduled", delayMs: 1000 });
    vi.advanceTimersByTime(1000);
    s.event({ type: "called" });
    s.event({ type: "scheduled", delayMs: 3000 });
    vi.advanceTimersByTime(3000);
    s.event({ type: "called" });
    expect(log).toEqual([`roll@${1000 - PREROLL_MS}`]);
  });

  it("keeps rolling when the callout it is waiting for is pushed back", () => {
    const { log, tape } = makeTape();
    const s = new ClipScheduler(tape, LONG_SESSION_MS, () => Date.now());
    s.event({ type: "scheduled", delayMs: 1000 });
    vi.advanceTimersByTime(900); // rolling, armed
    // The voice was still busy: the engine reschedules the same call.
    s.event({ type: "scheduled", delayMs: 250 });
    vi.advanceTimersByTime(250);
    s.event({ type: "called" });
    expect(log).toEqual([`roll@${1000 - PREROLL_MS}`]);
  });

  it("stops at once when the session pauses or the round ends", () => {
    const { log, tape } = makeTape();
    const s = new ClipScheduler(tape, LONG_SESSION_MS, () => Date.now());
    s.event({ type: "scheduled", delayMs: 1000 });
    vi.advanceTimersByTime(1000);
    s.event({ type: "called" });
    vi.advanceTimersByTime(1500);
    s.hold();
    expect(log).toEqual([`roll@${1000 - PREROLL_MS}`, "cut@2500"]);
  });

  it("drops a planned clip when the session pauses before it starts", () => {
    const { log, tape } = makeTape();
    const s = new ClipScheduler(tape, LONG_SESSION_MS, () => Date.now());
    s.event({ type: "scheduled", delayMs: 3000 });
    vi.advanceTimersByTime(1000);
    s.hold();
    vi.advanceTimersByTime(10_000);
    expect(log).toEqual([]);
  });

  it("cuts on a backstop if the next callout never comes", () => {
    const { log, tape } = makeTape();
    const s = new ClipScheduler(tape, LONG_SESSION_MS, () => Date.now());
    s.event({ type: "scheduled", delayMs: 1000 });
    vi.advanceTimersByTime(1000);
    s.event({ type: "called" });
    vi.advanceTimersByTime(30_000);
    expect(log).toEqual([`roll@${1000 - PREROLL_MS}`, `cut@${1000 + MAX_CLIP_MS}`]);
  });
});

describe("clip spacing", () => {
  it("spreads a 3×3 session's clips across all three rounds", () => {
    const workMs = LONG_SESSION_MS;
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

  it("films every callout when the session is shorter than the reel", () => {
    expect(clipGapMs(20_000)).toBe(0);
  });
});
