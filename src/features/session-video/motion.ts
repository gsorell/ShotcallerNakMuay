/**
 * How much is moving in front of the camera, sampled through the session.
 *
 * The reel used to keep whatever the clock said to keep, and on pads that
 * was mostly someone squared up waiting for the next call. Now every callout
 * is filmed and the moments with the most movement are the ones kept, so the
 * recorder needs a measure of movement over time. This one is deliberately
 * crude and cheap: tiny greyscale frames, ten a second, the mean difference
 * from one to the next. The centre of the frame counts for more than the
 * edges, where people walk past.
 */
import type { Crop } from "./reelRenderer";

export interface MotionSample {
  /** performance.now() when sampled. */
  at: number;
  /** Mean change from the previous frame, 0 (still) to 1. */
  m: number;
}

export const SAMPLE_MS = 100;
/** Long side of the sampling frame, in pixels. */
const SAMPLE_SIZE = 48;
/** How much history the noise floor and peak are judged against. */
const HISTORY = 600; // 60s at 10/s
/** Movement maps kept: longer than the longest clip. */
const MAP_HISTORY = 150; // 15s at 10/s

/** Where in the frame things moved: a grid of summed change. */
export interface HeatMap {
  w: number;
  h: number;
  cells: Float32Array;
}

/** The smallest crop, as a share of the frame: any closer and it's soft. */
export const MIN_CROP = 0.6;

/**
 * The part of the frame to show for a clip: around where the fighter moved,
 * with room for the head and feet that move less than the limbs, in the
 * frame's own shape. In shadowboxing the fighter fills well under half a
 * phone propped across the room; this brings them up to fill the reel.
 *
 * Returns fractions of the frame, square in those terms (so the frame's
 * aspect is kept), never smaller than MIN_CROP. With too little movement to
 * go by, the whole frame.
 */
export const cropFromHeat = (heat: HeatMap | null): Crop => {
  const whole = { x: 0, y: 0, w: 1, h: 1 };
  if (!heat) return whole;
  const { w, h, cells } = heat;
  let total = 0;
  const colMass = new Float32Array(w);
  const rowMass = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = cells[y * w + x]!;
      colMass[x]! += v;
      rowMass[y]! += v;
      total += v;
    }
  }
  if (total <= 1e-6) return whole;
  // Where the middle 90% of the movement was, along each axis.
  const span = (mass: Float32Array): [number, number] => {
    let acc = 0;
    let lo = 0;
    let hi = mass.length - 1;
    let loSet = false;
    for (let i = 0; i < mass.length; i++) {
      acc += mass[i]!;
      if (!loSet && acc >= total * 0.05) {
        lo = i;
        loSet = true;
      }
      if (acc >= total * 0.95) {
        hi = i;
        break;
      }
    }
    return [lo / mass.length, (hi + 1) / mass.length];
  };
  const [x0, x1] = span(colMass);
  const [y0, y1] = span(rowMass);
  // Room around it: more above (the head) than below.
  const bw = x1 - x0;
  const bh = y1 - y0;
  const left = x0 - bw * 0.35;
  const right = x1 + bw * 0.35;
  const top = y0 - bh * 0.3;
  const bottom = y1 + bh * 0.2;
  const s = Math.min(1, Math.max(MIN_CROP, right - left, bottom - top));
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const clamp = (c: number) => Math.min(1 - s, Math.max(0, c - s / 2));
  return { x: clamp(cx), y: clamp(cy), w: s, h: s };
};

export class MotionMeter {
  private readonly canvas = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D | null = null;
  private prev: Float32Array | null = null;
  private weights: Float32Array | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private samples: MotionSample[] = [];
  private maps: { at: number; diff: Float32Array; w: number; h: number }[] = [];

  constructor(private readonly video: HTMLVideoElement) {}

