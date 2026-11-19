import type { CallInfo } from "./calloutSignal";
import {
  MAX_SHOWINGS,
  scoreClip,
  strikesIn,
  techniqueFamily,
  mainCall,
} from "./highlights";
import { cutClip, disturbedNear, motionLevels, undisturbed, type ClipCut } from "./motion";

/**
 * Plans the reel after the session, from what was recorded along the way.
 *
 * The reel used to be filmed clip by clip while the session ran and
 * re-filmed during the rests: three encoders at once on the phone, and every
 * frame compressed twice (the source came out at ~17 fps, the reel at 2.6
 * Mbps). Now only the full session is filmed. This works out, from its
 * timeline, which stretches of it make the reel; the phone then checks each
 * one's framing (is the whole fighter in shot?) and cuts them out of the
 * recording natively, once (see remux.ts: probeFraming, exportReel).
 *
 * All times are ms from the recording's first frame, which is also where
 * they sit in the uncut recording the reel is cut from.
 */

/** A clip starts this long before its callout: people throw on the first word. */
export const PREROLL_MS = 600;
/** And runs this long past the next one's start, so nothing is lost between. */
export const OVERLAP_MS = 900;
/** Longest stretch one callout is judged over, if no next callout comes. */
export const MAX_SEGMENT_MS = 9000;

/** Below this share of the body in shot, a clip isn't shown. */
export const MIN_VISIBLE = 0.7;
/** About how long a kept clip runs, for how many to look at closely. */
const TYPICAL_CLIP_MS = 1800;

export interface TimelineCall extends CallInfo {
  t: number;
}

/** As MotionMeter samples it, `at` in ms from the first frame. */
export interface MotionPoint {
  at: number;
  m: number;
  disturbed?: boolean;
}

export interface Span {
  fromMs: number;
  toMs: number;
}

/** Everything the session recorded about itself, beside the picture. */
export interface SessionTimeline {
  calls: TimelineCall[];
  /** When the app's own voice or sounds were playing: hits then don't count. */
  speech: { from: number; to: number }[];
  hits: number[];
  /** Movement, ten times a second, oldest first. */
  motion: MotionPoint[];
  /** When work was going on (rounds, not rests or pauses). */
  work: Span[];
  /** When each round ended. */
  roundEnds: number[];
  /** The title over the opening action, burned into the recording. */
  title?: Span;
  /** The end card, full frame, burned into the recording. */
  endCard?: Span;
}

export interface ReelCandidate {
  /** Order called. */
  seq: number;
  /** 0-based round it was called in. */
  round: number;
  fromMs: number;
  toMs: number;
  calls: CallInfo[];
  /** What it looks like on camera (see techniqueFamily). */
  family: string;
  score: number;
}

/** One clip's stretch of the recording, before it's trimmed to its action. */
export interface CallWindow {
  seq: number;
  fromMs: number;
  toMs: number;
  /** When its callout began. */
  callAt: number;
  calls: CallInfo[];
}

const lowerBound = (xs: { at: number }[], t: number): number => {
  let lo = 0;
  let hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid]!.at < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

/**
 * The stretch each callout is judged over: from PREROLL_MS before it to
 * OVERLAP_MS past the next one's start, or MAX_SEGMENT_MS (restarted by a
 * between-call, which belongs to the combination before it), and never past
 * the end of the work it was called in. A call in a rest or pause is none.
 */
export const callWindows = (tl: SessionTimeline): CallWindow[] => {
  const calls = [...tl.calls].sort((a, b) => a.t - b.t);
  const out: CallWindow[] = [];
  let seq = 0;
  for (let i = 0; i < calls.length; i++) {
    const c = calls[i]!;
    if (c.between) continue;
    seq += 1;
    const span = tl.work.find((s) => c.t >= s.fromMs - PREROLL_MS && c.t <= s.toMs);
    if (!span) continue;
    const from = Math.max(span.fromMs, c.t - PREROLL_MS);
    const own: CallInfo[] = [{ text: c.text, between: c.between, combo: c.combo }];
    let capFrom = from;
    let j = i + 1;
    for (; j < calls.length && calls[j]!.between; j++) {
      own.push({ text: calls[j]!.text, between: true, combo: calls[j]!.combo });
      capFrom = calls[j]!.t;
    }
    const next = calls[j];
    const ends = [capFrom + MAX_SEGMENT_MS, span.toMs];
    if (next) ends.push(next.t - PREROLL_MS + OVERLAP_MS);
    const to = Math.min(...ends);
    if (to > from) out.push({ seq, fromMs: from, toMs: to, callAt: c.t, calls: own });
  }
  return out;
};

