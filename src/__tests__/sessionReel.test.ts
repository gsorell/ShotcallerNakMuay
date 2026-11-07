import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CallInfo } from "@/features/session-video/calloutSignal";
import {
  RoundPicker,
  reelBudgetMs,
  roundBudgetMs,
  scoreClip,
  techniqueWeight,
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
  it("keeps the movement and cuts the waiting either side", () => {
    const cut = cutClip(samplesFor(5500, [[1000, 2500]]), 5500, LEVELS);
    expect(cut.startMs).toBe(700);
    expect(cut.endMs).toBe(2900);
    expect(cut.motion).toBeGreaterThan(0);
  });

  it("ends just after the last strike lands, when strikes are heard", () => {
    const cut = cutClip(
      samplesFor(6000, [[1000, 4500]]),
      6000,
      LEVELS,
      [1200, 1600, 2000]
    );
    expect(cut.hits).toBe(3);
    expect(cut.endMs).toBe(2450);
  });

  it("comes back empty for a stare", () => {
    const cut = cutClip(samplesFor(5000, []), 5000, LEVELS);
    expect(cut.endMs).toBe(cut.startMs);
  });

  it("never keeps more than one combination's worth", () => {
    const cut = cutClip(samplesFor(9000, [[500, 8500]]), 9000, LEVELS);
    expect(cut.endMs - cut.startMs).toBe(MAX_KEEP_MS);
  });

  it("keeps the stretch with the strikes in it when it must choose", () => {
    const cut = cutClip(
      samplesFor(9000, [[500, 8500]]),
      9000,
      LEVELS,
      [6000, 6400, 6800]
    );
    expect(cut.hits).toBe(3);
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
    const p = new RoundPicker();
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
    const p = new RoundPicker();
    [
      candidate(0, 3, "Jab"),
      candidate(1, 9, "Jab, Cross, Left Kick"),
      candidate(2, 7, "Right Knee"),
    ].forEach(({ c }) => p.offer(c));
    expect(p.pick(6000, new Set(), true).map((c) => c.seq)).toEqual([2, 0, 1]);
  });

  it("never shows the same technique twice", () => {
    const p = new RoundPicker();
    const shown = new Set<string>();
    [candidate(0, 9, "Jab, Cross"), candidate(1, 8, "Jab, Cross"), candidate(2, 2, "Teep")]
      .forEach(({ c }) => p.offer(c));
    expect(p.pick(6000, shown).map((c) => c.seq)).toEqual([2, 0]);
    // ...nor in a later round.
    const q = new RoundPicker();
    q.offer(candidate(3, 9, "Jab, Cross").c);
    expect(q.pick(6000, shown)).toEqual([]);
  });

  it("lets go of clips with nothing in them straight away", () => {
    const p = new RoundPicker();
    const stare = candidate(0, 0, "Jab");
    p.offer(stare.c);
    expect(stare.released.value).toBe(true);
  });

  it("holds only a handful per round however long it runs", () => {
    const p = new RoundPicker();
    const all = Array.from({ length: 60 }, (_, i) => candidate(i, i + 1, `T${i}`));
    all.forEach(({ c }) => p.offer(c));
    expect(all.filter((x) => !x.released.value).length).toBeLessThanOrEqual(12);
  });
});

describe("reel length", () => {
  it("grows with the session up to 30s, shared across the rounds", () => {
    expect(reelBudgetMs(1)).toBe(12000);
    expect(reelBudgetMs(5)).toBe(30000);
    expect(roundBudgetMs(5)).toBe(6000);
  });
});
