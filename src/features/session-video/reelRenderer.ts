import { drawWatermark } from "./watermark";

/** A kept clip: its video and the part of it to use. */
export interface RenderClip {
  url: string;
  startMs: number;
  endMs: number;
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

/**
 * Builds the reel: plays each kept clip's best stretch onto a canvas, with
 * the watermark, the right way round, into one recorder that is paused
 * between clips — so the output is one file with no gaps.
 *
 * It runs at playback speed, which is why it is fed a round at a time during
 * the rests: by the final bell only the last round's few seconds are left.
 * The stretch before a clip's kept part is skipped at 4x with the recorder
 * paused, rather than seeked to, because recorder-made files often seek
 * poorly.
 */
export class ReelRenderer {
  private readonly canvas = document.createElement("canvas");
  private readonly ctx: CanvasRenderingContext2D;
  private readonly video = document.createElement("video");
  private readonly recorder: MediaRecorder;
  private readonly chunks: Blob[] = [];
  private drawing = true;
  private started = false;
  private audioCtx: AudioContext | null = null;
  private queue: Promise<void> = Promise.resolve();
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
      if (v.readyState >= 2 && v.videoWidth) {
        if (
          this.canvas.width !== v.videoWidth ||
          this.canvas.height !== v.videoHeight
        ) {
          this.canvas.width = v.videoWidth;
          this.canvas.height = v.videoHeight;
        }
        const w = this.canvas.width;
        const h = this.canvas.height;
        // Drawn as the camera delivered it — the true view, not mirrored.
        // Only the live preview is mirrored, like every selfie preview; a
        // mirrored reel had every orthodox fighter southpaw and text backwards.
        this.ctx.drawImage(v, 0, 0, w, h);
        drawWatermark(this.ctx, w, h);
      }
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
        actx.createMediaElementSource(v).connect(dest);
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
        v.muted = false;
        void actx.resume().catch(() => undefined);
        this.audioCtx = actx;
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

  /** Waits for the queue, then closes the reel and hands it back. */
  async finish(): Promise<{ blob: Blob; type: string } | null> {
    await this.queue;
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

  private async renderOne(clip: RenderClip): Promise<void> {
    const v = this.video;
    v.src = clip.url;
    await once(v, "loadeddata", 5000);
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
    // Let the canvas catch the first kept frame before the tape rolls, so
    // the reel never opens a clip on the last frame of the one before.
    await nextFrames(2);

    const r = this.recorder;
    if (!this.started) {
      r.start(1000);
      this.started = true;
    } else if (r.state === "paused") {
      r.resume();
    }
    const rolledAt = performance.now();
    await playSafely(v);
    await until(() => v.currentTime >= endS || v.ended, (endS - startS) * 1000 + 3000);
    if (r.state === "recording") r.pause();
    v.pause();
    this.renderedMs += performance.now() - rolledAt;
  }
}

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
