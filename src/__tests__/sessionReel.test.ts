import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CallInfo } from "@/features/session-video/calloutSignal";
import {
  RoundPicker,
  avoidRepeatsInARow,
  newReelSoFar,
  reelBudgetMs,
  roundBudgetMs,
  scoreClip,
  techniqueKey,
  techniqueWeight,
  type Candidate,
} from "@/features/session-video/highlights";
import {
  MAX_KEEP_MS,
  MIN_CROP,
  MIN_KEEP_MS,
  cropFromHeat,
  cutClip,
  keepCapMs,
  motionLevels,
} from "@/features/session-video/motion";
import { cropAt } from "@/features/session-video/reelRenderer";
import { endCard, titleCard } from "@/features/session-video/cards";
import {
  MAX_SEGMENT_MS,
  OVERLAP_MS,
  PREROLL_MS,
  SegmentScheduler,
} from "@/features/session-video/segmentScheduler";

const call = (text: string, between = false): CallInfo => ({
  text,
  between,
  combo: text.includes(","),
});

/** Records when clips open, close and what they were tagged with. */
const makeOpener = () => {
  const log: string[] = [];
  const t0 = Date.now();
  let n = 0;
  const open = () => {
    const id = (n += 1);
    log.push(`open${id}@${Date.now() - t0}`);
    return {
      tag: (c: CallInfo) => log.push(`tag${id}:${c.text}`),
      close: () => log.push(`close${id}@${Date.now() - t0}`),
    };
  };
  return { log, open };
};

