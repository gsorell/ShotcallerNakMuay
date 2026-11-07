import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RoundPicker,
  reelBudgetMs,
  roundBudgetMs,
  type Candidate,
} from "@/features/session-video/highlights";
import {
  MAX_KEEP_MS,
  MIN_KEEP_MS,
  cutClip,
  motionLevels,
} from "@/features/session-video/motion";
import {
  MAX_SEGMENT_MS,
  OVERLAP_MS,
  PREROLL_MS,
  SegmentScheduler,
} from "@/features/session-video/segmentScheduler";

/** Records when clips open and close, in fake-clock milliseconds. */
const makeOpener = () => {
  const log: string[] = [];
  const t0 = Date.now();
  let n = 0;
  const open = () => {
    const id = (n += 1);
    log.push(`open${id}@${Date.now() - t0}`);
    return { close: () => log.push(`close${id}@${Date.now() - t0}`) };
  };
  return { log, open };
};

describe("filming every callout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("opens each clip before its callout and overlaps the handover", () => {
    const { log, open } = makeOpener();
    const s = new SegmentScheduler(open);
    s.event({ type: "scheduled", delayMs: 3000 });
    vi.advanceTimersByTime(3000);
    s.event({ type: "called" });
    vi.advanceTimersByTime(1500);
    s.event({ type: "scheduled", delayMs: 2000 });
    vi.advanceTimersByTime(2000);
    s.event({ type: "called" });
    vi.advanceTimersByTime(OVERLAP_MS);

    const nextOpen = 6500 - PREROLL_MS;
    expect(log).toEqual([
      `open1@${3000 - PREROLL_MS}`,
      `open2@${nextOpen}`,
      `close1@${nextOpen + OVERLAP_MS}`,
    ]);
  });

  it("keeps the clip open when its callout is pushed back", () => {
    const { log, open } = makeOpener();
    const s = new SegmentScheduler(open);
    s.event({ type: "scheduled", delayMs: 1000 });
    vi.advanceTimersByTime(900);
    s.event({ type: "scheduled", delayMs: 250 }); // the voice was busy
    vi.advanceTimersByTime(250);
    s.event({ type: "called" });
    expect(log).toEqual([`open1@${1000 - PREROLL_MS}`]);
  });

  it("closes at once on a pause or the end of a round", () => {
    const { log, open } = makeOpener();
    const s = new SegmentScheduler(open);
    s.event({ type: "scheduled", delayMs: 1000 });
    vi.advanceTimersByTime(1000);
    s.event({ type: "called" });
    vi.advanceTimersByTime(1500);
    s.hold();
    expect(log).toEqual([`open1@${1000 - PREROLL_MS}`, "close1@2500"]);
  });

  it("closes on a backstop when no next callout comes", () => {
    const { log, open } = makeOpener();
    const s = new SegmentScheduler(open);
    s.event({ type: "scheduled", delayMs: 1000 });
    vi.advanceTimersByTime(1000);
    s.event({ type: "called" });
    vi.advanceTimersByTime(30_000);
    expect(log).toEqual([
      `open1@${1000 - PREROLL_MS}`,
      `close1@${1000 - PREROLL_MS + MAX_SEGMENT_MS}`,
    ]);
  });

  it("opens nothing more once stopped", () => {
    const { log, open } = makeOpener();
    const s = new SegmentScheduler(open);
    s.stop();
    s.event({ type: "scheduled", delayMs: 1000 });
    vi.advanceTimersByTime(2000);
    s.event({ type: "called" });
    expect(log).toEqual([]);
  });
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
  it("keeps the strikes and cuts the waiting either side", () => {
    // 1s of squaring up, 1.5s of strikes, 3s of staring.
    const cut = cutClip(samplesFor(5500, [[1000, 2500]]), 5500, LEVELS);
    expect(cut.startMs).toBe(700);
    expect(cut.endMs).toBe(2900);
    expect(cut.score).toBeGreaterThan(0);
  });

  it("scores a stare as nothing", () => {
    const cut = cutClip(samplesFor(5000, []), 5000, LEVELS);
    expect(cut.score).toBe(0);
  });

  it("scores a flurry above a single strike", () => {
    const jab = cutClip(samplesFor(5000, [[1000, 1300]]), 5000, LEVELS);
    const flurry = cutClip(samplesFor(5000, [[1000, 3500]]), 5000, LEVELS);
    expect(flurry.score).toBeGreaterThan(jab.score);
  });

  it("never keeps more than one combination's worth", () => {
    const cut = cutClip(samplesFor(9000, [[500, 8500]]), 9000, LEVELS);
    expect(cut.endMs - cut.startMs).toBe(MAX_KEEP_MS);
  });

  it("pads a single flinch out to a watchable length", () => {
    const cut = cutClip(samplesFor(5000, [[2000, 2100]]), 5000, LEVELS);
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

const candidate = (seq: number, score: number, lenMs = 3000) => {
  const released = { value: false };
  const c: Candidate = {
    seq,
    url: `blob:${seq}`,
    cut: { startMs: 0, endMs: lenMs, score },
    release: () => {
      released.value = true;
    },
  };
  return { c, released };
};

describe("picking a round's best", () => {
  it("picks the busiest that fit, in the order they were filmed", () => {
    const p = new RoundPicker();
    const all = [3, 9, 1, 7, 5].map((score, i) => candidate(i, score));
    all.forEach(({ c }) => p.offer(c));
    const picked = p.pick(6000);
    expect(picked.map((c) => c.seq)).toEqual([1, 3]); // scores 9 and 7
    expect(all.filter((x) => x.released.value).length).toBe(3);
  });

  it("lets go of clips with nothing in them straight away", () => {
    const p = new RoundPicker();
    const stare = candidate(0, 0);
    p.offer(stare.c);
    expect(stare.released.value).toBe(true);
  });

  it("holds only a handful per round however long it runs", () => {
    const p = new RoundPicker();
    const all = Array.from({ length: 60 }, (_, i) => candidate(i, i + 1));
    all.forEach(({ c }) => p.offer(c));
    expect(all.filter((x) => !x.released.value).length).toBeLessThanOrEqual(8);
  });
});

describe("reel length", () => {
  it("grows with the session up to 30s, shared across the rounds", () => {
    expect(reelBudgetMs(1)).toBe(12000);
    expect(reelBudgetMs(5)).toBe(30000);
    expect(roundBudgetMs(5)).toBe(6000);
  });
});
