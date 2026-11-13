import { cardAssetsReady, drawWatermark, loadWatermark } from "./watermark";

/** Part of the frame, as fractions of its width and height. */
export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A kept clip: its video and how to show it. */
export interface RenderClip {
  url: string;
  startMs: number;
  endMs: number;
  /** The part of the frame the fighter is in; the whole frame if absent. */
  crop?: Crop;
}

export interface RendererOptions {
  /** The clips carry sound, and the reel should too. */
  withAudio?: boolean;
  /** The banner along the bottom. Off for a cut of a reel that has one. */
  watermark?: boolean;
  /** Even the sound out to a feed's loudness. Off for an already mastered source. */
  master?: boolean;
  /** Told what went wrong (and how it ended), for when no reel comes out. */
  log?: (line: string) => void;
}

/** A card: a few lines of text under the logo, on the brand's dark. */
export interface Card {
  lines: string[];
  durationMs: number;
}

/**
 * MP4 first: it plays everywhere and Photos takes it. WebM where it's not.
 * With sound, AAC where the recorder offers it (iOS), Opus otherwise.
 */
export const pickMime = (withAudio = false): string => {
  const candidates = withAudio
    ? [
        "video/mp4;codecs=avc1,mp4a.40.2",
        "video/mp4;codecs=avc1,opus",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ]
    : [
        "video/mp4;codecs=avc1",
        "video/mp4",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
  for (const m of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* try the next */
    }
  }
  return "";
};

/** How far each clip pushes in over its length: a slow, steady zoom. */
const PUSH_IN = 0.06;

/** Where the crop sits at `progress` (0–1) through a clip, pushing in. */
export const cropAt = (crop: Crop, progress: number): Crop => {
  const k = 1 - PUSH_IN * Math.min(1, Math.max(0, progress));
  const w = crop.w * k;
  const h = crop.h * k;
  return {
    x: crop.x + (crop.w - w) / 2,
    y: crop.y + (crop.h - h) / 2,
    w,
    h,
  };
};

/**
 * Builds the reel: plays each kept clip's best stretch onto a canvas into
 * one recorder that is paused between clips — so the output is one file
 * with no gaps — with the watermark, the right way round.
 *
 * The look is made here, as it plays: the frame is cropped to the fighter
 * and pushes in slowly through each clip; a clip's best moment can drop to
 * half speed; the reel opens and closes on cards.
 *
 * It runs at playback speed, which is why it is fed a round at a time during
 * the rests: by the final bell only the last round is left. The stretch
 * before a clip's kept part is skipped at 4x with the recorder paused,
 * rather than seeked to, because recorder-made files often seek poorly.
 */
export class ReelRenderer {
  private readonly canvas = document.createElement("canvas");
  private readonly ctx: CanvasRenderingContext2D;
  private readonly video = document.createElement("video");
  private readonly recorder: MediaRecorder;
  private readonly chunks: Blob[] = [];
  private drawing = true;
  private started = false;
  private sized = false;
  private audioCtx: AudioContext | null = null;
  private queue: Promise<void> = Promise.resolve();
  /** What the canvas shows: a clip, a card, or nothing new. */
  private scene:
    | { kind: "clip"; clip: RenderClip }
    | { kind: "card"; card: Card; startedAt: number }
    | null = null;
  /** Laid over the opening clip, once the frame's shape is known. */
  private title: Card | null = null;
  /** The title over the action, until `until` (performance.now()). */
  private overlay: { card: Card; until: number } | null = null;
  private readonly watermark: boolean;
  private readonly log: (line: string) => void;
  renderedMs = 0;
  clips = 0;

