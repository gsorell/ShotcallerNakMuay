import { describe, expect, it } from "vitest";

import { isDefenceOnly, reelBudgetMs, techniqueFamily } from "@/features/session-video/highlights";
import {
  CARD_SETTLE_MS,
  CROP_MIN,
  LEAD_MS,
  MAX_CLIP_MS,
  MIN_BALANCE,
  MIN_VISIBLE,
  RECORDING_LAG_MS,
  TAIL_MS,
  WATERMARK_TOP,
  finishBalance,
  applyFraming,
  callsFor,
  exportRanges,
  findFlurries,
  fitCrop,
  flurryClip,
  notTheFighter,
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

describe("finding the flurries", () => {
  it("finds each burst of movement, and only those", () => {
    const tl = session(1);
    const fl = findFlurries(tl);
    expect(fl).toHaveLength(tl.calls.length);
    for (const [i, f] of fl.entries()) {
      expect(f.fromMs).toBeGreaterThanOrEqual(tl.calls[i]!.t + 100);
      expect(f.toMs).toBeLessThanOrEqual(tl.calls[i]!.t + 1800);
    }
  });

  it("runs a beat between strikes together, and splits a real stop", () => {
    const tl = session(1);
    const busy = (at: number) =>
      (at >= 10000 && at <= 11000) || (at >= 11400 && at <= 12400) || (at >= 15000 && at <= 16000);
    tl.motion = tl.motion.map((s) => ({ ...s, m: busy(s.at) ? 0.08 : 0.01 }));
    const fl = findFlurries(tl);
    expect(fl).toHaveLength(2);
    expect(fl[0]!.toMs - fl[0]!.fromMs).toBeGreaterThan(2200);
  });

  it("judges each round against itself: a camera moved closer isn't busier", () => {
    const tl = session(2);
    const second = tl.work[1]!.fromMs;
    tl.motion = tl.motion.map((s) => (s.at >= second ? { ...s, m: s.m * 4 } : s));
    const fl = findFlurries(tl);
    expect(fl.filter((f) => f.round === 0).length).toBe(fl.filter((f) => f.round === 1).length);
  });

  it("ignores rests", () => {
    const tl = session(2);
    tl.motion = tl.motion.map((s) => (s.at > 63000 && s.at < 71000 ? { ...s, m: 0.2 } : s));
    expect(findFlurries(tl).some((f) => f.fromMs > 62000 && f.toMs < 72000)).toBe(false);
  });
});

describe("a flurry's clip", () => {
  const work = { fromMs: 0, toMs: 60000 };

  it("opens just before the first movement and ends just after the last", () => {
    const clip = flurryClip({ fromMs: 10000, toMs: 11500, energy: 3, round: 0 }, work);
    expect(clip).toEqual({ fromMs: 10000 - LEAD_MS, toMs: 11500 + TAIL_MS });
  });

  it("keeps the finish and loses the front when it runs long", () => {
    const clip = flurryClip({ fromMs: 10000, toMs: 16000, energy: 3, round: 0 }, work);
    expect(clip.toMs).toBe(16000 + TAIL_MS);
    expect(clip.toMs - clip.fromMs).toBe(MAX_CLIP_MS);
  });

  it("stays inside the round", () => {
    const clip = flurryClip({ fromMs: 59000, toMs: 59900, energy: 3, round: 0 }, work);
    expect(clip.toMs).toBe(60000);
  });
});

describe("what was called for a clip", () => {
  it("is the last combination called before it got going, with its between-call", () => {
    const calls = [call(5000, "Jab"), call(8000, "Jab, Cross, Left Kick"), call(9500, "Check", true), call(12000, "Teep")];
    expect(callsFor(calls, { fromMs: 8700, toMs: 11000 }).map((c) => c.text)).toEqual([
      "Jab, Cross, Left Kick",
      "Check",
    ]);
  });

  it("is nothing when nothing was called near it", () => {
    expect(callsFor([call(5000, "Jab")], { fromMs: 20000, toMs: 22000 })).toEqual([]);
  });

  it("knows a call that is only defence", () => {
    expect(isDefenceOnly("Check")).toBe(true);
    expect(isDefenceOnly("Long Guard, Right Knee")).toBe(false);
  });
});

describe("candidates", () => {
  it("makes a clip of each flurry, knows its round and what was called", () => {
    const tl = session(2);
    const cands = reelCandidates(tl);
    expect(cands.length).toBeGreaterThan(15);
    for (const c of cands) {
      expect(c.toMs - c.fromMs).toBeGreaterThanOrEqual(1200);
      expect(c.toMs - c.fromMs).toBeLessThanOrEqual(MAX_CLIP_MS);
      expect(c.calls).toHaveLength(1);
    }
    expect(new Set(cands.map((c) => c.round))).toEqual(new Set([0, 1]));
  });

  it("scores a flurry that lands above one that only moved", () => {
    const tl = session(1);
    const [a, b] = [tl.calls[2]!.t, tl.calls[3]!.t];
    tl.hits = [a + 600, a + 900, a + 1200];
    const cands = reelCandidates(tl);
    const at = (t: number) => cands.find((c) => c.fromMs <= t + 600 && c.toMs >= t + 600)!;
    expect(at(a).score).toBeGreaterThan(at(b).score);
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
    const out = applyFraming([a, b, c], [...frames(a, 1, 0.65), ...frames(b, 1, 0.55)]);
    expect(out[0]!.score).toBeGreaterThan(out[1]!.score);
    expect(out[2]!.score).toBe(1);
  });

  it("drops a clip that shows someone else, not one odd frame", () => {
    // The 2026-11-24 session: a child by the bag read as a taller person off to one side.
    const usual = { x: 0.45, y: 0.48, w: 0.12, h: 0.235 };
    const child = { x: 0.36, y: 0.51, w: 0.12, h: 0.3 };
    const cs = Array.from({ length: 4 }, (_, i) => cand({ seq: i + 1 }));
    const fs = cs.flatMap((c) => probeTimes(c).map((tMs) => ({ tMs, person: true, visible: 1, box: usual })));
    const [kid, odd] = [cs[0]!, cs[1]!];
    const swap = (c: ReelCandidate, n: number) =>
      probeTimes(c)
        .slice(0, n)
        .forEach((t) => (fs.find((f) => f.tMs === t)!.box = child));
    swap(kid, 2);
    swap(odd, 1);
    expect(applyFraming(cs, fs).map((c) => c.seq)).toEqual([2, 3, 4]);
  });

  it("tells the fighter's own movement from someone else", () => {
    const usual = { h: 0.235, cx: 0.51 };
    expect(notTheFighter({ x: 0.45, y: 0.48, w: 0.12, h: 0.25 }, usual)).toBe(false);
    expect(notTheFighter({ x: 0.4, y: 0.5, w: 0.3, h: 0.22 }, usual)).toBe(false);
    expect(notTheFighter({ x: 0.38, y: 0.53, w: 0.16, h: 0.3 }, usual)).toBe(true);
    expect(notTheFighter({ x: 0.33, y: 0.52, w: 0.18, h: 0.28 }, usual)).toBe(true);
  });
});

describe("cropping in on the fighter", () => {
  const small = { x: 0.45, y: 0.48, w: 0.12, h: 0.235 };

  it("crops a small fighter as close as the picture allows, centred on them", () => {
    const crop = fitCrop([small, small, small], { h: 0.235, cx: 0.51 })!;
    expect(crop.w).toBe(CROP_MIN);
    expect(crop.h).toBe(CROP_MIN);
    expect(crop.x).toBeCloseTo(0.51 - CROP_MIN / 2, 2);
  });

  it("never reaches down into the burned-in watermark, or off the frame", () => {
    const low = { x: 0.02, y: 0.6, w: 0.12, h: 0.3 };
    const crop = fitCrop([low], { h: 0.3, cx: 0.08 })!;
    expect(crop.x).toBe(0);
    expect(crop.y + crop.h).toBeLessThanOrEqual(WATERMARK_TOP + 1e-9);
  });

  it("leaves a fighter who already fills the frame alone", () => {
    expect(fitCrop([{ x: 0.2, y: 0.1, w: 0.4, h: 0.8 }], { h: 0.8, cx: 0.4 })).toBeUndefined();
  });

  it("crops every probed clip in a round that shows the fighter", () => {
    const cs = Array.from({ length: 3 }, (_, i) => cand({ seq: i + 1 }));
    const fs = cs.flatMap((c) => probeTimes(c).map((tMs) => ({ tMs, person: true, visible: 1, box: small })));
    for (const c of applyFraming(cs, fs)) expect(c.crop?.w).toBe(CROP_MIN);
  });
});

describe("finishing in balance", () => {
  const stance = { x: 0.3, y: 0.2, w: 0.25, h: 0.6 };

  it("rates a rep that ends where it began as clean", () => {
    expect(finishBalance(stance, stance)).toBe(1);
    // A small guard adjustment or a short step costs nothing.
    expect(finishBalance(stance, { ...stance, x: 0.35, y: 0.22 })).toBe(1);
  });

  it("marks down a finish crouched, head dropped, or staggered off", () => {
    const crouched = { ...stance, y: 0.32, h: 0.48 };
    const staggered = { ...stance, x: 0.62 };
    expect(finishBalance(stance, crouched)).toBeLessThan(0.5);
    expect(finishBalance(stance, { ...stance, y: 0.4, h: 0.4 })).toBeLessThan(MIN_BALANCE);
    expect(finishBalance(stance, staggered)).toBeLessThan(1);
    expect(finishBalance(stance, staggered)).toBeGreaterThan(finishBalance(stance, crouched));
  });

  it("drops a clip that ends out of stance, and ranks a cleaner finish higher", () => {
    const clean = cand({ seq: 1 });
    const scrappy = cand({ seq: 2 });
    const fallen = cand({ seq: 3 });
    const at = (c: ReelCandidate, end: typeof stance): FramingFrame[] =>
      probeTimes(c).map((tMs, i, all) => ({
        tMs,
        person: true,
        visible: 1,
        box: i === all.length - 1 ? end : stance,
      }));
    const out = applyFraming(
      [clean, scrappy, fallen],
      [
        ...at(clean, stance),
        ...at(scrappy, { ...stance, x: 0.62 }),
        ...at(fallen, { ...stance, y: 0.4, h: 0.4 }),
      ]
    );
    expect(out.map((c) => c.seq)).toEqual([1, 2]);
    expect(out[0]!.score).toBeGreaterThan(out[1]!.score);
    expect(out[0]!.balance).toBe(1);
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

  it("keeps rounds in order, each ending on its best, and gives every round a clip", () => {
    const cands = [
      cand({ seq: 1, round: 0, family: "a", score: 5 }),
      cand({ seq: 2, round: 0, family: "b", score: 9 }),
      cand({ seq: 3, round: 0, family: "c", score: 3 }),
      cand({ seq: 4, round: 1, family: "d", score: 0.1 }),
      cand({ seq: 5, round: 2, family: "e", score: 4 }),
    ];
    const picks = pickReel(cands, 7000);
    expect(picks.map((c) => c.round)).toEqual([...picks.map((c) => c.round)].sort());
    expect(new Set(picks.map((c) => c.round))).toEqual(new Set([0, 1, 2]));
    const r0 = picks.filter((c) => c.round === 0);
    expect(r0[r0.length - 1]!.seq).toBe(2);
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
    expect(ranges[ranges.length - 1]!.fromMs).toBeGreaterThan(tl.endCard!.fromMs);
    expect(ranges).toHaveLength(4);
  });

  it("cuts on the recording's clock, which trails the timeline, and never opens the card on the room", () => {
    const tl = session(1);
    const pick = cand({ seq: 2 });
    const [, clip, card] = exportRanges(tl, [pick]);
    expect(clip!.fromMs - pick.fromMs).toBe(RECORDING_LAG_MS);
    expect(clip!.toMs - pick.toMs).toBe(RECORDING_LAG_MS);
    expect(card!.fromMs).toBe(tl.endCard!.fromMs + CARD_SETTLE_MS);
    // The 2026-11-24 card appeared 333 ms after it was stamped.
    expect(CARD_SETTLE_MS).toBeGreaterThan(333);
  });

  it("crops the clips, never the title or end card", () => {
    const tl = session(1);
    const crop = { x: 0.1, y: 0.2, w: 0.6, h: 0.6 };
    const ranges = exportRanges(tl, [cand({ seq: 2, crop })]);
    expect(ranges[1]!.crop).toEqual(crop);
    expect(ranges[0]!.crop).toBeUndefined();
    expect(ranges[2]!.crop).toBeUndefined();
  });
});
