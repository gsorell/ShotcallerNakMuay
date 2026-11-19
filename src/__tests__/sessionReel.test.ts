import { describe, expect, it } from "vitest";

import type { CallInfo } from "@/features/session-video/calloutSignal";
import { scoreClip, techniqueWeight } from "@/features/session-video/highlights";
import {
  DISTURBANCE_PAD_MS,
  MAX_KEEP_MS,
  MIN_KEEP_MS,
  cutClip,
  disturbedNear,
  isDisturbance,
  keepCapMs,
  motionLevels,
  undisturbed,
} from "@/features/session-video/motion";
import { endCard, titleCard } from "@/features/session-video/cards";

const call = (text: string, between = false): CallInfo => ({
  text,
  between,
  combo: text.includes(","),
});

/** Motion samples every 100ms: `busy` ranges are action, the rest is still. */
const samplesFor = (durationMs: number, busy: [number, number][]) => {
  const out: { t: number; m: number }[] = [];
  for (let t = 0; t <= durationMs; t += 100) {
    const active = busy.some(([a, b]) => t >= a && t <= b);
    out.push({ t, m: active ? 0.08 : 0.005 });
  }
  return out;
};
const LEVELS = { floor: 0.005, threshold: 0.02 };

describe("trimming a clip to its action", () => {
  it("starts with the movement and ends back in stance", () => {
    const cut = cutClip({
      samples: samplesFor(5500, [[1000, 2500]]),
      durationMs: 5500,
      levels: LEVELS,
      callAtMs: 700,
      strikes: 3,
    });
    expect(cut.startMs).toBe(600);
    expect(cut.endMs).toBe(2850);
    expect(cut.motion).toBeGreaterThan(0);
  });

  it("ignores the last combination's tail before the call", () => {
    const cut = cutClip({
      samples: samplesFor(5500, [[0, 400], [1500, 2500]]),
      durationMs: 5500,
      levels: LEVELS,
      callAtMs: 1200,
      strikes: 3,
    });
    expect(cut.startMs).toBe(1100);
  });

  it("keeps the snap back to guard instead of cutting at the last big move", () => {
    // Strikes to 2000, then smaller movement back to stance until 2800.
    const samples = samplesFor(5000, [[1000, 2000]]).map((s) =>
      s.t > 2000 && s.t <= 2800 ? { ...s, m: 0.015 } : s
    );
    const cut = cutClip({ samples, durationMs: 5000, levels: LEVELS, strikes: 3 });
    // The old cut ended 400ms after the last big movement: 2500.
    expect(cut.endMs).toBeGreaterThan(2700);
    expect(cut.endMs).toBeLessThan(3300);
  });

  it("comes back empty for a stare", () => {
    const cut = cutClip({ samples: samplesFor(5000, []), durationMs: 5000, levels: LEVELS });
    expect(cut.endMs).toBe(cut.startMs);
  });

  it("gives a longer combination more room, within a ceiling", () => {
    const long = (strikes: number) =>
      cutClip({
        samples: samplesFor(9000, [[500, 8500]]),
        durationMs: 9000,
        levels: LEVELS,
        strikes,
      });
    const one = long(1);
    const five = long(5);
    const ten = long(10);
    expect(one.endMs - one.startMs).toBe(keepCapMs(1));
    expect(five.endMs - five.startMs).toBe(keepCapMs(5));
    expect(ten.endMs - ten.startMs).toBe(MAX_KEEP_MS);
    expect(keepCapMs(5)).toBeGreaterThan(keepCapMs(1));
  });

  it("keeps the stretch with the strikes in it when it must choose", () => {
    const cut = cutClip({
      samples: samplesFor(9000, [[500, 8500]]),
      durationMs: 9000,
      levels: LEVELS,
      hits: [6000, 6400, 6800],
      strikes: 1,
    });
    expect(cut.hits).toBe(3);
  });

  it("pads a single flinch out to a watchable length", () => {
    const cut = cutClip({
      samples: samplesFor(5000, [[2000, 2100]]),
      durationMs: 5000,
      levels: LEVELS,
    });
    expect(cut.endMs - cut.startMs).toBeGreaterThanOrEqual(MIN_KEEP_MS - 1);
  });

  it("judges still and busy against the session itself", () => {
    const quiet = Array.from({ length: 400 }, () => 0.004);
    const busy = Array.from({ length: 100 }, () => 0.1);
    const levels = motionLevels([...quiet, ...busy]);
    expect(levels.floor).toBeCloseTo(0.004);
    expect(levels.threshold).toBeGreaterThan(0.004);
    expect(levels.threshold).toBeLessThan(0.1);
  });
});