  constructor(opts: boolean | RendererOptions = false) {
    const {
      withAudio = false,
      watermark = true,
      master = true,
      log = () => {},
    } = typeof opts === "boolean" ? { withAudio: opts } : opts;
    this.watermark = watermark;
    this.log = log;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D canvas");
    this.ctx = ctx;
    this.canvas.width = 720;
    this.canvas.height = 1280;

    // Off screen but in the document: iOS will not decode frames for a
    // video element that isn't.
    const v = this.video;
    v.muted = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.style.cssText =
      "position:fixed;left:-10px;top:-10px;width:2px;height:2px;opacity:0;pointer-events:none";
    document.body.appendChild(v);

    const draw = () => {
      if (!this.drawing) return;
      this.paint();
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);

    const stream = this.canvas.captureStream(30);
    // The clips' sound — the callouts, the pads — goes into the reel through
    // Web Audio and never out of the speaker: the element's output is taken
    // over by the graph, which ends at a stream, not the speakers. Muted,
    // the element would hand the graph silence.
    let audio = false;
    if (withAudio) {
      try {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        // "playback": the default low-latency output crackles a Bluetooth
        // speaker, and this graph never reaches a speaker anyway.
        const actx = new Ctx({ latencyHint: "playback" });
        const dest = actx.createMediaStreamDestination();
        const source = actx.createMediaElementSource(v);
        if (master) {
          const [into, out] = masterChain(actx);
          source.connect(into);
          out.connect(dest);
        } else {
          source.connect(dest);
        }
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
        v.muted = false;
        void actx.resume().catch(() => undefined);
        this.audioCtx = actx;
        audio = true;
      } catch (e) {
        console.warn("Reel will be silent:", e);
        log(`render audio: ${errText(e)}`);
      }
    }

    const mimeType = pickMime(audio);
    // A keyframe a second, where the browser takes the hint, so a gallery
    // can scrub in one-second steps rather than every three or four (what
    // the Pixel's recorder chose on its own). Ignored where unsupported.
    const options = {
      videoBitsPerSecond: 3_000_000,
      ...(audio ? { audioBitsPerSecond: 128_000 } : {}),
      videoKeyFrameIntervalDuration: 1000,
      ...(mimeType ? { mimeType } : {}),
    } as MediaRecorderOptions;
    this.recorder = new MediaRecorder(stream, options);
    log(`render: mime "${mimeType}" -> "${this.recorder.mimeType}", audio ${audio}`);
    this.recorder.onerror = (e) =>
      log(`render recorder error: ${errText((e as unknown as { error?: unknown }).error ?? e)}`);
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) this.chunks.push(e.data);
    };
  }

  /**
   * The title: laid over the opening clip, in full from its first frame, for
   * the card's duration. The first frame is the reel's thumbnail in a
   * gallery and a feed, and a feed decides in a second whether to stay — so
   * the reel opens on action with the title over it, not on a black card.
   */
  setTitle(card: Card): void {
    this.title = card;
  }

  /** Adds clips to the reel, after anything already queued. */
  add(clips: RenderClip[], onDone: (clip: RenderClip) => void): Promise<void> {
    this.queue = this.queue.then(async () => {
      for (const clip of clips) {
        try {
          await this.renderOne(clip);
          this.clips += 1;
        } catch (e) {
          console.warn("Reel clip skipped:", e);
          this.log(`render skipped clip: ${errText(e)}`);
        }
        onDone(clip);
      }
    });
    return this.queue;
  }

  /**
   * Waits for the queue, closes the reel on `endCard`, and hands it back.
   * A reel with no clips in it is no reel: no cards on their own.
   */
  async finish(endCard?: Card): Promise<{ blob: Blob; type: string } | null> {
    await this.queue;
    if (this.started && endCard) await this.renderCard(endCard);
    const r = this.recorder;
    let result: { blob: Blob; type: string } | null = null;
    if (this.started && r.state !== "inactive") {
      const stopped = new Promise<void>((resolve) => {
        r.addEventListener("stop", () => resolve(), { once: true });
        setTimeout(resolve, 4000);
      });
      try {
        r.stop();
      } catch {
        /* the timeout covers a stop that never reports */
      }
      await stopped;
      const type = r.mimeType || this.chunks[0]?.type || "video/webm";
      if (this.chunks.length) {
        result = { blob: new Blob(this.chunks, { type }), type };
      }
    }
    const bytes = this.chunks.reduce((n, c) => n + c.size, 0);
    this.log(
      `render finish: ${this.clips} clips, started ${this.started}, ` +
        `${this.chunks.length} chunks, ${bytes} bytes, ${Math.round(this.renderedMs)}ms`
    );
    this.dispose();
    return result;
  }

  dispose(): void {
    this.drawing = false;
    try {
      if (this.recorder.state !== "inactive") this.recorder.stop();
    } catch {
      /* already stopped */
    }
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.remove();
    void this.audioCtx?.close().catch(() => undefined);
    this.audioCtx = null;
  }

  /** Draws the current scene. Runs every frame. */
  private paint(): void {
    const scene = this.scene;
    if (!scene) return;
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    if (scene.kind === "card") {
      drawCard(ctx, w, h, scene.card);
      return;
    }
    const v = this.video;
    if (v.readyState < 2 || !v.videoWidth) return;
    const clip = scene.clip;
    const span = Math.max(1, clip.endMs - clip.startMs);
    const progress = (v.currentTime * 1000 - clip.startMs) / span;
    const whole = { x: 0, y: 0, w: 1, h: 1 };
    const c = cropAt(clip.crop ?? whole, progress);
    // Drawn as the camera delivered it — the true view, not mirrored.
    // Only the live preview is mirrored, like every selfie preview; a
    // mirrored reel had every orthodox fighter southpaw and text backwards.
    ctx.drawImage(
      v,
      c.x * v.videoWidth,
      c.y * v.videoHeight,
      c.w * v.videoWidth,
      c.h * v.videoHeight,
      0,
      0,
      w,
      h
    );
    const o = this.overlay;
    if (o && performance.now() < o.until) {
      // The title stands in for the banner while it's up.
      drawTitleOverlay(ctx, w, h, o.card);
      return;
    }
    this.overlay = null;
    if (this.watermark) drawWatermark(ctx, w, h);
  }

  /** Rolls the tape: starts the recorder, or resumes it. */
  private roll(): void {
    const r = this.recorder;
    if (!this.started) {
      r.start(1000);
      this.started = true;
    } else if (r.state === "paused") {
      r.resume();
    }
  }

  private cut(): void {
    if (this.recorder.state === "recording") this.recorder.pause();
  }

  private async renderCard(card: Card): Promise<void> {
    await cardAssetsReady();
    this.scene = { kind: "card", card, startedAt: performance.now() };
    // Painted before the tape rolls: the first frame recorded is the whole
    // card, never a blank or half-drawn one.
    await nextFrames(2);
    this.roll();
    const rolledAt = performance.now();
    await wait(card.durationMs);
    this.cut();
    this.renderedMs += performance.now() - rolledAt;
    this.scene = null;
  }

  private async renderOne(clip: RenderClip): Promise<void> {
    const v = this.video;
    await loadFrames(v, clip.url);
    // The reel takes the shape of the camera's frame, set once.
    if (!this.sized && v.videoWidth) {
      this.canvas.width = v.videoWidth;
      this.canvas.height = v.videoHeight;
      this.sized = true;
    }
    const title = this.title;
    this.title = null;
    if (title) await cardAssetsReady();
    const startS = clip.startMs / 1000;
    const endS = clip.endMs / 1000;

    if (startS > 0.05) {
      // Run up to the kept part fast, off the record.
      // Fast to just short of it, then real speed, so the overshoot of a
      // 4x run doesn't eat the lead-in.
      await playSafely(v);
      if (startS > 0.5) {
        v.playbackRate = 4;
        await until(() => v.currentTime >= startS - 0.4 || v.ended, 8000);
        v.playbackRate = 1;
      }
      await until(() => v.currentTime >= startS || v.ended, 3000);
      v.pause();
    }
    v.playbackRate = 1;
    // Up before the tape rolls, so the reel's very first frame carries it.
    if (title) this.overlay = { card: title, until: Infinity };
    this.scene = { kind: "clip", clip };
    // Let the canvas catch the first kept frame before the tape rolls, so
    // the reel never opens a clip on the last frame of the one before.
    await nextFrames(2);

    this.roll();
    const rolledAt = performance.now();
    if (this.overlay) this.overlay.until = rolledAt + this.overlay.card.durationMs;
    await playSafely(v);
    const limit = (endS - startS) * 1000 * 2 + 3000;
    // A clip whose picture stops moving is cut where it stalled: a phone
    // starved of power once filmed one frozen frame into the reel for 11s.
    // (Slow motion at each round's best moment was tried and dropped,
    // 2026-11-13: it read as random, not as emphasis.)
    await playTo(v, endS, limit);
    this.cut();
    v.pause();
    this.overlay = null;
    this.renderedMs += performance.now() - rolledAt;
  }
}

