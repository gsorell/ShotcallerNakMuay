import { describe, expect, it } from "vitest";

import {
  DISTURBANCE_PAD_MS,
  disturbedNear,
  isDisturbance,
  motionLevels,
  undisturbed,
} from "@/features/session-video/motion";
import { endCard, titleCard } from "@/features/session-video/cards";

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
