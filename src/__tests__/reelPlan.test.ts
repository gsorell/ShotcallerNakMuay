import { describe, expect, it } from "vitest";

import { reelBudgetMs, techniqueFamily } from "@/features/session-video/highlights";
import {
  MAX_SEGMENT_MS,
  MIN_VISIBLE,
  OVERLAP_MS,
  PREROLL_MS,
  ARC_PEAK_AT,
  applyFraming,
  arcOrder,
  clipVolume,
  callWindows,
  exportRanges,
  pickReel,
  probeTimes,
  reelCandidates,
  shortlist,
  type FramingFrame,
  type ReelCandidate,
  type SessionTimeline,
  type TimelineCall,
} from "@/features/session-video/reelPlan";

const call = (t: number, text: string, between = false): TimelineCall => ({
  t,
  text,
  between,
  combo: text.includes(","),
});

/** Still at 0.01, a burst of `level` for 1.2s starting 300ms after each call. */
const motionFor = (endMs: number, calls: TimelineCall[], level = 0.08) => {
  const out = [];
  for (let at = 0; at <= endMs; at += 100) {
    const busy = calls.some((c) => !c.between && at >= c.t + 300 && at <= c.t + 1500);
    out.push({ at, m: busy ? level : 0.01 });
  }
  return out;
};

const TECHS = ["Jab, Cross", "Left Kick", "Jab, Knee", "Teep", "Elbow", "Cross, Right Kick", "Low Kick"];

/** Rounds of 60s with 10s rests; a call every 5s through each round. */
const session = (rounds = 2): SessionTimeline => {
  const calls: TimelineCall[] = [];
  const work = [];
  const roundEnds = [];
  let k = 0;
  for (let r = 0; r < rounds; r++) {
    const from = 2000 + r * 70000;
    const to = from + 60000;
    work.push({ fromMs: from, toMs: to });
    roundEnds.push(to);
    for (let t = from + 3000; t < to - 2000; t += 5000) calls.push(call(t, TECHS[k++ % TECHS.length]!));
  }
  const end = work[work.length - 1]!.toMs;
  return {
    calls,
    speech: [],
    hits: [],
    motion: motionFor(end + 3000, calls),
    work,
    roundEnds,
    title: { fromMs: 2000, toMs: 3400 },
    endCard: { fromMs: end, toMs: end + 2500 },
  };
};

const cand = (p: Partial<ReelCandidate> & { seq: number }): ReelCandidate => ({
  round: 0,
  fromMs: p.seq * 5000,
  toMs: p.seq * 5000 + 1500,
  calls: [],
  family: "kick",
  score: 1,
  ...p,
});

describe("technique families", () => {
  it("sees calls that look the same on the bag as one", () => {
    expect(techniqueFamily("Jab, Cross, Left Kick")).toBe(techniqueFamily("Cross, Right Kick"));
    expect(techniqueFamily("Jab, Cross, Left Kick")).toBe("punch→kick");
  });

  it("tells the kinds of strike apart", () => {
    const fams = ["Jab, Knee", "Teep", "Elbow", "Low Kick", "Left Kick", "Jab, Cross"].map(techniqueFamily);
    expect(new Set(fams).size).toBe(6);
  });

  it("leaves out a check after an attack, but keeps defence on its own", () => {
    expect(techniqueFamily("Left Kick, Check")).toBe("kick");
    expect(techniqueFamily("Check")).toBe("defence");
  });
});

describe("reel length", () => {
  it("runs 12s at least and reaches 40s for a 5 × 3 session", () => {
    expect(reelBudgetMs(0)).toBe(12000);
    expect(reelBudgetMs(15 * 60000)).toBe(40000);
    expect(reelBudgetMs(60 * 60000)).toBe(40000);
  });
});

