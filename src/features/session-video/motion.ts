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

export class MotionMeter {
  private readonly canvas = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D | null = null;
  private prev: Float32Array | null = null;
  private weights: Float32Array | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private samples: MotionSample[] = [];

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
        for (let i = 0; i < lum.length; i++) {
          const wt = this.weights[i]!;
          sum += Math.abs(lum[i]! - this.prev[i]!) * wt;
          wsum += wt;
        }
        this.samples.push({ at: performance.now(), m: sum / wsum });
        if (this.samples.length > HISTORY * 4) {
          this.samples = this.samples.slice(-HISTORY * 2);
        }
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

/**
 * The longest a kept clip runs: one combination, cut tight. Shorter clips,
 * more of them, is what makes a reel move.
 */
export const MAX_KEEP_MS = 3500;
/** The shortest: anything less is a flinch, not a technique. */
export const MIN_KEEP_MS = 1200;
/** Kept before the first movement and after the last. */
const LEAD_MS = 300;
const TRAIL_MS = 400;
/** Kept after the last hit: the strike landing, and the snap back. */
const AFTER_HIT_MS = 450;

export interface ClipCut {
  /** Where the kept part starts and ends, ms from the clip's start. */
  startMs: number;
  endMs: number;
  /** Movement above the floor inside the kept part. */
  motion: number;
  /** Strikes heard landing inside the kept part. */
  hits: number;
}

/**
 * The part of a filmed callout worth keeping, and what happened in it.
 *
 * From just before the first real movement (or hit) to just after the last
 * hit — or, with nothing heard, the last movement. If that runs longer than
 * MAX_KEEP_MS, the stretch of that length with the most going on. A stare
 * comes back empty.
 *
 * `hits` are ms from the clip's start, from HitDetector.
 */
export const cutClip = (
  samples: { t: number; m: number }[],
  durationMs: number,
  levels: MotionLevels,
  hits: number[] = []
): ClipCut => {
  const none = { startMs: 0, endMs: 0, motion: 0, hits: 0 };
  const active = samples.filter((s) => s.m > levels.threshold);
  if ((!active.length && !hits.length) || durationMs < MIN_KEEP_MS) return none;

  const firstMove = active.length ? active[0]!.t : Infinity;
  const lastMove = active.length ? active[active.length - 1]!.t : -Infinity;
  let start = Math.max(0, Math.min(firstMove, hits[0] ?? Infinity) - LEAD_MS);
  let end = Math.min(
    durationMs,
    hits.length
      ? hits[hits.length - 1]! + AFTER_HIT_MS
      : lastMove + TRAIL_MS
  );

  const excess = (from: number, to: number) =>
    samples
      .filter((s) => s.t >= from && s.t <= to)
      .reduce((sum, s) => sum + Math.max(0, s.m - levels.floor), 0);
  const hitsIn = (from: number, to: number) =>
    hits.filter((h) => h >= from && h <= to).length;

  if (end - start > MAX_KEEP_MS) {
    // Slide a MAX_KEEP_MS window across the span; keep the one with the
    // most hits, then the most movement.
    let best = start;
    let bestKey = -1;
    for (let from = start; from + MAX_KEEP_MS <= end; from += 100) {
      const key = hitsIn(from, from + MAX_KEEP_MS) * 1000 + excess(from, from + MAX_KEEP_MS);
      if (key > bestKey) {
        bestKey = key;
        best = from;
      }
    }
    start = best;
    end = best + MAX_KEEP_MS;
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
    hits: hitsIn(start, end),
  };
};