  start(): void {
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.timer = setInterval(() => this.sample(), SAMPLE_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Samples between two moments, oldest first. */
  between(from: number, to: number): MotionSample[] {
    return this.samples.filter((s) => s.at >= from && s.at <= to);
  }

  /** Where "still" and "busy" sit, from the last minute of movement. */
  levels(): MotionLevels {
    return motionLevels(this.samples.map((s) => s.m));
  }

  /** Where in the frame things moved between two moments, summed. */
  heat(from: number, to: number): HeatMap | null {
    let out: HeatMap | null = null;
    for (const m of this.maps) {
      if (m.at < from || m.at > to) continue;
      if (!out || out.w !== m.w || out.h !== m.h) {
        out = { w: m.w, h: m.h, cells: new Float32Array(m.w * m.h) };
      }
      for (let i = 0; i < m.diff.length; i++) out.cells[i]! += m.diff[i]!;
    }
    return out;
  }

  private sample(): void {
    const v = this.video;
    const ctx = this.ctx;
    if (!ctx || !v.videoWidth || v.readyState < 2) return;
    const landscape = v.videoWidth >= v.videoHeight;
    const w = landscape
      ? SAMPLE_SIZE
      : Math.round((SAMPLE_SIZE * v.videoWidth) / v.videoHeight);
    const h = landscape
      ? Math.round((SAMPLE_SIZE * v.videoHeight) / v.videoWidth)
      : SAMPLE_SIZE;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.prev = null;
      this.weights = centreWeights(w, h);
    }
    try {
      ctx.drawImage(v, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      const lum = new Float32Array(w * h);
      for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
        lum[i] = (0.299 * data[p]! + 0.587 * data[p + 1]! + 0.114 * data[p + 2]!) / 255;
      }
      if (this.prev && this.weights) {
        let sum = 0;
        let wsum = 0;
        const diff = new Float32Array(lum.length);
        for (let i = 0; i < lum.length; i++) {
          const wt = this.weights[i]!;
          const d = Math.abs(lum[i]! - this.prev[i]!);
          diff[i] = d;
          sum += d * wt;
          wsum += wt;
        }
        const at = performance.now();
        this.samples.push({ at, m: sum / wsum });
        if (this.samples.length > HISTORY * 4) {
          this.samples = this.samples.slice(-HISTORY * 2);
        }
        // Where it moved, kept for the last few seconds: a clip asks for its
        // own stretch when it's finished, to frame the fighter.
        this.maps.push({ at, diff, w, h });
        if (this.maps.length > MAP_HISTORY) this.maps.shift();
      }
      this.prev = lum;
    } catch {
      /* a frame that cannot be read is a frame without a reading */
    }
  }
}

/** 1 at the centre, falling to 0.35 at the corners. */
const centreWeights = (w: number, h: number): Float32Array => {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5) / w - 0.5;
      const dy = (y + 0.5) / h - 0.5;
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 0.7071);
      out[y * w + x] = 1 - 0.65 * d;
    }
  }
  return out;
};

export interface MotionLevels {
  /** Movement when nothing is happening: sensor noise, breathing. */
  floor: number;
  /** Movement that counts as action. */
  threshold: number;
}

const percentile = (sorted: number[], p: number): number =>
  sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!
    : 0;

/**
 * The floor is how still the quiet moments are; the threshold sits a quarter
 * of the way from there to how busy the busiest are. Judged against the last
 * minute, so a dim room and a bright one, or a near camera and a far one, are
 * each measured against themselves.
 */
export const motionLevels = (values: number[]): MotionLevels => {
  const recent = values.slice(-HISTORY);
  const sorted = [...recent].sort((a, b) => a - b);
  const floor = percentile(sorted, 0.2);
  const peak = percentile(sorted, 0.95);
  return { floor, threshold: floor + Math.max(0.002, 0.25 * (peak - floor)) };
};

/** The shortest kept clip: anything less is a flinch, not a technique. */
export const MIN_KEEP_MS = 1200;
/** The longest, whatever was called. */
export const MAX_KEEP_MS = 5000;

/**
 * How long a combination of `strikes` may run in the reel: a single strike
 * stays snappy, a five-strike combination gets room to finish. A flat 3.5s
 * cap chopped the long ones.
 */
export const keepCapMs = (strikes: number): number =>
  Math.min(MAX_KEEP_MS, 1500 + 600 * Math.max(1, strikes));

/**
 * The reaction to a call starts on its first word; the clip starts this long
 * after the call does, so the wind-up is in and the standing before isn't.
 */
const AFTER_CALL_MS = 300;
/** Kept before the first movement when there's no call to go by. */
const LEAD_MS = 300;
/** Back in stance means this long below the settle level. */
const SETTLED_FOR_MS = 300;
/** Kept after settling: the guard coming back up. */
const AFTER_SETTLE_MS = 150;
/** Kept after the last hit when nothing settles first. */
const AFTER_HIT_MS = 450;

export interface ClipCut {
  /** Where the kept part starts and ends, ms from the clip's start. */
  startMs: number;
  endMs: number;
  /** Movement above the floor inside the kept part. */
  motion: number;
  /** Strikes heard landing inside the kept part, the voice aside. */
  hits: number;
}

export interface ClipEvidence {
  /** Movement through the clip, ms from its start. */
  samples: { t: number; m: number }[];
  durationMs: number;
  levels: MotionLevels;
  /** Strikes heard landing, ms from the clip's start (HitDetector). */
  hits?: number[];
  /**
   * The hits heard while the app's own voice wasn't speaking: the ones that
   * can be trusted to be strikes. They are what `ClipCut.hits` counts; all
   * of `hits` still shape the trim, since a combination often starts before
   * the call has finished. Defaults to `hits`.
   */
  cleanHits?: number[];
  /** When the clip's callout began, ms from its start. */
  callAtMs?: number;
  /** Strikes in what was called, for how long it may run. */
  strikes?: number;
}