/**
 * The sound brought up to where feeds play things (about -14 LUFS), evenly:
 * reels came out at -23 to -33 LUFS, half as loud as the posts around them.
 * A gentle compressor narrows quiet and loud sessions together, a fixed
 * lift brings them up, and a limiter then a soft clip hold the peaks under
 * 0 dBFS. Tuned in Chrome on five real reels (2026-11-10): a 17 dB spread
 * between them became under 3 dB. The lift is 6 dB, not the 10 that hit
 * -14 in tuning: that was measured on a mono mix, and the reel is stereo,
 * which reads 3 dB louder for the same sound (a full render at 10 dB came
 * out at -10.4 LUFS, at 7 dB -12.1; 6 dB leaves a pad session near -13
 * and quieter shadowboxing near -14 to -15).
 */
export const MASTER = {
  compressor: { threshold: -30, knee: 12, ratio: 3, attack: 0.005, release: 0.25 },
  makeupDb: 6,
  limiter: { threshold: -6, knee: 0, ratio: 20, attack: 0.001, release: 0.1 },
  ceiling: 0.89,
};

const masterChain = (ctx: BaseAudioContext): [AudioNode, AudioNode] => {
  const set = (
    node: DynamicsCompressorNode,
    p: { threshold: number; knee: number; ratio: number; attack: number; release: number }
  ) => {
    node.threshold.value = p.threshold;
    node.knee.value = p.knee;
    node.ratio.value = p.ratio;
    node.attack.value = p.attack;
    node.release.value = p.release;
    return node;
  };
  const comp = set(ctx.createDynamicsCompressor(), MASTER.compressor);
  const makeup = ctx.createGain();
  makeup.gain.value = Math.pow(10, MASTER.makeupDb / 20);
  const limit = set(ctx.createDynamicsCompressor(), MASTER.limiter);
  const clip = ctx.createWaveShaper();
  clip.curve = softClipCurve(MASTER.ceiling);
  comp.connect(makeup).connect(limit).connect(clip);
  return [comp, clip];
};

