import type { CallInfo } from "./calloutSignal";
import { HIT_WEIGHT, MAX_SHOWINGS, isDefenceOnly, techniqueFamily, mainCall } from "./highlights";
import { disturbedNear, undisturbed } from "./motion";

/**
 * Plans the reel after the session, from what was recorded along the way.
 *
 * Only the full session is filmed. This works out, from its timeline, which
 * stretches of it make the reel; the phone then checks each one's framing
 * (is the whole fighter in shot, and only them?) and cuts them out of the
 * recording natively, once, cropped in on the fighter (see remux.ts:
 * probeFraming, exportReel).
 *
 * Clips are found by movement, not by callout (user, 2026-11-24). Clips
 * built around each call kept whatever the clock gave them: on the
 * 2026-11-24 bag session the app's nine picks were 56–100% standing still,
 * while only 16% of the work was real movement at all. Now the reel is made
 * of flurries, the stretches where the fighter is actually moving, cut from
 * just before the first movement to just after they're back in stance. The
 * calls only say what each flurry was.
 *
 * All times are ms from the recording's first frame, which is also where
 * they sit in the uncut recording the reel is cut from.
 */

/** Movement is judged in steps this long (the meter samples ten a second). */
const STEP_MS = 100;
/** Smoothed over this many steps either side: one still frame mid-kick isn't a stop. */
const SMOOTH_STEPS = 2;
/**
 * Moving means this many times the round's ordinary movement (its median
 * step). Judged per round, since the camera is often moved between rounds.
 */
export const ACTIVE_TIMES_ORDINARY = 1.8;
/** Movement this close together is one flurry: a beat between strikes isn't a stop. */
const JOIN_GAP_MS = 600;
/** Shorter movement is a flinch or a bounce in stance, not a technique. */
const MIN_FLURRY_MS = 800;
/** Kept before the first movement: the weight shifting into it. */
export const LEAD_MS = 250;
/** Kept after the last movement: the guard coming back up. */
export const TAIL_MS = 400;
/** The longest clip. Over it, the front goes and the finish stays. */
export const MAX_CLIP_MS = 3200;
/** The shortest clip: anything less is gone before it's seen. */
export const MIN_CLIP_MS = 1200;
/** How long before a flurry its callout may have come. */
const CALL_LOOKBACK_MS = 4000;
/** Hits this close to the app's voice may be the voice, not a strike. */
const SPEECH_PAD_MS = 150;

/** Below this share of the body in shot, a clip isn't shown. */
export const MIN_VISIBLE = 0.7;
/** About how long a kept clip runs, for how many to look at closely. */
const TYPICAL_CLIP_MS = 2400;

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

/** Part of the frame, as fractions of its width and height. */
export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
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
  /** Order filmed, from 1. */
  seq: number;
  /** 0-based round it was filmed in. */
  round: number;
  fromMs: number;
  toMs: number;
  /** What was called for it, if anything: the combination, then any between-call. */
  calls: CallInfo[];
  /** What it looks like on camera (see techniqueFamily). */
  family: string;
  score: number;
  /** How cleanly it finished, 0–1 (finishBalance), once framing was checked. */
  balance?: number;
  /** Where to crop in on the fighter (fitCrop), once framing was checked. */
  crop?: Crop;
}

/** A stretch of real movement, before it's padded into a clip. */
export interface Flurry {
  fromMs: number;
  toMs: number;
  /** How far above the round's ordinary its movement ran, on average. */
  energy: number;
  /** 0-based round. */
  round: number;
}

const roundOf = (t: number, roundEnds: number[]): number =>
  roundEnds.filter((e) => e <= t).length;

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};

const workAt = (tl: SessionTimeline, t: number): Span | undefined =>
  tl.work.find((s) => t >= s.fromMs && t < s.toMs);

/**
 * Every stretch of the work where the fighter is really moving: the
 * movement, at its busiest in each step, smoothed, above
 * ACTIVE_TIMES_ORDINARY times the round's median, joined across short
 * beats, at least MIN_FLURRY_MS long. Disturbances (the camera handled) and
 * the time around them are left out.
 */