const roundOf = (t: number, roundEnds: number[]): number =>
  roundEnds.filter((e) => e <= t).length;

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};

/**
 * Every callout worth considering: trimmed to its action (cutClip), with
 * anything near the camera being handled dropped, scored on what moved, what
 * landed and what was called (scoreClip) against this session's ordinary
 * clip. A clip under the opening title is left to the title.
 */
export const reelCandidates = (tl: SessionTimeline): ReelCandidate[] => {
  const calm = undisturbed(tl.motion);
  const hits = [...tl.hits].sort((a, b) => a - b);
  const inSpeech = (t: number) => tl.speech.some((s) => t >= s.from && t <= s.to);
  const titleEnd = tl.title ? tl.title.toMs : -Infinity;

  const cuts: { w: CallWindow; cut: ClipCut }[] = [];
  for (const w of callWindows(tl)) {
    const a = lowerBound(calm, w.fromMs);
    const b = lowerBound(calm, w.toMs + 1);
    const samples = calm.slice(a, b).map((s) => ({ t: s.at - w.fromMs, m: s.m }));
    // Still and busy as the minute before this clip's end saw them.
    const levels = motionLevels(calm.slice(Math.max(0, b - 600), b).map((s) => s.m));
    const heard = hits.filter((h) => h >= w.fromMs && h <= w.toMs);
    const cut = cutClip({
      samples,
      durationMs: w.toMs - w.fromMs,
      levels,
      hits: heard.map((h) => h - w.fromMs),
      cleanHits: heard.filter((h) => !inSpeech(h)).map((h) => h - w.fromMs),
      callAtMs: w.callAt - w.fromMs,
      strikes: strikesIn(w.calls),
    });
    if (cut.endMs <= cut.startMs) continue;
    if (disturbedNear(tl.motion, w.fromMs + cut.startMs, w.fromMs + cut.endMs)) continue;
    if (w.fromMs + cut.startMs < titleEnd) continue;
    cuts.push({ w, cut });
  }
  const norm = median(cuts.map((c) => c.cut.motion)) || 1e-6;
  return cuts
    .map(({ w, cut }) => ({
      seq: w.seq,
      round: roundOf(w.callAt, tl.roundEnds),
      fromMs: Math.round(w.fromMs + cut.startMs),
      toMs: Math.round(w.fromMs + cut.endMs),
      calls: w.calls,
      family: techniqueFamily(mainCall(w.calls)?.text ?? ""),
      score: scoreClip(cut, w.calls, norm),
    }))
    .filter((c) => c.score > 0);
};

/**
 * The candidates worth looking at closely (their framing is checked on the
 * phone, a few frames each): each round's best, about three times what the
 * round could use.
 */
export const shortlist = (cands: ReelCandidate[], budgetMs: number): ReelCandidate[] => {
  const rounds = [...new Set(cands.map((c) => c.round))];
  const perRound = Math.max(4, Math.ceil((3 * budgetMs) / Math.max(1, rounds.length) / TYPICAL_CLIP_MS));
  return rounds.flatMap((r) =>
    cands
      .filter((c) => c.round === r)
      .sort((a, b) => b.score - a.score)
      .slice(0, perRound)
  );
};

/** Where a candidate's framing is checked: just in, the middle, just before the end. */
export const probeTimes = (c: ReelCandidate): number[] => {
  const inset = Math.min(150, (c.toMs - c.fromMs) / 4);
  return [c.fromMs + inset, Math.round((c.fromMs + c.toMs) / 2), c.toMs - inset].map(Math.round);
};