describe("the stretch each callout is judged over", () => {
  it("opens before the call and overlaps the next one's start", () => {
    const tl = { ...session(1), calls: [call(5000, "Jab"), call(8000, "Teep")] };
    const [a, b] = callWindows(tl);
    expect(a!.fromMs).toBe(5000 - PREROLL_MS);
    expect(a!.toMs).toBe(8000 - PREROLL_MS + OVERLAP_MS);
    expect(b!.fromMs).toBe(8000 - PREROLL_MS);
  });

  it("folds a between-call into the combination before it", () => {
    const tl = { ...session(1), calls: [call(5000, "Jab, Cross"), call(6500, "Check", true), call(9000, "Teep")] };
    const ws = callWindows(tl);
    expect(ws).toHaveLength(2);
    expect(ws[0]!.calls.map((c) => c.text)).toEqual(["Jab, Cross", "Check"]);
  });

  it("stops at the end of the round, and at a backstop with no next call", () => {
    const tl = { ...session(1), calls: [call(60000, "Jab")] };
    expect(callWindows(tl)[0]!.toMs).toBe(62000);
    const long = { ...session(1), calls: [call(5000, "Jab")] };
    expect(callWindows(long)[0]!.toMs).toBe(5000 - PREROLL_MS + MAX_SEGMENT_MS);
  });

  it("judges nothing called during a rest", () => {
    const tl = { ...session(2), calls: [call(66000, "Jab")] };
    expect(callWindows(tl)).toHaveLength(0);
  });
});

describe("candidates", () => {
  it("trims each callout to its action and knows its round", () => {
    const cands = reelCandidates(session(2));
    expect(cands.length).toBeGreaterThan(15);
    for (const c of cands) {
      expect(c.toMs - c.fromMs).toBeGreaterThanOrEqual(1200);
      expect(c.toMs - c.fromMs).toBeLessThan(5000);
    }
    expect(new Set(cands.map((c) => c.round))).toEqual(new Set([0, 1]));
  });

  it("leaves the opening to the title", () => {
    const tl = session(1);
    for (const c of reelCandidates(tl)) expect(c.fromMs).toBeGreaterThanOrEqual(tl.title!.toMs);
  });

  it("drops anything near the camera being handled", () => {
    const tl = session(1);
    const at = tl.calls[3]!.t + 600;
    tl.motion = tl.motion.map((s) => (Math.abs(s.at - at) < 200 ? { ...s, disturbed: true } : s));
    const cands = reelCandidates(tl);
    expect(cands.some((c) => c.fromMs <= at && c.toMs >= at)).toBe(false);
  });

  it("shortlists a few times what each round could use", () => {
    const cands = reelCandidates(session(2));
    const short = shortlist(cands, 8000);
    expect(short.length).toBeLessThan(cands.length);
    expect(new Set(short.map((c) => c.round)).size).toBe(2);
  });
});

describe("framing", () => {
  const frames = (c: ReelCandidate, visible: number, h = 0.6): FramingFrame[] =>
    probeTimes(c).map((tMs) => ({ tMs, person: true, visible, box: { x: 0.2, y: 0.2, w: 0.3, h } }));

  it("drops a clip where the fighter is hidden or out of shot", () => {
    const a = cand({ seq: 1 });
    const b = cand({ seq: 2 });
    const out = applyFraming([a, b], [...frames(a, 1), ...frames(b, MIN_VISIBLE - 0.1)]);
    expect(out.map((c) => c.seq)).toEqual([1]);
  });

  it("drops a clip where any frame has nobody in it", () => {
    const a = cand({ seq: 1 });
    const fs = frames(a, 1);
    fs[1] = { tMs: fs[1]!.tMs, person: false, visible: 0 };
    expect(applyFraming([a], fs)).toHaveLength(0);
  });

  it("gives no verdict on a frame that couldn't be read", () => {
    const a = cand({ seq: 1 });
    const fs = probeTimes(a).map((tMs) => ({ tMs, person: false, visible: 0, error: "decode failed" }));
    expect(applyFraming([a], fs)).toEqual([a]);
  });

  it("favours a fighter who fills the frame, and keeps unprobed clips as they were", () => {
    const a = cand({ seq: 1 });
    const b = cand({ seq: 2 });
    const c = cand({ seq: 3 });
    const out = applyFraming([a, b, c], [...frames(a, 1, 0.8), ...frames(b, 1, 0.3)]);
    expect(out[0]!.score).toBeGreaterThan(out[1]!.score);
    expect(out[2]!.score).toBe(1);
  });
});

