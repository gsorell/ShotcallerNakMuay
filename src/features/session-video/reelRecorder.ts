import type { SessionReel } from "./reelStore";

/** Seconds of footage after each callout that starts a clip. */
export const CLIP_MS = 3000;
/** Roughly how long the finished reel runs: short enough to post. */
export const REEL_TARGET_MS = 30000;

/**
 * How far apart clips must start so the reel's clips are spread across the
 * whole session instead of all landing in round one. Callouts come every few
 * seconds, so taking every one would just record the first half-minute.
 */
export const clipGapMs = (
  plannedWorkMs: number,
  clipMs = CLIP_MS,
  targetMs = REEL_TARGET_MS
): number => {
  const clipsWanted = Math.max(1, Math.round(targetMs / clipMs));
  return Math.max(0, plannedWorkMs / clipsWanted - clipMs);
};

/** Whether a callout at `now` should open a clip. */
export const shouldStartClip = (s: {
  now: number;
  lastClipEnd: number;
  gapMs: number;
  recordedMs: number;
  /** Hard ceiling, for a session that runs longer than planned. */
  maxMs: number;
}): boolean => s.now - s.lastClipEnd >= s.gapMs && s.recordedMs < s.maxMs;

/** MP4 first: it plays everywhere and Photos takes it. WebM where it's not. */
const pickMime = (): string => {
  const candidates = [
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
 * Records a session's highlight reel.
 *
 * One MediaRecorder for the whole session, *resumed* when a callout opens a
 * clip and *paused* when the clip ends. A paused recorder leaves no gap in
 * its output, so the reel is a single finished file the moment the session
 * ends: no clips to stitch, nothing to re-encode on the phone.
 *
 * The camera is drawn onto a canvas and the canvas is what gets recorded, so
 * the reel carries the watermark and is mirrored to match the preview the
 * user watched. Video only — opening the microphone changes the iOS audio
 * session, and the app's callouts have been silenced by that before.
 */
export class ReelRecorder {
  private camera: MediaStream | null = null;
  private canvasStream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private drawing = false;
  private clipTimer: ReturnType<typeof setTimeout> | null = null;
  private segmentStart = 0;
  private lastClipEnd = -Infinity;
  private recordedMs = 0;
  private clips = 0;
  private readonly gapMs: number;
  private readonly maxMs: number;
  /** Told when a clip starts or stops, for the preview's red border. */
  onRecordingChange: (recording: boolean) => void = () => {};

  constructor(plannedWorkMs: number) {
    this.gapMs = clipGapMs(plannedWorkMs);
    this.maxMs = REEL_TARGET_MS + CLIP_MS * 2;
  }

  /** Opens the front camera into `preview` and gets the recorder ready. */
  async start(preview: HTMLVideoElement): Promise<void> {
    this.camera = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
    });
    preview.srcObject = this.camera;
    preview.muted = true;
    preview.playsInline = true;
    await preview.play().catch(() => undefined);
    if (!preview.videoWidth) {
      await new Promise<void>((resolve) => {
        preview.addEventListener("loadedmetadata", () => resolve(), {
          once: true,
        });
        setTimeout(resolve, 3000);
      });
    }

    const canvas = document.createElement("canvas");
    const fit = () => {
      canvas.width = preview.videoWidth || 720;
      canvas.height = preview.videoHeight || 1280;
    };
    fit();
    // Turning the phone hands back a rotated stream; follow it.
    preview.addEventListener("resize", fit);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D canvas");

    this.drawing = true;
    const draw = () => {
      if (!this.drawing) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(preview, 0, 0, w, h);
      ctx.restore();
      drawWatermark(ctx, w, h);
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);

    this.canvasStream = canvas.captureStream(30);
    const mimeType = pickMime();
    this.recorder = new MediaRecorder(
      this.canvasStream,
      mimeType
        ? { mimeType, videoBitsPerSecond: 2_500_000 }
        : { videoBitsPerSecond: 2_500_000 }
    );
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) this.chunks.push(e.data);
    };
  }

  /** A technique was just called. */
  callout(): void {
    const r = this.recorder;
    if (!r || r.state === "recording") return;
    const now = performance.now();
    if (
      !shouldStartClip({
        now,
        lastClipEnd: this.lastClipEnd,
        gapMs: this.gapMs,
        recordedMs: this.recordedMs,
        maxMs: this.maxMs,
      })
    ) {
      return;
    }
    try {
      if (r.state === "inactive") r.start(1000);
      else r.resume();
    } catch {
      return;
    }
    this.segmentStart = now;
    this.clips += 1;
    this.onRecordingChange(true);
    this.clipTimer = setTimeout(() => this.endClip(), CLIP_MS);
  }

  /** Ends the clip in progress — the round ended, or the session paused. */
  endClip(): void {
    if (this.clipTimer) {
      clearTimeout(this.clipTimer);
      this.clipTimer = null;
    }
    const r = this.recorder;
    if (!r || r.state !== "recording") return;
    try {
      r.pause();
    } catch {
      /* stays recording; finish() still closes it */
    }
    const now = performance.now();
    this.recordedMs += now - this.segmentStart;
    this.lastClipEnd = now;
    this.onRecordingChange(false);
  }

  /** Stops everything and hands back the reel, or null if nothing was shot. */
  async finish(): Promise<SessionReel | null> {
    this.endClip();
    const r = this.recorder;
    this.recorder = null;
    let reel: SessionReel | null = null;
    if (r && r.state !== "inactive") {
      const stopped = new Promise<void>((resolve) => {
        r.addEventListener("stop", () => resolve(), { once: true });
        setTimeout(resolve, 4000);
      });
      try {
        r.stop();
      } catch {
        /* the stop event may never come; the timeout covers it */
      }
      await stopped;
      const type = r.mimeType || this.chunks[0]?.type || "video/webm";
      if (this.chunks.length) {
        const blob = new Blob(this.chunks, { type });
        reel = {
          blob,
          url: URL.createObjectURL(blob),
          ext: type.includes("mp4") ? "mp4" : "webm",
          durationMs: Math.round(this.recordedMs),
          clips: this.clips,
        };
      }
    }
    this.release();
    return reel;
  }

  /** Lets go of the camera without keeping anything. */
  release(): void {
    if (this.clipTimer) clearTimeout(this.clipTimer);
    this.clipTimer = null;
    this.drawing = false;
    this.camera?.getTracks().forEach((t) => t.stop());
    this.canvasStream?.getTracks().forEach((t) => t.stop());
    this.camera = null;
    this.canvasStream = null;
    this.chunks = [];
  }
}

/** The wordmark's magenta-to-cyan ramp, small, in the bottom corner. */
const drawWatermark = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void => {
  const fs = Math.round(Math.min(w, h) * 0.045);
  ctx.save();
  ctx.font = `900 ${fs}px Poppins, system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  const x = w - fs * 0.7;
  const y = h - fs * 0.6;
  const textW = ctx.measureText("SHOT CALLER").width;
  const ramp = ctx.createLinearGradient(x - textW, 0, x, 0);
  ramp.addColorStop(0, "#f838f8");
  ramp.addColorStop(0.5, "#8898f8");
  ramp.addColorStop(1, "#18f8f8");
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = fs * 0.3;
  ctx.fillStyle = ramp;
  ctx.fillText("SHOT CALLER", x, y);
  ctx.restore();
};
