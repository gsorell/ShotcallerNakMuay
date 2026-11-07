import type { CallInfo, CalloutEvent } from "./calloutSignal";
import {
  RoundPicker,
  newReelSoFar,
  roundBudgetMs,
  scoreClip,
  strikesIn,
  type Candidate,
} from "./highlights";
import { ReelNotes } from "./reelNotes";
import { HitDetector } from "./hitDetector";
import { MotionMeter, cutClip } from "./motion";
import { ReelRenderer, pickMime } from "./reelRenderer";
import type { SessionReel } from "./reelStore";
import { remuxToMp4 } from "./remux";
import { OVERLAP_MS, SegmentScheduler, type SegmentHandle } from "./segmentScheduler";

/**
 * Records a session's highlight reel.
 *
 * Every callout is filmed (SegmentScheduler), with sound. Through the whole
 * session the recorder watches for movement (MotionMeter) and listens for
 * strikes landing (HitDetector). Each clip is trimmed to its action, scored
 * on what landed, what moved and what was called, and each round keeps its
 * best (RoundPicker); they are assembled into the reel during the rest that
 * follows (ReelRenderer), so at the final bell only the last round is left.
 *
 * The camera is recorded as it comes, the true view (only the live preview
 * is mirrored). The watermark is added when the reel is assembled.
 *
 * Sound is recorded with the browser's voice processing off: echo
 * cancellation would strip out the app's own callouts, and noise suppression
 * and gain control flatten the crack of a pad, which is what HitDetector
 * listens for. If the microphone is refused, the reel is filmed silent and
 * judged on movement.
 */
export class ReelRecorder {
  private camera: MediaStream | null = null;
  private meter: MotionMeter | null = null;
  private hits: HitDetector | null = null;
  private renderer: ReelRenderer | null = null;
  private scheduler: SegmentScheduler | null = null;
  private readonly budgetMs: number;
  private picker: RoundPicker;
  /** What the reel has shown so far: no technique past twice, or twice running. */
  private soFar = newReelSoFar();
  /** Every clip's verdict, written where it can be read for tuning. */
  private notes = new ReelNotes();
  private round = 0;
  private mimeType = "";
  private seq = 0;
  /** Each kept clip's movement, for judging the next against this session. */
  private motionSeen: number[] = [];
  /** Clips still being filmed or finalised; a round waits for them. */
  private pending = new Set<Promise<void>>();
  /** The last clip opened, closed early if a second recorder won't start. */
  private lastOpen: MediaRecorder | null = null;
  /** Round ends are handled one at a time, in order. */
  private rounds: Promise<void> = Promise.resolve();
  /** Told when filming starts or stops, for the preview's red dot. */
  onRecordingChange: (recording: boolean) => void = () => {};

  /** `roundMs`: one round's length; with the count, the session's work. */
  constructor(
    private readonly roundCount: number,
    roundMs: number
  ) {
    this.budgetMs = roundBudgetMs(roundCount * roundMs, roundCount);
    this.picker = new RoundPicker(this.budgetMs);
  }

  /** Opens the camera (and microphone) into `preview` and gets ready. */
  async start(preview: HTMLVideoElement): Promise<void> {
    const video = {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    };
    try {
      this.camera = await navigator.mediaDevices.getUserMedia({
        video,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    } catch {
      // No microphone (refused, or none): film silent.
      this.camera = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    }
    preview.srcObject = this.camera;
    preview.muted = true; // never play the room back through the speaker
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
    const withAudio = this.camera.getAudioTracks().length > 0;
    this.mimeType = pickMime(withAudio);
    this.meter = new MotionMeter(preview);
    this.meter.start();
    if (withAudio) {
      this.hits = new HitDetector();
      if (!(await this.hits.start(this.camera))) this.hits = null;
    }
    this.renderer = new ReelRenderer(withAudio);
    this.scheduler = new SegmentScheduler(
      () => this.openSegment(),
      (on) => this.onRecordingChange(on)
    );
  }

  /** The callout engine's timing and calls. */
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
    this.stopCapture();
    const renderer = this.renderer;
    this.renderer = null;
    if (!renderer) return null;
    const out = await renderer.finish();
    void this.notes.save();
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
    this.stopCapture();
  }

  private stopCapture(): void {
    this.meter?.stop();
    this.meter = null;
    this.hits?.stop();
    this.hits = null;
    this.camera?.getTracks().forEach((t) => t.stop());
    this.camera = null;
  }

  private async closeRound(): Promise<void> {
    // The last clip's handover runs on for a moment after the round ends.
    await new Promise((r) => setTimeout(r, OVERLAP_MS + 150));
    await Promise.all([...this.pending]);
    this.round += 1;
    const picks = this.picker.pick(this.budgetMs, this.soFar, this.round === 1);
    this.picker = new RoundPicker(this.budgetMs);
    this.notes.round(
      this.round,
      picks.map((p) => p.seq)
    );
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
    const audio = stream.getAudioTracks().length > 0;
    const make = () =>
      new MediaRecorder(stream, {
        videoBitsPerSecond: 2_500_000,
        ...(audio ? { audioBitsPerSecond: 128_000 } : {}),
        ...(this.mimeType ? { mimeType: this.mimeType } : {}),
      });
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
    const calls: CallInfo[] = [];
    let callAt: number | undefined;
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    const done = new Promise<void>((resolve) => {
      rec.addEventListener(
        "stop",
        () => {
          const stoppedAt = performance.now();
          this.offer(seq, chunks, calls, callAt, rec.mimeType, startedAt, stoppedAt);
          resolve();
        },
        { once: true }
      );
    });
    this.pending.add(done);
    void done.then(() => this.pending.delete(done));

    return {
      tag: (call) => {
        calls.push(call);
        if (!call.between && callAt === undefined) callAt = performance.now();
      },
      close: () => {
        try {
          if (rec.state !== "inactive") rec.stop();
        } catch {
          /* already stopped */
        }
      },
    };
  }

  /** A clip finished filming: trim it to its action, score it, offer it. */
  private offer(
    seq: number,
    chunks: Blob[],
    calls: CallInfo[],
    callAt: number | undefined,
    type: string,
    startedAt: number,
    stoppedAt: number
  ): void {
    const meter = this.meter;
    if (!chunks.length || !meter) return;
    const samples = meter
      .between(startedAt, stoppedAt)
      .map((s) => ({ t: s.at - startedAt, m: s.m }));
    const hits = (this.hits?.between(startedAt, stoppedAt) ?? []).map(
      (t) => t - startedAt
    );
    const cut = cutClip({
      samples,
      durationMs: stoppedAt - startedAt,
      levels: meter.levels(),
      hits,
      callAtMs: callAt !== undefined ? callAt - startedAt : undefined,
      strikes: strikesIn(calls),
    });
    if (cut.endMs <= cut.startMs) {
      this.notes.clip(seq, calls, cut, 0);
      return;
    }

    // What an ordinary clip's movement amounts to in this session so far.
    this.motionSeen.push(cut.motion);
    const sorted = [...this.motionSeen].sort((a, b) => a - b);
    const motionNorm = sorted[Math.floor(sorted.length / 2)] ?? cut.motion;
    const score = scoreClip(cut, calls, motionNorm);
    this.notes.clip(seq, calls, cut, score);
    if (score <= 0) return;

    const url = URL.createObjectURL(new Blob(chunks, { type: type || "video/webm" }));
    this.picker.offer({
      seq,
      cut,
      calls,
      score,
      url,
      release: () => URL.revokeObjectURL(url),
    } satisfies Candidate);
  }
}