/** tanh up to `ceiling`: nothing passes it, and the corner is round. */
export const softClipCurve = (ceiling: number, n = 2048): Float32Array<ArrayBuffer> => {
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = ceiling * Math.tanh(x / ceiling);
  }
  return curve;
};

/**
 * The title over the opening action: a band of shade across the upper
 * middle, and in it the logo, the session and the day. In full from the
 * first frame.
 */
const drawTitleOverlay = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  card: Card
): void => {
  ctx.save();
  const band = ctx.createLinearGradient(0, h * 0.12, 0, h * 0.62);
  band.addColorStop(0, "rgba(12,7,16,0)");
  band.addColorStop(0.3, "rgba(12,7,16,0.72)");
  band.addColorStop(0.7, "rgba(12,7,16,0.72)");
  band.addColorStop(1, "rgba(12,7,16,0)");
  ctx.fillStyle = band;
  ctx.fillRect(0, h * 0.12, w, h * 0.5);
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = Math.round(Math.min(w, h) * 0.02);
  drawCardContent(ctx, w, h, card, h * 0.33, "#e6dcef");
  ctx.restore();
};

/** The logo above `baseY`, then the card's lines under it. */
const drawCardContent = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  card: Card,
  baseY: number,
  secondary: string
): void => {
  const unit = Math.min(w, h);
  const logo = loadWatermark();
  let y = baseY;
  if (logo && logo.complete && logo.naturalWidth > 0) {
    const lw = Math.min(w * 0.82, unit * 0.9);
    const lh = (lw * logo.naturalHeight) / logo.naturalWidth;
    ctx.drawImage(logo, (w - lw) / 2, y - lh, lw, lh);
  }
  y += unit * 0.1;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  card.lines.forEach((line, i) => {
    const size = i === 0 ? unit * 0.075 : unit * 0.045;
    ctx.font = `${i === 0 ? 900 : 700} ${Math.round(size)}px Poppins, system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = i === 0 ? "#f4eef6" : secondary;
    ctx.fillText(line, w / 2, y);
    y += size * 1.6;
  });
};

/**
 * A card on the brand's near-black: the logo, then a big first line and
 * smaller ones under it. No fade-in: on screen in full from the first frame,
 * because the title card's first frame is the reel's thumbnail in a gallery
 * and a feed, and faded it read as an empty reel.
 */
const drawCard = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  card: Card
): void => {
  ctx.save();
  ctx.fillStyle = "#0c0710";
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, h * 0.5);
  glow.addColorStop(0, "#2a1030");
  glow.addColorStop(1, "#0c0710");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  drawCardContent(ctx, w, h, card, h * 0.36, "#9d8fa9");
  ctx.restore();
};

/**
 * Plays, and if sound isn't allowed without a tap (a desktop browser —
 * the apps allow it), plays muted: a silent reel beats no reel.
 */
const playSafely = async (v: HTMLVideoElement): Promise<void> => {
  try {
    await v.play();
  } catch {
    v.muted = true;
    await v.play();
  }
};

/** An error as one short line. */
export const errText = (e: unknown): string =>
  e instanceof Error ? `${e.name}: ${e.message}` : String(e);

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Loads `url` until a frame can be drawn. Chrome buffers on its own; iOS
 * often fetches only the metadata until the element is told to play, and
 * waiting for "loadeddata" alone timed every clip out there. So: ask for the
 * data, and if it doesn't come, play it (the sound goes to the reel's graph,
 * never the speaker) until it does, and return to the start.
 */
const loadFrames = async (v: HTMLVideoElement, url: string): Promise<void> => {
  v.preload = "auto";
  v.src = url;
  v.load();
  if (await until(() => v.readyState >= 2 && v.videoWidth > 0, 1500)) return;
  await playSafely(v).catch(() => undefined);
  const ok = await until(() => v.readyState >= 2 && v.videoWidth > 0, 5000);
  v.pause();
  if (!ok) {
    throw new Error(
      `no frames (readyState ${v.readyState}, ${v.videoWidth}x${v.videoHeight}, ` +
        `error ${v.error?.code ?? "none"})`
    );
  }
  if (v.currentTime > 0.05) {
    v.currentTime = 0;
    await once(v, "seeked", 2000).catch(() => undefined);
  }
};

const once = (el: HTMLElement, event: string, timeoutMs: number) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${event} timed out`)), timeoutMs);
    el.addEventListener(
      event,
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true }
    );
  });