export const findFlurries = (tl: SessionTimeline): Flurry[] => {
  const steps = new Map<number, number>();
  for (const s of undisturbed(tl.motion)) {
    if (!workAt(tl, s.at)) continue;
    const k = Math.floor(s.at / STEP_MS);
    steps.set(k, Math.max(steps.get(k) ?? 0, s.m));
  }
  const byRound = new Map<number, number[]>();
  for (const [k, m] of steps) {
    const r = roundOf(k * STEP_MS, tl.roundEnds);
    byRound.set(r, [...(byRound.get(r) ?? []), m]);
  }
  const ordinary = new Map([...byRound].map(([r, ms]) => [r, median(ms) || 1e-6]));
  const level = (k: number) => {
    const m = steps.get(k);
    return m === undefined ? 0 : m / ordinary.get(roundOf(k * STEP_MS, tl.roundEnds))!;
  };

  const out: Flurry[] = [];
  let cur: { a: number; b: number; sum: number; n: number } | null = null;
  const close = () => {
    if (!cur) return;
    const fromMs = cur.a * STEP_MS;
    const toMs = (cur.b + 1) * STEP_MS;
    if (toMs - fromMs >= MIN_FLURRY_MS) {
      out.push({ fromMs, toMs, energy: cur.sum / cur.n, round: roundOf(fromMs, tl.roundEnds) });
    }
    cur = null;
  };
  for (const k of [...steps.keys()].sort((a, b) => a - b)) {
    let sum = 0;
    for (let j = -SMOOTH_STEPS; j <= SMOOTH_STEPS; j++) sum += level(k + j);
    const v = sum / (2 * SMOOTH_STEPS + 1);
    if (v <= ACTIVE_TIMES_ORDINARY) continue;
    const sameWork = cur && workAt(tl, cur.b * STEP_MS) === workAt(tl, k * STEP_MS);
    if (cur && sameWork && (k - cur.b) * STEP_MS <= JOIN_GAP_MS) {
      cur.b = k;
      cur.sum += v;
      cur.n += 1;
    } else {
      close();
      cur = { a: k, b: k, sum: v, n: 1 };
    }
  }
  close();
  return out;
};

/**
 * The clip a flurry makes: from LEAD_MS before its first movement to
 * TAIL_MS after its last, inside the work it happened in. Over
 * MAX_CLIP_MS the front goes, never the finish; under MIN_CLIP_MS it grows
 * past the finish first, then back into the run-up.
 */
export const flurryClip = (f: Flurry, work: Span): Span => {
  let to = Math.min(work.toMs, f.toMs + TAIL_MS);
  let from = Math.max(work.fromMs, f.fromMs - LEAD_MS);
  if (to - from > MAX_CLIP_MS) from = to - MAX_CLIP_MS;
  if (to - from < MIN_CLIP_MS) {
    to = Math.min(work.toMs, from + MIN_CLIP_MS);
    from = Math.max(work.fromMs, to - MIN_CLIP_MS);
  }
  return { fromMs: from, toMs: to };
};

/**
 * What was called for a clip: the last combination called before it got
 * going (within CALL_LOOKBACK_MS), or else the first called inside it,
 * with any between-call that followed while it ran.
 */
export const callsFor = (calls: TimelineCall[], clip: Span): CallInfo[] => {
  const sorted = [...calls].sort((a, b) => a.t - b.t);
  const mains = sorted.filter((c) => !c.between);
  const before = mains.filter((c) => c.t <= clip.fromMs + 300 && c.t >= clip.fromMs - CALL_LOOKBACK_MS);
  const main = before[before.length - 1] ?? mains.find((c) => c.t > clip.fromMs && c.t < clip.toMs);
  if (!main) return [];
  const next = mains.find((c) => c.t > main.t)?.t ?? Infinity;
  const between = sorted.filter((c) => c.between && c.t > main.t && c.t < Math.min(next, clip.toMs));
  return [main, ...between].map(({ text, between: b, combo }) => ({ text, between: b, combo }));
};

/**
 * Every flurry worth considering as a clip, scored on how hard and how long
 * it moved (up to 3 s of it) plus the strikes heard landing in it, the
 * app's voice aside. A call that was only defence counts for half: a check
 * moves a lot and shows little. A clip under the opening title, or near
 * the camera being handled, is none.
 */
