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
  /**
   * Something happened to the camera rather than in front of it: see
   * isDisturbance.
   */
  disturbed?: boolean;
}

/** A pixel this much brighter or darker than last sample counts as changed. */
export const CHANGED_PIXEL = 0.1;

/**
 * Whether a frame-to-frame change is the camera being disturbed — picked up,
 * set down, walked up to, a hand or a dog's nose over the lens — rather than
 * someone training in front of it.
 *
 * Measured on real sessions (10 samples a second): a fighter, even a head
 * kick close to the lens, changes at most about a quarter of the frame and
 * shifts its overall brightness by 0.02 at most. Every disturbance changed
 * 30–90% of it, or shifted the brightness by 0.03–0.47 as the exposure
 * swung. Scored as movement, disturbances were the "best" clips in the reel,
 * and for a minute after one the movement threshold sat above every real
 * strike, so every clip came back empty.
 *
 * `wide`: share of pixels changed by more than CHANGED_PIXEL; `lumShift`:
 * change in the frame's mean brightness (0–1).
 */
export const isDisturbance = (wide: number, lumShift: number): boolean =>
  wide >= 0.3 || lumShift >= 0.03;

/**
 * How long either side of a disturbance is also written off: someone walking
 * up to the phone, or away from it, is a disturbance before and after the
 * frames that show it most.
 */
export const DISTURBANCE_PAD_MS = 1500;

/**
 * Whether any sample within DISTURBANCE_PAD_MS of [from, to] was disturbed.
 * `samples` oldest first, times in the same clock as from/to.
 */
export const disturbedNear = (
  samples: { at: number; disturbed?: boolean }[],
  from: number,
  to: number
): boolean =>
  samples.some(
    (s) =>
      s.disturbed &&
      s.at >= from - DISTURBANCE_PAD_MS &&
      s.at <= to + DISTURBANCE_PAD_MS
  );

/** The samples nowhere near a disturbance, for judging what movement is. */
export const undisturbed = <T extends { at: number; disturbed?: boolean }>(
  samples: T[]
): T[] => {
  const marks = samples.filter((s) => s.disturbed).map((s) => s.at);
  if (!marks.length) return samples;
  return samples.filter(
    (s) => !marks.some((m) => Math.abs(s.at - m) <= DISTURBANCE_PAD_MS)
  );
};

export const SAMPLE_MS = 100;
/** Long side of the sampling frame, in pixels. */
const SAMPLE_SIZE = 48;
/** How much history the noise floor and peak are judged against. */
const HISTORY = 600; // 60s at 10/s
/** Samples kept: an hour at 10/s. */
const MAX_SAMPLES = 36000;
export class MotionMeter {
  private readonly canvas = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D | null = null;
  private prev: Float32Array | null = null;
  private prevMean = 0;
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

  /**
   * Where "still" and "busy" sit, from the last minute of movement, leaving
   * out disturbances: one walk up to the phone had set "busy" eight times
   * higher than any strike.
   */
  levels(): MotionLevels {
    return motionLevels(undisturbed(this.samples).map((s) => s.m));
  }

  /** Whether the camera was disturbed during, or close to, [from, to]. */
  disturbed(from: number, to: number): boolean {
    return disturbedNear(this.samples, from, to);
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
      let mean = 0;
      for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
        lum[i] = (0.299 * data[p]! + 0.587 * data[p + 1]! + 0.114 * data[p + 2]!) / 255;
        mean += lum[i]!;
      }
      mean /= lum.length;
      if (this.prev && this.weights) {
        let sum = 0;
        let wsum = 0;
        let changed = 0;
        for (let i = 0; i < lum.length; i++) {
          const wt = this.weights[i]!;
          const d = Math.abs(lum[i]! - this.prev[i]!);
          sum += d * wt;
          wsum += wt;
          if (d > CHANGED_PIXEL) changed += 1;
        }
        const at = performance.now();
        this.samples.push({
          at,
          m: sum / wsum,
          disturbed: isDisturbance(changed / lum.length, Math.abs(mean - this.prevMean)),
        });
        // The whole session is kept: the reel is planned from it afterwards.
        if (this.samples.length > MAX_SAMPLES) {
          this.samples = this.samples.slice(-MAX_SAMPLES / 2);
        }
      }
      this.prev = lum;
      this.prevMean = mean;
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
