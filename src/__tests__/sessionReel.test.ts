import { describe, expect, it } from "vitest";

import {
  CLIP_MS,
  MIN_CLIP_MS,
  REEL_TARGET_MS,
  calloutEndsClip,
  clipGapMs,
  shouldStartClip,
} from "@/features/session-video/reelRecorder";

/**
 * Plays a session's callouts through the recorder's rules: a clip opens on a
 * callout when spacing allows, and the next callout ends it once it has run
 * MIN_CLIP_MS (sooner, the clip runs on through that callout).
 */
const simulate = (workMs: number, everyMs: number) => {
  const gapMs = clipGapMs(workMs);
  const maxMs = REEL_TARGET_MS + CLIP_MS * 2;
  let lastClipEnd = -Infinity;
  let recordedMs = 0;
  let clipStart: number | null = null;
  const clips: { start: number; end: number }[] = [];
  for (let now = everyMs; now < workMs; now += everyMs) {
    if (clipStart !== null) {
      if (!calloutEndsClip(now - clipStart)) continue;
      clips.push({ start: clipStart, end: now });
      recordedMs += now - clipStart;
      lastClipEnd = now;
      clipStart = null;
    }
    if (shouldStartClip({ now, lastClipEnd, gapMs, recordedMs, maxMs })) {
      clipStart = now;
    }
  }
  return { clips, recordedMs };
};

describe("session reel clips", () => {
  it("runs each clip from its callout to the next one", () => {
    const { clips } = simulate(9 * 60_000, 3500);
    expect(clips.length).toBeGreaterThan(3);
    for (const c of clips) expect(c.end - c.start).toBe(3500);
  });

  it("carries a clip through a callout that comes too soon", () => {
    // A fast pace: 1.5s between calls. Ended at the first callout the clip
    // would be 1.5s; it runs on to the next, 3s.
    const { clips } = simulate(9 * 60_000, 1500);
    for (const c of clips) {
      expect(c.end - c.start).toBeGreaterThanOrEqual(MIN_CLIP_MS);
      expect(c.end - c.start).toBe(3000);
    }
  });

  it("spreads a 3×3 session's clips across all three rounds", () => {
    const workMs = 3 * 3 * 60_000;
    const { clips, recordedMs } = simulate(workMs, 3000);
    expect(recordedMs).toBeGreaterThanOrEqual(REEL_TARGET_MS * 0.7);
    expect(recordedMs).toBeLessThanOrEqual(REEL_TARGET_MS + CLIP_MS * 3);
    // Clips in the last round, not all bunched in the first.
    expect(clips[clips.length - 1]!.start).toBeGreaterThan((workMs * 2) / 3);
  });

  it("records back to back when the session is shorter than the reel", () => {
    expect(clipGapMs(20_000)).toBe(0);
    const { recordedMs } = simulate(20_000, 3000);
    expect(recordedMs).toBeGreaterThan(10_000);
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