describe("what a clip is worth", () => {
  it("rates combinations and power strikes above singles, and defence lowest", () => {
    expect(techniqueWeight("Jab, Cross, Left Kick")).toBeGreaterThan(
      techniqueWeight("Jab, Cross")
    );
    expect(techniqueWeight("Jab, Cross")).toBeGreaterThan(techniqueWeight("Jab"));
    expect(techniqueWeight("Right Knee")).toBeGreaterThan(techniqueWeight("Jab"));
    expect(techniqueWeight("Check")).toBeLessThan(0.5);
    expect(techniqueWeight("Block")).toBeLessThan(0.5);
    // Defence with a strike in it is not "all defence".
    expect(techniqueWeight("Long Guard, Right Knee")).toBeGreaterThan(1);
  });

  it("puts a combination that lands above a check that moved more", () => {
    const cut = { startMs: 0, endMs: 2000 };
    const check = scoreClip(
      { ...cut, motion: 3, hits: 0 },
      [call("Check")],
      1
    );
    const combo = scoreClip(
      { ...cut, motion: 1, hits: 3 },
      [call("Jab, Cross, Hook")],
      1
    );
    expect(combo).toBeGreaterThan(check);
  });

  it("judges a clip by its combination, not the check that followed", () => {
    const cut = { startMs: 0, endMs: 2000, motion: 1, hits: 2 };
    const withCheck = scoreClip(cut, [call("Jab, Cross"), call("Check", true)], 1);
    const alone = scoreClip(cut, [call("Jab, Cross")], 1);
    expect(withCheck).toBe(alone);
  });
});



describe("the camera being disturbed", () => {
  // Thresholds measured on real sessions (2026-11-12/13): see isDisturbance.
  it("tells training from the camera being handled", () => {
    // A head kick close to the lens: a quarter of the frame, steady light.
    expect(isDisturbance(0.25, 0.02)).toBe(false);
    // Shadowboxing across a room.
    expect(isDisturbance(0.03, 0.01)).toBe(false);
    // A dog's nose over the lens; the phone being set down.
    expect(isDisturbance(0.75, 0.06)).toBe(true);
    expect(isDisturbance(0.85, 0.26)).toBe(true);
    // Walking away from the phone: the exposure swings.
    expect(isDisturbance(0.24, 0.034)).toBe(true);
  });

  it("writes off the moments either side of a disturbance", () => {
    const samples = Array.from({ length: 100 }, (_, i) => ({
      at: i * 100,
      m: 0.01,
      disturbed: i === 50,
    }));
    const kept = undisturbed(samples);
    expect(kept.some((s) => Math.abs(s.at - 5000) <= DISTURBANCE_PAD_MS)).toBe(false);
    expect(kept.length).toBe(100 - 31);
    expect(disturbedNear(samples, 6000, 7000)).toBe(true);
    expect(disturbedNear(samples, 7000, 8000)).toBe(false);
  });

  it("keeps a disturbance from setting the bar for real movement", () => {
    // Strikes at 0.015 after a walk up to the phone at 0.13: judged with
    // the walk in, every strike fell under the threshold for a minute.
    const samples = [
      ...Array.from({ length: 40 }, (_, i) => ({ at: i * 100, m: 0.13, disturbed: i % 4 === 0 })),
      ...Array.from({ length: 560 }, (_, i) => ({
        at: 4000 + i * 100,
        m: i % 10 === 0 ? 0.015 : 0.004,
      })),
    ];
    const naive = motionLevels(samples.map((s) => s.m));
    const fair = motionLevels(undisturbed(samples).map((s) => s.m));
    expect(naive.threshold).toBeGreaterThan(0.015);
    expect(fair.threshold).toBeLessThan(0.015);
  });
});


describe("hits the voice could have made", () => {
  it("trims with every hit but scores only those away from the voice", () => {
    const cut = cutClip({
      samples: samplesFor(6000, [[1000, 3000]]),
      durationMs: 6000,
      levels: LEVELS,
      hits: [1100, 1300, 1500, 2600],
      cleanHits: [2600],
      strikes: 3,
    });
    expect(cut.hits).toBe(1);
  });
});

describe("cards", () => {
  it("opens on the session and closes on where it came from", () => {
    const title = titleCard(5, 180_000, new Date(2026, 10, 9));
    expect(title.lines[0]).toBe("5 ROUNDS × 3:00");
    expect(title.lines[1]).toMatch(/NOV 9/);
    const end = endCard(288, 15 * 60_000);
    expect(end.lines[0]).toBe("288 CALLS · 15 MIN");
    expect(end.lines.join(" ")).toContain("shotcallermuaythai.app");
  });
});
