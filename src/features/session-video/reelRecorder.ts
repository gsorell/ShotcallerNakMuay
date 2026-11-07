import type { CalloutEvent } from "./calloutSignal";
import { RoundPicker, roundBudgetMs, type Candidate } from "./highlights";
import { MotionMeter, cutClip } from "./motion";
import { ReelRenderer, pickMime } from "./reelRenderer";
import type { SessionReel } from "./reelStore";
import { remuxToMp4 } from "./remux";
import { OVERLAP_MS, SegmentScheduler, type SegmentHandle } from "./segmentScheduler";

/**
 * Records a session's highlight reel.
 *
 * The first version filmed the callouts it guessed would be good and kept
 * whatever it got; on pads that was mostly someone waiting for the next
 * call. This one films every callout (SegmentScheduler), measures movement
 * the whole time (MotionMeter), trims each clip to its action and keeps
 * only each round's busiest (RoundPicker), and assembles the reel from them
 * during the rest that follows (ReelRenderer). By the final bell only the
 * last round's few seconds are left to assemble.
 *
 * The camera is recorded as it comes. Mirroring and the watermark are added
 * when the reel is assembled. Video only: opening the microphone changes the
 * iOS audio session, and the app's callouts have been silenced by that
 * before.
 */
export class ReelRecorder {
  private camera: MediaStream | null = null;
  private meter: MotionMeter | null = null;
  private renderer: ReelRenderer | null = null;
  private scheduler: SegmentScheduler | null = null;
  private picker = new RoundPicker();
  private mimeType = "";
  private seq = 0;
  /** Clips still being filmed or finalised; a round waits for them. */
  private pending = new Set<Promise<void>>();
  /** The last clip opened, closed early if a second recorder won't start. */
  private lastOpen: MediaRecorder | null = null;
  /** Round ends are handled one at a time, in order. */
  private rounds: Promise<void> = Promise.resolve();
  /** Told when filming starts or stops, for the preview's red dot. */
  onRecordingChange: (recording: boolean) => void = () => {};

  constructor(private readonly roundCount: number) {}

  /** Opens the front camera into `preview` and gets everything ready. */
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
    this.mimeType = pickMime();
    this.meter = new MotionMeter(preview);
    this.meter.start();
    this.renderer = new ReelRenderer();
    this.scheduler = new SegmentScheduler(
      () => this.openSegment(),
      (on) => this.onRecordingChange(on)
    );
  }

  /** The callout engine's timing. */
  event(e: CalloutEvent): void {
    this.scheduler?.event(e);
  }

  /** Paused, or between rounds: stop filming. */
  hold(): void {
    this.scheduler?.hold();
  }

  /** A round ended: pick its best clips and add them to the reel. */
  roundOver(): void {
    this.scheduler?.hold();
    this.rounds = this.rounds.then(() => this.closeRound());
  }

  /** Stops everything and hands back the reel, or null if nothing was kept. */
  async finish(): Promise<SessionReel | null> {
    this.scheduler?.stop();
    this.rounds = this.rounds.then(() => this.closeRound());
    await this.rounds;
    // Nothing more is filmed; the camera can go before the last assembly.
    this.stopCamera();
    const renderer = this.renderer;
    this.renderer = null;
    if (!renderer) return null;
    const out = await renderer.finish();
    if (!out) return null;
    // Recorder output can't be scrubbed in a gallery; give it an index.
    const { blob, remuxed } = await remuxToMp4(out.blob);
    return {
      blob,
      url: URL.createObjectURL(blob),
      ext: remuxed || out.type.includes("mp4") ? "mp4" : "webm",
      durationMs: Math.round(renderer.renderedMs),
      clips: renderer.clips,
    };
  }

  /** Lets go of everything without keeping anything. */
  release(): void {
    this.scheduler?.stop();
    this.scheduler = null;
    this.picker.clear();
    this.renderer?.dispose();
    this.renderer = null;
    this.stopCamera();
  }

  private stopCamera(): void {
    this.meter?.stop();
    this.meter = null;
    this.camera?.getTracks().forEach((t) => t.stop());
    this.camera = null;
  }

  private async closeRound(): Promise<void> {
    // The last clip's handover runs on for a moment after the round ends.
    await new Promise((r) => setTimeout(r, OVERLAP_MS + 150));
    await Promise.all([...this.pending]);
    const picks = this.picker.pick(roundBudgetMs(this.roundCount));
    if (!picks.length || !this.renderer) {
      picks.forEach((p) => p.release());
      return;
    }
    // Queued, not awaited: the next round starts filming while this one is
    // still being assembled.
    void this.renderer.add(
      picks.map((p) => ({ url: p.url, startMs: p.cut.startMs, endMs: p.cut.endMs })),
      (clip) => picks.find((p) => p.url === clip.url)?.release()
    );
  }

  /** Starts filming one clip; the scheduler says when to close it. */
  private openSegment(): SegmentHandle | null {
    const stream = this.camera;
    if (!stream) return null;
    const make = () =>
      new MediaRecorder(
        stream,
        this.mimeType
          ? { mimeType: this.mimeType, videoBitsPerSecond: 2_500_000 }
          : { videoBitsPerSecond: 2_500_000 }
      );
    let rec: MediaRecorder;
    try {
      rec = make();
      rec.start();
    } catch {
      // Some phones won't run two at once: give up the overlap, not the clip.
      try {
        if (this.lastOpen?.state === "recording") this.lastOpen.stop();
        rec = make();
        rec.start();
      } catch (e) {
        console.warn("Clip could not start:", e);
        return null;
      }
    }
    this.lastOpen = rec;

    const seq = (this.seq += 1);
    const startedAt = performance.now();
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    const done = new Promise<void>((resolve) => {
      rec.addEventListener(
        "stop",
        () => {
          const stoppedAt = performance.now();
          this.offer(seq, chunks, rec.mimeType, startedAt, stoppedAt);
          resolve();
        },
        { once: true }
      );
    });
    this.pending.add(done);
    void done.then(() => this.pending.delete(done));

    return {
      close: () => {
        try {
          if (rec.state !== "inactive") rec.stop();
        } catch {
          /* already stopped */
        }
      },
    };
  }

  /** A clip finished filming: trim it to its action and offer it up. */
  private offer(
    seq: number,
    chunks: Blob[],
    type: string,
    startedAt: number,
    stoppedAt: number
  ): void {
    const meter = this.meter;
    if (!chunks.length || !meter) return;
    const samples = meter
      .between(startedAt, stoppedAt)
      .map((s) => ({ t: s.at - startedAt, m: s.m }));
    const cut = cutClip(samples, stoppedAt - startedAt, meter.levels());
    if (cut.score <= 0) return;
    const url = URL.createObjectURL(new Blob(chunks, { type: type || "video/webm" }));
    const candidate: Candidate = {
      seq,
      cut,
      url,
      release: () => URL.revokeObjectURL(url),
    };
    this.picker.offer(candidate);
  }
}
