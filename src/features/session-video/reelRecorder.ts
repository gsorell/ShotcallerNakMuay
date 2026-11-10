import type { CallInfo, CalloutEvent } from "./calloutSignal";
import {
  RoundPicker,
  newReelSoFar,
  roundBudgetMs,
  scoreClip,
  strikesIn,
  type Candidate,
} from "./highlights";
import { openBuiltInMic } from "./micChoice";
import { ReelNotes } from "./reelNotes";
import { HitDetector } from "./hitDetector";
import { endCard, titleCard } from "./cards";
import { MotionMeter, cropFromHeat, cutClip } from "./motion";
import { ReelRenderer, pickMime, type Card, type RenderClip } from "./reelRenderer";
import type { SessionReel } from "./reelStore";
import { remuxToMp4 } from "./remux";
import { OVERLAP_MS, SegmentScheduler, type SegmentHandle } from "./segmentScheduler";

/**
 * Whether a session ended with enough work in it for a reel: about one
 * round's worth (a completed session always has). Callouts start a moment
 * into a round, so "a round" allows for that.
 */
export const keepsReel = (workedMs: number, roundMs: number): boolean =>
  workedMs >= Math.min(roundMs * 0.85, roundMs - 5000);

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
  /**
   * When the app's own voice was speaking. A crack heard then may be a
   * consonant, not a strike: those don't count towards a clip's score.
   */
  private speech: { from: number; to: number }[] = [];
  /** Techniques called this session, for the end card. */
  private callsMade = 0;
  /**
   * Time spent working (callouts coming, not paused or resting), for the end
   * card and for whether a stopped session is worth a reel.
   */
  private workedMs = 0;
  private withAudio = false;
  private title: Card | null = null;
  private workingSince: number | null = null;
  /** Told when filming starts or stops, for the preview's red dot. */
  onRecordingChange: (recording: boolean) => void = () => {};

  /** `roundMs`: one round's length; with the count, the session's work. */
  constructor(
    private readonly roundCount: number,
    private readonly roundMs: number
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
    this.camera = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    // The phone's own microphone, never a headset's (see micChoice.ts). No
    // microphone (refused, or none): film silent.
    const mic = await openBuiltInMic();
    mic?.getAudioTracks().forEach((t) => this.camera?.addTrack(t));
    // The picture only. Given the microphone too, the muted preview still
    // opened a low-latency output to "play" it, and that crackled a
    // Bluetooth speaker all session (see micChoice.ts).
    preview.srcObject = new MediaStream(this.camera.getVideoTracks());
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
    this.withAudio = withAudio;
    this.title = titleCard(this.roundCount, this.roundMs);
    this.renderer.setTitle(this.title);
    this.scheduler = new SegmentScheduler(
      () => this.openSegment(),
      (on) => this.onRecordingChange(on)
    );
  }

  /** The callout engine's timing and calls. */
  event(e: CalloutEvent): void {
    const now = performance.now();
    if ((e.type === "scheduled" || e.type === "called") && this.workingSince === null) {
      this.workingSince = now;
    }
    if (e.type === "sound") {
      // A bell rings on: its tail is as loud as its strike.
      this.speech.push({ from: now, to: now + e.durationMs + 150 });
      return;
    }
    if (e.type === "called") {
      if (!e.call.between) this.callsMade += 1;
      // Open-ended until the voice says it's done (or a backstop).
      this.speech.push({ from: now, to: now + 6000 });
      if (this.speech.length > 400) this.speech = this.speech.slice(-200);
    } else if (e.type === "spoken") {
      const last = this.speech[this.speech.length - 1];
      // A beat after the last word: the voice's own tail.
      if (last && last.to > now) last.to = now + 150;
    }
    this.scheduler?.event(e);
  }

  /** Paused, or between rounds: stop filming. */
  hold(): void {
    this.stopWorkClock();
    this.scheduler?.hold();
  }

  /** A round ended: pick its best clips and add them to the reel. */
  roundOver(): void {
    this.stopWorkClock();
    this.scheduler?.hold();
    this.rounds = this.rounds.then(() => this.closeRound());
  }

  /** Stops everything and hands back the reel, or null if nothing was kept. */
  async finish(): Promise<SessionReel | null> {
    this.stopWorkClock();
    this.scheduler?.stop();
    // Stopped before a round's worth of work: no reel. A minute of warming
    // up isn't a session, and its reel would land in the gallery anyway.
    if (!keepsReel(this.workedMs, this.roundMs)) {
      this.notes.round(this.round + 1, []);
      void this.notes.save();
      this.release();
      return null;
    }
    this.rounds = this.rounds.then(() => this.closeRound());
    await this.rounds;
    // Nothing more is filmed; the camera can go before the last assembly.
    this.stopCapture();
    const renderer = this.renderer;
    this.renderer = null;
    if (!renderer) return null;
    const out = await renderer.finish(endCard(this.callsMade, this.workedMs));
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
      cut: this.title
        ? {
            segments: [...renderer.segments],
            endCardFromMs: renderer.endCardFromMs,
            title: this.title,
            withAudio: this.withAudio,
          }
        : undefined,
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

  private stopWorkClock(): void {
    if (this.workingSince === null) return;
    this.workedMs += performance.now() - this.workingSince;
    this.workingSince = null;
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
    // The round's best comes last; it gets slow motion at its peak.
    const best = picks[picks.length - 1];
    const clips: RenderClip[] = picks.map((p) => ({
      url: p.url,
      startMs: p.cut.startMs,
      endMs: p.cut.endMs,
      crop: p.crop,
      score: p.score,
      slow:
        p === best && p.peakMs !== undefined
          ? {
              fromMs: Math.max(p.cut.startMs, p.peakMs - 450),
              toMs: Math.min(p.cut.endMs, p.peakMs + 350),
            }
          : undefined,
    }));
    void this.renderer.add(clips, (clip) =>
      picks.find((p) => p.url === clip.url)?.release()
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
    const heard = this.hits?.between(startedAt, stoppedAt) ?? [];
    const hits = heard.map((t) => t - startedAt);
    const cleanHits = heard
      .filter((t) => !this.speech.some((s) => t >= s.from && t <= s.to))
      .map((t) => t - startedAt);
    const cut = cutClip({
      samples,
      durationMs: stoppedAt - startedAt,
      levels: meter.levels(),
      hits,
      cleanHits,
      callAtMs: callAt !== undefined ? callAt - startedAt : undefined,
      strikes: strikesIn(calls),
    });
    if (cut.endMs <= cut.startMs) {
      this.notes.clip(seq, calls, cut, 0, 0);
      return;
    }

    // What an ordinary clip's movement amounts to in this session so far.
    this.motionSeen.push(cut.motion);
    const sorted = [...this.motionSeen].sort((a, b) => a - b);
    const motionNorm = sorted[Math.floor(sorted.length / 2)] ?? cut.motion;
    const score = scoreClip(cut, calls, motionNorm);
    this.notes.clip(
      seq,
      calls,
      cut,
      score,
      hits.filter((t) => t >= cut.startMs && t <= cut.endMs).length
    );
    if (score <= 0) return;

    // Framed around where the fighter moved in the kept part, and its
    // busiest moment marked in case it's the round's best.
    const crop = cropFromHeat(
      meter.heat(startedAt + cut.startMs, startedAt + cut.endMs)
    );
    let peakMs: number | undefined;
    let peak = -1;
    for (const s of samples) {
      if (s.t < cut.startMs || s.t > cut.endMs) continue;
      if (s.m > peak) {
        peak = s.m;
        peakMs = s.t;
      }
    }

    const url = URL.createObjectURL(new Blob(chunks, { type: type || "video/webm" }));
    this.picker.offer({
      seq,
      cut,
      calls,
      score,
      crop,
      peakMs,
      url,
      release: () => URL.revokeObjectURL(url),
    } satisfies Candidate);
  }
}
