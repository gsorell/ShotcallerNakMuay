import type { CalloutEvent } from "./calloutSignal";
import { ClipScheduler } from "./clipScheduler";
import type { SessionReel } from "./reelStore";

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
 * One MediaRecorder for the whole session, *resumed* when a clip opens and
 * *paused* when it ends (when is ClipScheduler's call). A paused recorder leaves no gap in
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
  private readonly scheduler: ClipScheduler;
  /** Told when a clip starts or stops, for the preview's red border. */
  onRecordingChange: (recording: boolean) => void = () => {};

  constructor(plannedWorkMs: number) {
    this.scheduler = new ClipScheduler(
      { roll: () => this.roll(), cut: () => this.cut() },
      plannedWorkMs
    );
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

  /** The callout engine's timing; the scheduler decides when to film. */
  event(e: CalloutEvent): void {
    if (this.recorder) this.scheduler.event(e);
  }

  /** Paused, resting, or the round ended. */
  hold(): void {
    this.scheduler.hold();
  }

  /** Rolls the tape: the recorder resumes (or starts, the first time). */
  private roll(): void {
    const r = this.recorder;
    if (!r || r.state === "recording") return;
    try {
      if (r.state === "inactive") r.start(1000);
      else r.resume();
      this.onRecordingChange(true);
    } catch {
      /* the clip is lost, not the session */
    }
  }

  /** Cuts the tape: the recorder pauses, leaving no gap in the file. */
  private cut(): void {
    const r = this.recorder;
    if (!r || r.state !== "recording") return;
    try {
      r.pause();
    } catch {
      /* stays recording; finish() still closes it */
    }
    this.onRecordingChange(false);
  }

  /** Stops everything and hands back the reel, or null if nothing was shot. */
  async finish(): Promise<SessionReel | null> {
    this.scheduler.hold();
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
          durationMs: Math.round(this.scheduler.recordedMs),
          clips: this.scheduler.clips,
        };
      }
    }
    this.release();
    return reel;
  }

  /** Lets go of the camera without keeping anything. */
  release(): void {
    this.scheduler.dispose();
    this.drawing = false;
    this.camera?.getTracks().forEach((t) => t.stop());
    this.canvasStream?.getTracks().forEach((t) => t.stop());
    this.camera = null;
    this.canvasStream = null;
    this.chunks = [];
  }
}

/**
 * The header's own banner (icon, SHOT CALLER, MUAY THAI TIMER) on a
 * transparent background. Loaded once; until it has, the reel falls back to
 * the wordmark drawn as text, so no frame goes out unbranded.
 */
const WATERMARK_SRC = "/assets/Logo_Header_Banner_Smooth.webp";
let watermarkImg: HTMLImageElement | null = null;

const loadWatermark = (): HTMLImageElement | null => {
  if (typeof Image === "undefined") return null;
  if (!watermarkImg) {
    watermarkImg = new Image();
    watermarkImg.decoding = "async";
    watermarkImg.src = WATERMARK_SRC;
  }
  return watermarkImg;
};

// Fetched with the module, so it is decoded before the first clip opens.
loadWatermark();

/** The banner in the bottom-right corner, about 45% of the frame's width. */
const drawWatermark = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void => {
  const img = loadWatermark();
  if (img && img.complete && img.naturalWidth > 0) {
    const margin = Math.round(Math.min(w, h) * 0.035);
    const markW = Math.round(Math.min(w * 0.45, 560));
    const markH = Math.round((markW * img.naturalHeight) / img.naturalWidth);
    ctx.save();
    // A soft shadow lifts the neon off a bright room behind it.
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = Math.round(markH * 0.12);
    ctx.drawImage(img, w - markW - margin, h - markH - margin, markW, markH);
    ctx.restore();
    return;
  }
  drawTextWatermark(ctx, w, h);
};

/** The wordmark's magenta-to-cyan ramp as text: the fallback. */
const drawTextWatermark = (
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
