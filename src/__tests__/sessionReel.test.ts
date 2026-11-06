import { describe, expect, it } from "vitest";

import {
  CLIP_MS,
  REEL_TARGET_MS,
  clipGapMs,
  shouldStartClip,
} from "@/features/session-video/reelRecorder";

/** Plays a session's callouts through the spacing rule, as the recorder does. */
const simulate = (workMs: number, everyMs: number) => {
  const gapMs = clipGapMs(workMs);
  const maxMs = REEL_TARGET_MS + CLIP_MS * 2;
  let lastClipEnd = -Infinity;
  let recordedMs = 0;
  const starts: number[] = [];
  for (let now = everyMs; now < workMs; now += everyMs) {
    if (now < lastClipEnd) continue; // mid-clip
    if (shouldStartClip({ now, lastClipEnd, gapMs, recordedMs, maxMs })) {
      starts.push(now);
      lastClipEnd = now + CLIP_MS;
      recordedMs += CLIP_MS;
    }
  }
  return { starts, recordedMs };
};

describe("session reel clip spacing", () => {
  it("spreads a 3×3 session's clips across all three rounds", () => {
    const workMs = 3 * 3 * 60_000;
    const { starts, recordedMs } = simulate(workMs, 2500);
    expect(recordedMs).toBeGreaterThanOrEqual(REEL_TARGET_MS * 0.8);
    expect(recordedMs).toBeLessThanOrEqual(REEL_TARGET_MS + CLIP_MS * 2);
    // Clips in the last round, not all bunched in the first.
    expect(starts[starts.length - 1]).toBeGreaterThan(workMs * 2 / 3);
  });

  it("takes clips back to back when the session is shorter than the reel", () => {
    expect(clipGapMs(20_000)).toBe(0);
    const { recordedMs } = simulate(20_000, 3000);
    expect(recordedMs).toBeGreaterThan(0);
  });

  it("stops at the ceiling when a session runs long", () => {
    expect(
      shouldStartClip({
        now: 1e9,
        lastClipEnd: 0,
        gapMs: 0,
        recordedMs: REEL_TARGET_MS + CLIP_MS * 2,
        maxMs: REEL_TARGET_MS + CLIP_MS * 2,
      })
    ).toBe(false);
  });
});