/**
 * The part of a filmed callout worth keeping, and what happened in it.
 *
 * Starts just after the call begins (people move on the first word), or
 * just before the first real movement if that comes sooner or there was no
 * call. Ends once the fighter is back in stance: after the last strike
 * heard, or the last real movement, the first moment movement stays down
 * near stillness for a beat. The old cut ended a fixed 0.4s after the last
 * big movement, which lopped off the snap back to guard — and the leg still
 * in the air at the end of a kick.
 *
 * If that runs past the combination's cap, the stretch of that length with
 * the most going on. A stare comes back empty.
 */
export const cutClip = (e: ClipEvidence): ClipCut => {
  const { durationMs, levels } = e;
  // The clip opens before its call, over the tail of the last combination;
  // that movement isn't this call's.
  const from = e.callAtMs !== undefined ? e.callAtMs - 200 : 0;
  const hits = (e.hits ?? []).filter((h) => h >= from);
  const none = { startMs: 0, endMs: 0, motion: 0, hits: 0 };
  // Lightly smoothed, so one still frame mid-combination isn't "settled".
  const samples = e.samples.map((s, i, all) => {
    const a = all[i - 1]?.m ?? s.m;
    const b = all[i + 1]?.m ?? s.m;
    return { t: s.t, m: (a + s.m + b) / 3 };
  });
  const active = samples.filter((s) => s.t >= from && s.m > levels.threshold);
  // Nothing moved, nothing to show, whatever was heard: hits shape a clip's
  // trim but never make one on their own. A round's opening bell, heard as
  // hits, once put a clip of someone standing still into the reel.
  if (!active.length || durationMs < MIN_KEEP_MS) return none;

  const firstMove = active.length ? active[0]!.t : Infinity;
  const lastMove = active.length ? active[active.length - 1]!.t : -Infinity;
  const firstEvidence = Math.min(firstMove, hits[0] ?? Infinity);
  let start = Math.max(
    0,
    Math.min(
      e.callAtMs !== undefined ? e.callAtMs + AFTER_CALL_MS : Infinity,
      firstEvidence - LEAD_MS
    )
  );

  // Back in stance: below the settle level for SETTLED_FOR_MS, after the
  // last thing that happened.
  const lastEvent = Math.max(lastMove, hits[hits.length - 1] ?? -Infinity);
  const settle = levels.floor + 0.5 * (levels.threshold - levels.floor);
  let settledAt: number | null = null;
  let quietSince: number | null = null;
  for (const s of samples) {
    if (s.t <= lastEvent) continue;
    if (s.m <= settle) {
      quietSince ??= s.t;
      if (s.t - quietSince >= SETTLED_FOR_MS) {
        settledAt = quietSince;
        break;
      }
    } else {
      quietSince = null;
    }
  }
  let end = Math.min(
    durationMs,
    settledAt !== null
      ? settledAt + AFTER_SETTLE_MS
      : hits.length
      ? lastEvent + AFTER_HIT_MS
      : lastEvent + SETTLED_FOR_MS + AFTER_SETTLE_MS
  );

  const excess = (from: number, to: number) =>
    samples
      .filter((s) => s.t >= from && s.t <= to)
      .reduce((sum, s) => sum + Math.max(0, s.m - levels.floor), 0);
  const hitsIn = (from: number, to: number) =>
    hits.filter((h) => h >= from && h <= to).length;

  const cap = keepCapMs(e.strikes ?? 1);
  if (end - start > cap) {
    // Slide a cap-length window across the span; keep the one with the most
    // hits, then the most movement. Starting from the call is preferred, so
    // ties keep the opening.
    let best = start;
    let bestKey = -1;
    for (let from = start; from + cap <= end; from += 100) {
      const key = hitsIn(from, from + cap) * 1000 + excess(from, from + cap);
      if (key > bestKey + 1e-9) {
        bestKey = key;
        best = from;
      }
    }
    start = best;
    end = best + cap;
  }

  if (end - start < MIN_KEEP_MS) {
    const grow = (MIN_KEEP_MS - (end - start)) / 2;
    start = Math.max(0, start - grow);
    end = Math.min(durationMs, start + MIN_KEEP_MS);
    start = Math.max(0, end - MIN_KEEP_MS);
  }

  return {
    startMs: start,
    endMs: end,
    motion: excess(start, end),
    hits: (e.cleanHits ?? hits).filter((t) => t >= start && t <= end).length,
  };
};