describe("filming every callout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("opens each clip before its callout and overlaps the handover", () => {
    const { log, open } = makeOpener();
    const s = new SegmentScheduler(open);
    s.event({ type: "scheduled", delayMs: 3000, nextIsBetween: false });
    vi.advanceTimersByTime(3000);
    s.event({ type: "called", call: call("Jab, Cross") });
    vi.advanceTimersByTime(1500);
    s.event({ type: "scheduled", delayMs: 2000, nextIsBetween: false });
    vi.advanceTimersByTime(2000);
    s.event({ type: "called", call: call("Teep") });
    vi.advanceTimersByTime(OVERLAP_MS);

    const nextOpen = 6500 - PREROLL_MS;
    expect(log).toEqual([
      `open1@${3000 - PREROLL_MS}`,
      "tag1:Jab, Cross",
      `open2@${nextOpen}`,
      "tag2:Teep",
      `close1@${nextOpen + OVERLAP_MS}`,
    ]);
  });

  it("folds a between-call into the combination's clip", () => {
    const { log, open } = makeOpener();
    const s = new SegmentScheduler(open);
    s.event({ type: "scheduled", delayMs: 1000, nextIsBetween: false });
    vi.advanceTimersByTime(1000);
    s.event({ type: "called", call: call("Jab, Cross, Left Kick") });
    // The engine says the next call is the between-call.
    s.event({ type: "scheduled", delayMs: 2500, nextIsBetween: true });
    vi.advanceTimersByTime(2500);
    s.event({ type: "called", call: call("Check", true) });
    expect(log).toEqual([
      `open1@${1000 - PREROLL_MS}`,
      "tag1:Jab, Cross, Left Kick",
      "tag1:Check",
    ]);
  });

  it("keeps the clip open when its callout is pushed back", () => {
    const { log, open } = makeOpener();
    const s = new SegmentScheduler(open);
    s.event({ type: "scheduled", delayMs: 1000, nextIsBetween: false });
    vi.advanceTimersByTime(900);
    s.event({ type: "scheduled", delayMs: 250, nextIsBetween: false });
    vi.advanceTimersByTime(250);
    s.event({ type: "called", call: call("Jab") });
    expect(log).toEqual([`open1@${1000 - PREROLL_MS}`, "tag1:Jab"]);
  });

  it("closes at once on a pause or the end of a round", () => {
    const { log, open } = makeOpener();
    const s = new SegmentScheduler(open);
    s.event({ type: "scheduled", delayMs: 1000, nextIsBetween: false });
    vi.advanceTimersByTime(1000);
    s.event({ type: "called", call: call("Jab") });
    vi.advanceTimersByTime(1500);
    s.hold();
    expect(log).toEqual([`open1@${1000 - PREROLL_MS}`, "tag1:Jab", "close1@2500"]);
  });

  it("closes on a backstop when no next callout comes", () => {
    const { log, open } = makeOpener();
    const s = new SegmentScheduler(open);
    s.event({ type: "scheduled", delayMs: 1000, nextIsBetween: false });
    vi.advanceTimersByTime(1000);
    s.event({ type: "called", call: call("Jab") });
    vi.advanceTimersByTime(30_000);
    expect(log[log.length - 1]).toBe(`close1@${1000 - PREROLL_MS + MAX_SEGMENT_MS}`);
  });

  it("opens nothing more once stopped", () => {
    const { log, open } = makeOpener();
    const s = new SegmentScheduler(open);
    s.stop();
    s.event({ type: "scheduled", delayMs: 1000, nextIsBetween: false });
    vi.advanceTimersByTime(2000);
    s.event({ type: "called", call: call("Jab") });
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

const candidate = (seq: number, score: number, text: string, lenMs = 2000) => {
  const released = { value: false };
  const c: Candidate = {
    seq,
    url: `blob:${seq}`,
    calls: [call(text)],
    cut: { startMs: 0, endMs: lenMs, motion: 1, hits: 0 },
    score,
    release: () => {
      released.value = true;
    },
  };
  return { c, released };
};

describe("picking a round's best", () => {
  it("picks the best that fit and ends the round on the best", () => {
    const p = new RoundPicker(6000);
    const all = [
      candidate(0, 3, "Jab"),
      candidate(1, 9, "Jab, Cross, Left Kick"),
      candidate(2, 1, "Teep"),
      candidate(3, 7, "Right Knee"),
      candidate(4, 5, "Jab, Cross"),
    ];
    all.forEach(({ c }) => p.offer(c));
    const picked = p.pick(6000);
    // 9, 7 and 5 fit; in film order, the best moved to the end.
    expect(picked.map((c) => c.seq)).toEqual([3, 4, 1]);
    expect(all.filter((x) => x.released.value).length).toBe(2);
  });

  it("opens the first round on its runner-up", () => {
    const p = new RoundPicker(6000);
    [
      candidate(0, 3, "Jab"),
      candidate(1, 9, "Jab, Cross, Left Kick"),
      candidate(2, 7, "Right Knee"),
    ].forEach(({ c }) => p.offer(c));
    expect(p.pick(6000, newReelSoFar(), true).map((c) => c.seq)).toEqual([2, 0, 1]);
  });

  it("shows a technique once a round, and at most twice across the reel", () => {
    const soFar = newReelSoFar();
    const p = new RoundPicker(20000);
    [
      candidate(0, 9, "Jab, Cross"),
      candidate(1, 8, "Jab, Cross"),
      candidate(2, 7, "Jab, Cross"),
      candidate(3, 2, "Teep"),
    ].forEach(({ c }) => p.offer(c));
    // The better take only: twice in a round, back to back, read as a replay.
    expect(p.pick(20000, soFar).map((c) => c.seq)).toEqual([3, 0]);
    // A later round may show it again...
    const q = new RoundPicker(20000);
    q.offer(candidate(4, 9, "Jab, Cross").c);
    q.offer(candidate(5, 3, "Hook").c);
    expect(q.pick(20000, soFar).map((c) => c.seq)).toEqual([5, 4]);
    // ...but twice is enough.
    const r = new RoundPicker(20000);
    r.offer(candidate(6, 9, "Jab, Cross").c);
    expect(r.pick(20000, soFar)).toEqual([]);
  });

  it("drops a clip rather than show the same technique twice running", () => {
    const soFar = newReelSoFar();
    const p = new RoundPicker(20000);
    p.offer(candidate(0, 9, "Teep").c);
    p.pick(20000, soFar);
    // With something else to open on, the teep moves along...
    const q = new RoundPicker(20000);
    q.offer(candidate(1, 5, "Teep").c);
    q.offer(candidate(2, 9, "Hook").c);
    expect(q.pick(20000, soFar).map((c) => c.seq)).toEqual([2, 1]);
    // ...and with nothing else, it goes.
    const r = new RoundPicker(20000);
    r.offer(candidate(3, 9, "Teep").c);
    expect(r.pick(20000, soFar)).toEqual([]);
  });

  it("never runs the same technique twice in a row", () => {
    const list = [
      candidate(0, 1, "Teep").c,
      candidate(1, 1, "Jab").c,
      candidate(2, 1, "Jab").c,
      candidate(3, 1, "Hook").c,
    ];
    const keys = avoidRepeatsInARow(list, "teep").map(techniqueKey);
    for (let i = 1; i < keys.length; i++) expect(keys[i]).not.toBe(keys[i - 1]);
    expect(keys[0]).not.toBe("teep");
  });

  it("lets go of clips with nothing in them straight away", () => {
    const p = new RoundPicker(6000);
    const stare = candidate(0, 0, "Jab");
    p.offer(stare.c);
    expect(stare.released.value).toBe(true);
  });

  it("holds only what the round could use, however long it runs", () => {
    const p = new RoundPicker(6000);
    const all = Array.from({ length: 60 }, (_, i) => candidate(i, i + 1, `T${i}`));
    all.forEach(({ c }) => p.offer(c));
    expect(all.filter((x) => !x.released.value).length).toBeLessThanOrEqual(12);
  });
});

describe("reel length", () => {
  it("runs about 4 seconds per minute of work, 12s to 60s", () => {
    expect(reelBudgetMs(2 * 60_000)).toBe(12000);
    expect(reelBudgetMs(10 * 60_000)).toBe(40000);
    expect(reelBudgetMs(15 * 60_000)).toBe(60000);
    expect(reelBudgetMs(60 * 60_000)).toBe(60000);
    // 5 × 3 minutes: 12 seconds from each round.
    expect(roundBudgetMs(15 * 60_000, 5)).toBe(12000);
  });
});

describe("framing the fighter", () => {
  /** A 27×48 portrait grid with movement in one block of cells. */
  const heatAt = (x0: number, x1: number, y0: number, y1: number) => {
    const w = 27;
    const h = 48;
    const cells = new Float32Array(w * h);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) cells[y * w + x] = 1;
    return { w, h, cells };
  };

  it("closes in on where the fighter moved, keeping the frame's shape", () => {
    const c = cropFromHeat(heatAt(11, 16, 18, 34));
    expect(c.w).toBe(c.h);
    expect(c.w).toBeLessThan(1);
    expect(c.w).toBeGreaterThanOrEqual(MIN_CROP);
    // The movement is inside the crop.
    expect(c.x).toBeLessThanOrEqual(11 / 27);
    expect(c.x + c.w).toBeGreaterThanOrEqual(16 / 27);
    expect(c.y).toBeLessThanOrEqual(18 / 48);
    expect(c.y + c.h).toBeGreaterThanOrEqual(34 / 48);
  });

  it("never zooms past the point where the picture goes soft", () => {
    const c = cropFromHeat(heatAt(13, 14, 24, 25));
    expect(c.w).toBe(MIN_CROP);
  });

  it("stays inside the frame when the fighter is at its edge", () => {
    const c = cropFromHeat(heatAt(0, 4, 40, 48));
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.y + c.h).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("shows the whole frame with nothing to go by", () => {
    expect(cropFromHeat(null)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it("pushes in slowly through a clip, about its centre", () => {
    const crop = { x: 0.2, y: 0.1, w: 0.6, h: 0.6 };
    const start = cropAt(crop, 0);
    const end = cropAt(crop, 1);
    expect(start).toEqual(crop);
    expect(end.w).toBeLessThan(start.w);
    expect(end.x + end.w / 2).toBeCloseTo(start.x + start.w / 2);
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