/** What the phone saw at one moment: is someone there, how much of them, where. */
export interface FramingFrame {
  tMs: number;
  person: boolean;
  /** Share of the body's main points detected and inside the frame, 0–1. */
  visible: number;
  /** Where they are, as fractions of the frame. */
  box?: { x: number; y: number; w: number; h: number };
  /** The frame couldn't be read or checked: no verdict either way. */
  error?: string;
}

/**
 * Drops the candidates the fighter isn't fully in (behind the bag, out of
 * shot at an edge: any probed frame below MIN_VISIBLE), and favours the ones
 * where they fill more of the frame. A candidate with no frames probed is
 * judged as it was: the check couldn't run.
 */
export const applyFraming = (
  cands: ReelCandidate[],
  frames: FramingFrame[]
): ReelCandidate[] =>
  cands.flatMap((c) => {
    const times = new Set(probeTimes(c));
    const mine = frames.filter((f) => times.has(Math.round(f.tMs)) && !f.error);
    if (!mine.length) return [c];
    if (mine.some((f) => !f.person || f.visible < MIN_VISIBLE)) return [];
    const h = mine.reduce((n, f) => n + (f.box?.h ?? 0), 0) / mine.length;
    const size = 0.7 + 0.5 * Math.min(1, h / 0.8);
    return [{ ...c, score: c.score * size }];
  });

/**
 * The reel: the best clips that fit `budgetMs`, every round represented if
 * it has anything to show, each technique type (family) at most
 * MAX_SHOWINGS times and once a round. In round order; within a round, in
 * the order filmed with the round's best last, so each round builds to it.
 * Never the same type twice running: where a round would open on the type
 * the last one ended on, another of its clips opens it, or that clip goes.
 */
export const pickReel = (cands: ReelCandidate[], budgetMs: number): ReelCandidate[] => {
  const byScore = [...cands].sort((a, b) => b.score - a.score);
  const shown = new Map<string, number>();
  const roundFamilies = new Map<number, Set<string>>();
  const picked: ReelCandidate[] = [];
  let used = 0;
  const take = (c: ReelCandidate): boolean => {
    const fam = roundFamilies.get(c.round) ?? new Set<string>();
    if ((shown.get(c.family) ?? 0) >= MAX_SHOWINGS || fam.has(c.family)) return false;
    picked.push(c);
    fam.add(c.family);
    roundFamilies.set(c.round, fam);
    shown.set(c.family, (shown.get(c.family) ?? 0) + 1);
    used += c.toMs - c.fromMs;
    return true;
  };
  // Every round with something worth showing gets its best.
  const rounds = [...new Set(cands.map((c) => c.round))].sort((a, b) => a - b);
  for (const r of rounds) {
    for (const c of byScore) if (c.round === r && take(c)) break;
  }
  for (const c of byScore) {
    if (picked.includes(c)) continue;
    if (used + c.toMs - c.fromMs > budgetMs) continue;
    take(c);
  }

  const out: ReelCandidate[] = [];
  for (const r of rounds) {
    const mine = picked.filter((c) => c.round === r);
    if (!mine.length) continue;
    const best = mine.reduce((a, b) => (b.score > a.score ? b : a));
    const ordered = [...mine.filter((c) => c !== best).sort((a, b) => a.fromMs - b.fromMs), best];
    const prev = out[out.length - 1]?.family;
    if (prev !== undefined && ordered[0]!.family === prev) {
      const k = ordered.findIndex((c, i) => i > 0 && i < ordered.length - 1 && c.family !== prev);
      if (k > 0) [ordered[0], ordered[k]] = [ordered[k]!, ordered[0]!];
      else ordered.shift();
    }
    out.push(...ordered);
  }
  return out;
};

/**
 * The stretches of the recording to cut out, in order: the opening title
 * over the action, the picked clips, the end card.
 */
export const exportRanges = (tl: SessionTimeline, picks: ReelCandidate[]): Span[] => [
  ...(tl.title ? [tl.title] : []),
  ...picks.map((c) => ({ fromMs: c.fromMs, toMs: c.toMs })),
  ...(tl.endCard ? [tl.endCard] : []),
];