describe("picking the reel", () => {
  it("never shows a technique type more than twice, or twice in a round", () => {
    const cands = Array.from({ length: 12 }, (_, i) =>
      cand({ seq: i + 1, round: i % 3, family: i < 9 ? "kick" : `other${i}`, score: 10 - (i % 5) })
    );
    const picks = pickReel(cands, 60000);
    expect(picks.filter((c) => c.family === "kick").length).toBeLessThanOrEqual(2);
    for (const r of [0, 1, 2]) {
      const fams = picks.filter((c) => c.round === r).map((c) => c.family);
      expect(new Set(fams).size).toBe(fams.length);
    }
  });

  it("never runs the same type twice in a row", () => {
    const fams = ["kick", "knee", "punch", "teep", "elbow"];
    const cands = Array.from({ length: 30 }, (_, i) =>
      cand({ seq: i + 1, round: Math.floor(i / 6), family: fams[(i * 7) % 5]!, score: (i * 37) % 11 })
    );
    const picks = pickReel(cands, 40000);
    for (let i = 1; i < picks.length; i++) expect(picks[i]!.family).not.toBe(picks[i - 1]!.family);
  });

  it("gives every round a clip", () => {
    const cands = [
      cand({ seq: 1, round: 0, family: "a", score: 5 }),
      cand({ seq: 2, round: 0, family: "b", score: 9 }),
      cand({ seq: 3, round: 0, family: "c", score: 3 }),
      cand({ seq: 4, round: 1, family: "d", score: 0.1 }),
      cand({ seq: 5, round: 2, family: "e", score: 4 }),
    ];
    const picks = pickReel(cands, 7000);
    expect(new Set(picks.map((c) => c.round))).toEqual(new Set([0, 1, 2]));
  });

  it("opens slow, builds to its busiest clips three quarters through, then tapers", () => {
    // Filmed busiest first, so filmed order would be the wrong shape.
    const cands = Array.from({ length: 9 }, (_, i) =>
      cand({ seq: i + 1, round: Math.floor(i / 3), family: `f${i}`, hits: 9 - i, score: 1 })
    );
    const volumes = pickReel(cands, 60000).map((c) => c.hits!);
    expect(volumes).toHaveLength(9);
    const peak = volumes.indexOf(9);
    expect(peak / (volumes.length - 1)).toBeCloseTo(ARC_PEAK_AT, 1);
    for (let i = 1; i <= peak; i++) expect(volumes[i]!).toBeGreaterThan(volumes[i - 1]!);
    for (let i = peak + 1; i < volumes.length; i++) expect(volumes[i]!).toBeLessThan(volumes[i - 1]!);
    expect(volumes[0]).toBe(1);
    expect(volumes[volumes.length - 1]!).toBeGreaterThan(volumes[0]!);
  });

  it("closes on the better of two equally quiet clips", () => {
    const cands = [
      cand({ seq: 1, family: "a", hits: 1, score: 2 }),
      cand({ seq: 2, family: "b", hits: 1, score: 8 }),
      cand({ seq: 3, family: "c", hits: 5, score: 1 }),
    ];
    expect(arcOrder(cands).map((c) => c.seq)).toEqual([1, 3, 2]);
  });

  it("counts strikes called when none were heard", () => {
    const combo = { text: "Jab, Cross, Hook, Left Kick", between: false, combo: true };
    expect(clipVolume(cand({ seq: 1, calls: [combo] }))).toBe(4);
    expect(clipVolume(cand({ seq: 1, calls: [combo], hits: 6 }))).toBe(6);
  });

  it("keeps every hand-picked clip, even a repeat it can't separate", () => {
    const cands = [cand({ seq: 1, family: "kick" }), cand({ seq: 2, family: "kick" })];
    expect(arcOrder(cands)).toHaveLength(1);
    expect(arcOrder(cands, { dropRepeats: false })).toHaveLength(2);
  });

  it("stays within the budget beyond each round's best", () => {
    const cands = Array.from({ length: 20 }, (_, i) =>
      cand({ seq: i + 1, round: 0, family: `f${i}`, score: 20 - i })
    );
    const picks = pickReel(cands, 6000);
    expect(picks.reduce((n, c) => n + c.toMs - c.fromMs, 0)).toBeLessThanOrEqual(6000);
  });
});

describe("what gets cut out of the recording", () => {
  it("opens on the title, closes on the end card", () => {
    const tl = session(1);
    const picks = [cand({ seq: 2 }), cand({ seq: 5 })];
    const ranges = exportRanges(tl, picks);
    expect(ranges[0]).toEqual(tl.title);
    expect(ranges[ranges.length - 1]).toEqual(tl.endCard);
    expect(ranges).toHaveLength(4);
  });
});