export const reelCandidates = (tl: SessionTimeline): ReelCandidate[] => {
  const inSpeech = (t: number) =>
    tl.speech.some((s) => t >= s.from - SPEECH_PAD_MS && t <= s.to + SPEECH_PAD_MS);
  const cleanHits = tl.hits.filter((h) => !inSpeech(h));
  const titleEnd = tl.title ? tl.title.toMs : -Infinity;
  const out: ReelCandidate[] = [];
  for (const f of findFlurries(tl)) {
    const work = workAt(tl, f.fromMs);
    if (!work) continue;
    const clip = flurryClip(f, work);
    if (clip.fromMs < titleEnd) continue;
    if (disturbedNear(tl.motion, clip.fromMs, clip.toMs)) continue;
    const calls = callsFor(tl.calls, clip);
    const main = mainCall(calls)?.text ?? "";
    const heard = cleanHits.filter((h) => h >= clip.fromMs && h <= clip.toMs).length;
    const moved = f.energy * (Math.min(f.toMs - f.fromMs, 3000) / 1000);
    out.push({
      seq: out.length + 1,
      round: f.round,
      fromMs: Math.round(clip.fromMs),
      toMs: Math.round(clip.toMs),
      calls,
      family: main ? techniqueFamily(main) : "movement",
      score: (moved + HIT_WEIGHT * heard) * (main && isDefenceOnly(main) ? 0.5 : 1),
    });
  }
  return out;
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

/** Below this finish balance (finishBalance) a clip isn't shown. */
export const MIN_BALANCE = 0.25;

type Box = NonNullable<FramingFrame["box"]>;

/**
 * Rule 3 (user, 2026-11-22): clean technique over loss of balance and
 * sloppy movement. A clean rep ends where it began: back in stance, head
 * at the same height, standing as tall, not stumbled away. Compares the
 * fighter's outline (the pose points' bounding box) just after the clip
 * opens with just before it ends: 1 is back exactly where they started, 0
 * is nowhere near (crouched, fallen, a leg still up, staggered off).
 * Measured in the fighter's own height, so distance from the camera
 * doesn't matter. Movement during the clip is free: kicks change the
 * outline, finishing out of stance is what costs.
 */
export const finishBalance = (opening: Box, finish: Box): number => {
  const h = opening.h;
  if (!(h > 0.05)) return 1;
  const headDrop = Math.abs(finish.y - opening.y) / h;
  const shrink = (h - finish.h) / h;
  const drift =
    Math.abs(finish.x + finish.w / 2 - (opening.x + opening.w / 2)) / h;
  // Some give in each: guard adjustments, a step back after a teep.
  const off =
    Math.max(0, headDrop - 0.08) + Math.max(0, shrink - 0.1) + 0.5 * Math.max(0, drift - 0.25);
  return Math.max(0, Math.min(1, 1 - 2.5 * off));
};

/** The fighter as a round's probed frames show them most of the time. */
interface Usual {
  h: number;
  cx: number;
}

/**
 * Whether a probed frame shows someone other than the fighter: pose
 * detection follows one person, and when someone else is in shot it often
 * follows them. On the 2026-11-24 session a child playing by the bag read
 * as a person 19–36% taller than the fighter (nearer the lens), off to one
 * side. The fighter alone stayed within 0.74–1.18 of their usual height in
 * 182 of 184 probed frames, so one odd frame proves nothing: applyFraming
 * drops a clip on two.
 */
export const notTheFighter = (box: Box, usual: Usual): boolean => {
  const r = box.h / usual.h;
  const shift = Math.abs(box.x + box.w / 2 - usual.cx) / usual.h;
  return r >= 1.2 || r < 0.72 || (r > 1.12 && shift > 0.25);
};

/** Fraction of the crop's height the fighter should fill. */
const FIGHTER_SHARE = 0.45;
/**
 * The tightest crop, as a share of the frame: set when the recording was
 * 720p, where closer than this went soft at 1080p. The camera now asks for
 * 1080p (reelRecorder), so this could come down once that's seen on phones.
 */
export const CROP_MIN = 0.6;
/**
 * The burned-in watermark's top edge (watermark.ts: 3.5% margin plus the
 * banner at 45% of the width, on a portrait frame). A crop stops above it
 * or takes the whole frame, never half a logo; the export draws the
 * watermark back over a cropped clip.
 */
export const WATERMARK_TOP = 0.91;

/**
 * Where to crop in so the fighter fills more of the frame: the same share
 * of the width and the height (the reel has the recording's shape), sized
 * so the round's usual fighter fills FIGHTER_SHARE of it, never tighter than
 * CROP_MIN, centred on where they are in this clip with a little headroom.
 * Undefined when the fighter already fills the frame.
 */
export const fitCrop = (boxes: Box[], usual: Usual): Crop | undefined => {
  if (!boxes.length) return undefined;
  const f = Math.max(CROP_MIN, Math.min(1, usual.h / FIGHTER_SHARE));
  if (f > WATERMARK_TOP - 0.02) return undefined;
  const cx = median(boxes.map((b) => b.x + b.w / 2));
  const cy = median(boxes.map((b) => b.y + b.h / 2)) - 0.03;
  const clamp = (v: number, hi: number) => Math.max(0, Math.min(hi, v));
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return {
    x: round(clamp(cx - f / 2, 1 - f)),
    y: round(clamp(cy - f / 2, WATERMARK_TOP - f)),
    w: round(f),
    h: round(f),
  };
};

/**
 * Drops the candidates the fighter isn't fully in (behind the bag, out of
 * shot at an edge: any probed frame below MIN_VISIBLE), that show someone
 * else (two or more frames notTheFighter), or that don't finish in balance
 * (finishBalance below MIN_BALANCE); favours the ones where they fill more
 * of the frame, marks the rest down for a scrappy finish, and crops in on
 * the fighter (fitCrop). A candidate with no frames probed is judged as it
 * was: the check couldn't run.
 */
export const applyFraming = (
  cands: ReelCandidate[],
  frames: FramingFrame[]
): ReelCandidate[] => {
  const framesOf = (c: ReelCandidate) => {
    const times = probeTimes(c);
    return times.map((t) => frames.find((f) => Math.round(f.tMs) === t && !f.error));
  };
  // The fighter as each round shows them, from every frame probed in it.
  const usual = new Map<number, Usual>();
  for (const r of new Set(cands.map((c) => c.round))) {
    const boxes = cands
      .filter((c) => c.round === r)
      .flatMap(framesOf)
      .flatMap((f) => (f?.person && f.visible >= MIN_VISIBLE && f.box ? [f.box] : []));
    if (boxes.length >= 5) {
      usual.set(r, { h: median(boxes.map((b) => b.h)), cx: median(boxes.map((b) => b.x + b.w / 2)) });
    }
  }
  return cands.flatMap((c) => {
    const at = framesOf(c);
    const mine = at.filter((f): f is FramingFrame => !!f);
    if (!mine.length) return [c];
    if (mine.some((f) => !f.person || f.visible < MIN_VISIBLE)) return [];
    const u = usual.get(c.round);
    const boxes = mine.flatMap((f) => (f.box ? [f.box] : []));
    if (u && boxes.filter((b) => notTheFighter(b, u)).length >= 2) return [];
    const h = mine.reduce((n, f) => n + (f.box?.h ?? 0), 0) / mine.length;
    const size = 0.7 + 0.5 * Math.min(1, h / 0.8);
    const open = at[0]?.box;
    const close = at[at.length - 1]?.box;
    const balance = open && close ? finishBalance(open, close) : undefined;
    if (balance !== undefined && balance < MIN_BALANCE) return [];
    const form = balance === undefined ? 1 : 0.5 + 0.5 * balance;
    const crop = u ? fitCrop(boxes.filter((b) => !notTheFighter(b, u)), u) : undefined;
    return [
      {
        ...c,
        score: c.score * size * form,
        ...(balance !== undefined ? { balance } : {}),
        ...(crop ? { crop } : {}),
      },
    ];
  });
};

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
    if (picked.some((p) => p.fromMs < c.toMs && c.fromMs < p.toMs)) return false;
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

/** A stretch to cut out of the recording, and where to crop it, if anywhere. */
export interface ExportRange extends Span {
  crop?: Crop;
}

/**
 * How far the recording runs behind the timeline. The timeline is stamped
 * when a frame is drawn; the recorder stamps it later. On the 2026-11-24
 * session (Pixel 9) the file's movement trailed the motion meter's by
 * 160–220 ms all session, and the end card appeared 333 ms after it was
 * stamped: every clip had been cut a fifth of a second early, losing half
 * its finish, and the reel showed the room for a moment before the card.
 */
export const RECORDING_LAG_MS = 200;
/** The end card is kept from this long after it was stamped: never a frame of the room before it. */
export const CARD_SETTLE_MS = 500;

/**
 * The stretches of the recording to cut out, in order: the opening title
 * over the action, the picked clips (cropped in on the fighter), the end
 * card, all moved onto the recording's own clock (RECORDING_LAG_MS). The
 * title and end card stay full frame: their text is burned in. The export
 * stops anything at the picture's end.
 */
export const exportRanges = (tl: SessionTimeline, picks: ReelCandidate[]): ExportRange[] => [
  ...(tl.title ? [tl.title] : []),
  ...picks.map((c) => ({
    fromMs: c.fromMs + RECORDING_LAG_MS,
    toMs: c.toMs + RECORDING_LAG_MS,
    ...(c.crop ? { crop: c.crop } : {}),
  })),
  ...(tl.endCard
    ? [{ fromMs: tl.endCard.fromMs + CARD_SETTLE_MS, toMs: tl.endCard.toMs + RECORDING_LAG_MS }]
    : []),
];
