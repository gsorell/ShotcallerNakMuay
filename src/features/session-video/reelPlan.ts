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
  /**
   * Strikes heard landing in the kept part (pads, bag). Absent on clips
   * planned before the reel was paced: their volume then comes from the call.
   */
  hits?: number;
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
      hits: cut.hits,
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
 * How much is going on in a clip: the strikes called, or the strikes heard
 * landing if more were (a combination thrown twice on the pads).
 */
export const clipVolume = (c: ReelCandidate): number =>
  Math.max(strikesIn(c.calls), c.hits ?? 0);

/** Where in the reel it peaks, as a fraction of the way through. */
export const ARC_PEAK_AT = 0.75;
const ARC_OPEN = 0.15;
const ARC_CLOSE = 0.35;

/**
 * The reel's shape (user, 2026-11-22): it opens slow, builds to its highest
 * volume about three quarters through, then tapers. The intensity wanted at
 * `x`, 0–1 of the way through, as a share of the peak.
 */
export const arcTarget = (x: number): number =>
  x <= ARC_PEAK_AT
    ? ARC_OPEN + ((1 - ARC_OPEN) * x) / ARC_PEAK_AT
    : 1 - ((1 - ARC_CLOSE) * (x - ARC_PEAK_AT)) / (1 - ARC_PEAK_AT);

/**
 * Puts clips in the reel's arc (arcTarget): the quietest clips where the arc
 * is lowest, the busiest at its peak. Among equally busy clips the better
 * one goes where the arc is higher, so the close (which sits above the
 * opening) gets a strong clip to finish on. Rounds don't set the order.
 *
 * Then no technique type twice running: a clip that repeats the one before
 * it swaps with the nearest later clip that fits. With `dropRepeats` a clip
 * no swap can fix leaves the reel; without it (clips someone picked by hand)
 * it stays.
 */
export const arcOrder = (
  clips: ReelCandidate[],
  { dropRepeats = true }: { dropRepeats?: boolean } = {}
): ReelCandidate[] => {
  const n = clips.length;
  if (n < 2) return [...clips];
  const slots = Array.from({ length: n }, (_, i) => ({ i, want: arcTarget(i / (n - 1)) }))
    // Lowest wanted first; between equals, the earlier slot.
    .sort((a, b) => a.want - b.want || a.i - b.i);
  const byVolume = [...clips].sort(
    (a, b) => clipVolume(a) - clipVolume(b) || a.score - b.score || a.fromMs - b.fromMs
  );
  const out: ReelCandidate[] = new Array(n);
  slots.forEach((s, k) => (out[s.i] = byVolume[k]!));

  const fits = (list: ReelCandidate[], at: number, c: ReelCandidate) =>
    list[at - 1]?.family !== c.family && list[at + 1]?.family !== c.family;
  for (let i = 1; i < out.length; i++) {
    if (out[i]!.family !== out[i - 1]!.family) continue;
    let j = i + 1;
    for (; j < out.length; j++) {
      const a = out[i]!;
      const b = out[j]!;
      const swapped = [...out];
      swapped[i] = b;
      swapped[j] = a;
      if (fits(swapped, i, b) && fits(swapped, j, a)) break;
    }
    if (j < out.length) [out[i], out[j]] = [out[j]!, out[i]!];
    else if (dropRepeats) out.splice(i--, 1);
  }
  return out;
};

/**
 * The reel: the best clips that fit `budgetMs`, every round represented if
 * it has anything to show, each technique type (family) at most
 * MAX_SHOWINGS times and once a round, then put in the reel's arc
 * (arcOrder): slow open, building to the busiest clips, tapering to the end.
 * Never the same type twice running.
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
  return arcOrder(picked);
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
