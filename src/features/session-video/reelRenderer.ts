import { drawWatermark, loadWatermark } from "./watermark";

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
  /** A stretch to play at half speed: the clip's best moment. */
  slow?: { fromMs: number; toMs: number };
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
/** Slow motion's speed, and how loud the sound stays through it. */
const SLOW_RATE = 0.5;
const SLOW_GAIN = 0.35;

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
  private gain: GainNode | null = null;
  private queue: Promise<void> = Promise.resolve();
  /** What the canvas shows: a clip, a card, or nothing new. */
  private scene:
    | { kind: "clip"; clip: RenderClip }
    | { kind: "card"; card: Card; startedAt: number }
    | null = null;
  /** Shown before the first clip, once the frame's shape is known. */
  private title: Card | null = null;
  renderedMs = 0;
  clips = 0;

  /** `withAudio`: the clips carry sound, and the reel should too. */
  constructor(withAudio = false) {
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
        const actx = new Ctx();
        const dest = actx.createMediaStreamDestination();
        const gain = actx.createGain();
        actx.createMediaElementSource(v).connect(gain).connect(dest);
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
        v.muted = false;
        void actx.resume().catch(() => undefined);
        this.audioCtx = actx;
        this.gain = gain;
        audio = true;
      } catch (e) {
        console.warn("Reel will be silent:", e);
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
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) this.chunks.push(e.data);
    };
  }

  /** The opening card, shown before the first clip. */
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
      drawCard(ctx, w, h, scene.card, performance.now() - scene.startedAt);
      return;
    }
    const v = this.video;
    if (v.readyState < 2 || !v.videoWidth) return;
    const clip = scene.clip;
    const span = Math.max(1, clip.endMs - clip.startMs);
    const progress = (v.currentTime * 1000 - clip.startMs) / span;
    const c = cropAt(clip.crop ?? { x: 0, y: 0, w: 1, h: 1 }, progress);
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
    drawWatermark(ctx, w, h);
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
    this.scene = { kind: "card", card, startedAt: performance.now() };
    await nextFrames(1);
    this.roll();
    const rolledAt = performance.now();
    await wait(card.durationMs);
    this.cut();
    this.renderedMs += performance.now() - rolledAt;
    this.scene = null;
  }

  private async renderOne(clip: RenderClip): Promise<void> {
    const v = this.video;
    v.src = clip.url;
    await once(v, "loadeddata", 5000);
    // The reel takes the shape of the camera's frame, set once.
    if (!this.sized && v.videoWidth) {
      this.canvas.width = v.videoWidth;
      this.canvas.height = v.videoHeight;
      this.sized = true;
    }
    if (this.title) {
      const title = this.title;
      this.title = null;
      await this.renderCard(title);
    }
    const startS = clip.startMs / 1000;
    const endS = clip.endMs / 1000;

    // Run up to the kept part fast, off the record.
    if (startS > 0.05) {
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
    this.scene = { kind: "clip", clip };
    // Let the canvas catch the first kept frame before the tape rolls, so
    // the reel never opens a clip on the last frame of the one before.
    await nextFrames(2);

    this.roll();
    const rolledAt = performance.now();
    await playSafely(v);
    const limit = (endS - startS) * 1000 * 2 + 3000;
    if (clip.slow) {
      const fromS = clip.slow.fromMs / 1000;
      const toS = clip.slow.toMs / 1000;
      await until(() => v.currentTime >= fromS || v.ended, limit);
      this.setSlow(true);
      await until(() => v.currentTime >= toS || v.ended, limit);
      this.setSlow(false);
    }
    await until(() => v.currentTime >= endS || v.ended, limit);
    this.cut();
    v.pause();
    this.setSlow(false);
    this.renderedMs += performance.now() - rolledAt;
  }

  /** Half speed, with the sound pulled back: slowed speech sounds wrong. */
  private setSlow(on: boolean): void {
    this.video.playbackRate = on ? SLOW_RATE : 1;
    const g = this.gain;
    const actx = this.audioCtx;
    if (g && actx) {
      g.gain.setTargetAtTime(on ? SLOW_GAIN : 1, actx.currentTime, 0.05);
    }
  }
}

/**
 * A card on the brand's near-black: the logo, then a big first line and
 * smaller ones under it. Fades in over its first quarter-second.
 */
const drawCard = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  card: Card,
  elapsedMs: number
): void => {
  ctx.save();
  ctx.fillStyle = "#0c0710";
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, h * 0.5);
  glow.addColorStop(0, "#2a1030");
  glow.addColorStop(1, "#0c0710");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = Math.min(1, elapsedMs / 250);
  const unit = Math.min(w, h);
  const logo = loadWatermark();
  let y = h * 0.36;
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
    ctx.fillStyle = i === 0 ? "#f4eef6" : "#9d8fa9";
    ctx.fillText(line, w / 2, y);
    y += size * 1.6;
  });
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

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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

const until = (test: () => boolean, timeoutMs: number) =>
  new Promise<void>((resolve) => {
    const started = performance.now();
    const tick = () => {
      if (test() || performance.now() - started > timeoutMs) resolve();
      else requestAnimationFrame(tick);
    };
    tick();
  });

const nextFrames = (n: number) =>
  new Promise<void>((resolve) => {
    const step = (left: number) =>
      left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1));
    step(n);
  });