/** Resolves true once `test` passes, false if the time ran out first. */
const until = (test: () => boolean, timeoutMs: number) =>
  new Promise<boolean>((resolve) => {
    const started = performance.now();
    const tick = () => {
      if (test()) resolve(true);
      else if (performance.now() - started > timeoutMs) resolve(false);
      else requestAnimationFrame(tick);
    };
    tick();
  });

/** How long a playing clip's picture may stand still before it's a stall. */
export const STALL_MS = 700;

/**
 * Plays on until `targetS`, the end, or the time limit. Resolves true if the
 * video stopped advancing for STALL_MS on the way: decoding fell behind.
 */
const playTo = (v: HTMLVideoElement, targetS: number, timeoutMs: number) =>
  new Promise<boolean>((resolve) => {
    const started = performance.now();
    let lastT = v.currentTime;
    let movedAt = started;
    const tick = () => {
      const now = performance.now();
      if (v.currentTime !== lastT) {
        lastT = v.currentTime;
        movedAt = now;
      }
      if (v.currentTime >= targetS || v.ended || now - started > timeoutMs) {
        resolve(false);
      } else if (now - movedAt > STALL_MS) {
        resolve(true);
      } else {
        requestAnimationFrame(tick);
      }
    };
    tick();
  });

const nextFrames = (n: number) =>
  new Promise<void>((resolve) => {
    const step = (left: number) =>
      left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1));
    step(n);
  });
