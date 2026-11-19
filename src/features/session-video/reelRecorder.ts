import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";

import type { CalloutEvent } from "./calloutSignal";
import { reelBudgetMs } from "./highlights";
import {
  logAudioSession,
  openBuiltInMic,
  recordsSoundNatively,
  startNativeSound,
  stopNativeSound,
  type NativeSound,
} from "./micChoice";
import { ReelNotes } from "./reelNotes";
import { HitDetector } from "./hitDetector";
import { endCard, titleCard } from "./cards";
import { MotionMeter } from "./motion";
import { errText, pickMime, type Card } from "./reelRenderer";
import type { SessionReel } from "./reelStore";
import { exportReel, probeFraming } from "./remux";
import { FullSession, fullSessionWanted } from "./fullSession";
import { reelWanted } from "./recordPreference";
import {
  applyFraming,
  exportRanges,
  pickReel,
  probeTimes,
  reelCandidates,
  shortlist,
  type SessionTimeline,
} from "./reelPlan";

/**
 * iOS: record the full session's sound natively (RecordingAudioPlugin). In
 * TestFlight build 95 it left the callouts silent until the app was
 * restarted (they now speak on a session of their own: see the
 * text-to-speech patch), and the full session never exported with it (the
 * export now falls back to the picture alone, and says why). Off, the
 * iPhone films silent; build 96 showed that much works.
 */
const NATIVE_SOUND_ON_IOS = true;

/**
 * Whether a session ended with enough work in it for a reel: about one
 * round's worth (a completed session always has). Callouts start a moment
 * into a round, so "a round" allows for that.
 */
export const keepsReel = (workedMs: number, roundMs: number): boolean =>
  workedMs >= Math.min(roundMs * 0.85, roundMs - 5000);

/**
 * Records a session and, when it ends, cuts its highlight reel.
 *
 * While the session runs, one thing is filmed: the whole session
 * (FullSession), branded on every frame. Beside it the recorder keeps a
 * timeline: what was called and when, how much moved (MotionMeter), what
 * was heard landing (HitDetector), and when the app's own voice and sounds
 * were playing.
 *
 * Once it ends, the reel is planned from that timeline (reelPlan.ts), the
 * shortlisted clips' framing is checked on the phone (probeFraming: is the
 * fighter fully in shot?), and the picked stretches are cut out of the
 * recording and encoded once, natively (exportReel).
 *
 * It used to film every callout as a clip of its own and re-film the picks
 * onto a canvas during the rests: three encoders at once, every frame
 * compressed twice, ~17 fps sources and 2.6 Mbps reels, and on the iPhone
 * a re-filming that froze (so it had no reel at all). A reel cut by hand
 * from one recording (2026-11-19) showed what was being lost.
 *
 * Sound is recorded with the browser's voice processing off: echo
 * cancellation would strip out the app's own callouts, and noise suppression
 * and gain control flatten the crack of a pad, which is what HitDetector
 * listens for.
 */
export class ReelRecorder {
  private camera: MediaStream | null = null;
  private meter: MotionMeter | null = null;
  private hits: HitDetector | null = null;
  /** Every step, written where it can be read for tuning. */
  private notes = new ReelNotes();
  private mimeType = "";
  /**
   * When the app's own voice was speaking (performance.now()). A crack heard
   * then may be a consonant, not a strike: those don't count.
   */
  private speech: { from: number; to: number }[] = [];
  /** Techniques called this session, for the end card. */
  private callsMade = 0;
  /**
   * Time spent working (callouts coming, not paused or resting), for the end
   * card, the reel's length and whether a stopped session is worth a reel.
   */
  private workedMs = 0;
  private title: Card | null = null;
  private workingSince: number | null = null;
  /** Paused, resting or counting down: the engine's calls don't start the work clock. */
  private held = false;
  /** The whole session: what's filmed, and what the reel is cut from. */
  private full: FullSession | null = null;
  /** False once the session is known to be too short to keep anything. */
  private keepFull = true;
  private audioCheck: ReturnType<typeof setTimeout> | undefined;
  /** iOS: the native recording of the session's sound, once started. */
  private nativeSound: Promise<number | null> | null = null;
  /** iOS: the session's sound once stopped, for the full session. */
  private sessionSound: Promise<NativeSound | undefined> = Promise.resolve(undefined);
  /** Settled once the reel is done with the recording (or never needed it). */
  private reelDone!: () => void;
  private readonly reelFinished = new Promise<void>((r) => (this.reelDone = r));
  /** Calls the voice finished saying, beside callsMade: heard or not. */
  private spokenCount = 0;
  /** When the last call went out, and how long each took to say (ms). */
  private lastCalledAt: number | null = null;
  private speechMs: number[] = [];
  /** Told when filming starts or stops, for the preview's red dot. */
  onRecordingChange: (recording: boolean) => void = () => {};
  /** A reel is cut this session; without one, only the full session. */
  readonly makesReel = reelWanted() && Capacitor.isNativePlatform();

  /** `roundMs`: one round's length; with the count, the session's work. */
  constructor(
    private readonly roundCount: number,
    private readonly roundMs: number
  ) {}

  /** Opens the camera (and microphone) into `preview` and gets ready. */
  async start(preview: HTMLVideoElement): Promise<void> {
    const video = {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    };
    const native = recordsSoundNatively();
    // iOS: the sound's recording starts before the camera opens. Started
    // after, it switched the audio session under a running camera, and the
    // web view's camera stopped: a black preview, one frame for the whole
    // session (TestFlight builds 95 and 97).
    if (native && NATIVE_SOUND_ON_IOS) {
      this.nativeSound = startNativeSound((line) => this.notes.log(line));
      await this.nativeSound;
    }
    this.camera = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    const camTrack = this.camera.getVideoTracks()[0];
    const cam = camTrack?.getSettings?.();
    this.notes.log(`camera ${cam?.width}x${cam?.height}@${cam?.frameRate}`);
    // A camera that stops sending pictures shows up as a mute.
    camTrack?.addEventListener("mute", () => this.notes.log("camera muted"));
    camTrack?.addEventListener("unmute", () => this.notes.log("camera back"));
    camTrack?.addEventListener("ended", () => this.notes.log("camera ended"));
    // The phone's own microphone, never a headset's (see micChoice.ts). No
    // microphone (refused, or none): film silent. Never on iOS: there the
    // web view's microphone stops the music and silences the callouts; the
    // sound is recorded natively instead (NATIVE_SOUND_ON_IOS).
    const mic = native ? null : await openBuiltInMic();
    mic?.getAudioTracks().forEach((t) => this.camera?.addTrack(t));
    this.notes.log(
      native
        ? `mic: ${NATIVE_SOUND_ON_IOS ? "native" : "none (iPhone films silent)"}`
        : `mic ${mic?.getAudioTracks()[0]?.label ?? "none"}`
    );
    if (native) {
      const log = (line: string) => this.notes.log(line);
      // Once "Get ready" and the first calls have had time to play.
      this.audioCheck = setTimeout(() => void logAudioSession(log, "after 8s"), 8000);
    }
    // The picture only. Given the microphone too, the muted preview still
    // opened a low-latency output to "play" it, and that crackled a
    // Bluetooth speaker all session (see micChoice.ts).
    preview.srcObject = new MediaStream(this.camera.getVideoTracks());
    preview.muted = true; // never play the room back through the speaker
    preview.playsInline = true;
    await preview.play().catch(() => undefined);
    if (!preview.videoWidth) {
      await new Promise<void>((resolve) => {
        preview.addEventListener("loadedmetadata", () => resolve(), { once: true });
        setTimeout(resolve, 3000);
      });
    }
    const withAudio = this.camera.getAudioTracks().length > 0;
    this.mimeType = pickMime(withAudio);
    this.notes.log(`mime "${this.mimeType}", preview ${preview.videoWidth}x${preview.videoHeight}`);
    if (this.makesReel) {
      this.meter = new MotionMeter(preview);
      this.meter.start();
    }
    if (withAudio && this.makesReel) {
      this.hits = new HitDetector();
      if (!(await this.hits.start(this.camera))) this.hits = null;
      this.notes.log(`hit detector ${this.hits ? "on" : "off"}`);
    }
    this.title = titleCard(this.roundCount, this.roundMs);
    const toGallery = fullSessionWanted();
    if (this.makesReel || toGallery) {
      this.full = new FullSession(
        (line) => this.notes.log(line),
        this.roundCount,
        toGallery,
        this.makesReel
      );
      this.full.start(
        preview,
        this.camera.getAudioTracks(),
        this.mimeType,
        this.held,
        this.title,
        this.nativeSound !== null
      );
    }
    if (!this.makesReel) this.notes.log("no reel on this platform: full session only");
  }

  /** The callout engine's timing and calls. */
  event(e: CalloutEvent): void {
    const now = performance.now();
    if (e.type === "called") {
      // Every call, between-calls and calls while held included: the same
      // count as the completion screen's "shots called" (shotsCalledOutRef
      // in useCalloutEngine), or the two disagree (2026-11-16).
      this.callsMade += 1;
      this.lastCalledAt = now;
      this.full?.mark({ type: "called", text: e.call.text, between: e.call.between });
    } else if (e.type === "spoken") {
      this.spokenCount += 1;
      if (this.lastCalledAt !== null) this.speechMs.push(now - this.lastCalledAt);
      this.lastCalledAt = null;
      this.full?.mark({ type: "spoken" });
    } else if (e.type === "sound") {
      this.full?.mark({ type: "sound", durationMs: e.durationMs });
    }
    // The engine often schedules its next call just as a round ends; that
    // mustn't restart the work clock (a 4 × 3 session's end card once said
    // 14 minutes).
    if (!this.held && (e.type === "scheduled" || e.type === "called") && this.workingSince === null) {
      this.workingSince = now;
      if (this.full) this.onRecordingChange(true);
    }
    if (e.type === "sound") {
      // A bell rings on: its tail is as loud as its strike.
      this.speech.push({ from: now, to: now + e.durationMs + 150 });
    } else if (e.type === "called") {
      // Open-ended until the voice says it's done (or a backstop).
      this.speech.push({ from: now, to: now + 6000 });
      if (this.speech.length > 5000) this.speech = this.speech.slice(-4000);
    } else if (e.type === "spoken") {
      const last = this.speech[this.speech.length - 1];
      // A beat after the last word: the voice's own tail.
      if (last && last.to > now) last.to = now + 150;
    }
  }

  /** Paused, resting or counting down. */
  hold(): void {
    this.full?.hold();
    this.held = true;
    this.stopWorkClock();
  }

  /** Working again. */
  resume(): void {
    this.held = false;
    this.full?.resume();
  }

  /** A round ended. */
  roundOver(): void {
    this.full?.roundOver();
    void logAudioSession((line) => this.notes.log(line), "round over");
    this.held = true;
    this.stopWorkClock();
  }

  /** Stops everything and hands back the reel, or null if none was made. */
  async finish(): Promise<SessionReel | null> {
    try {
      return await this.finishReel();
    } finally {
      this.reelDone();
    }
  }

  /**
   * Why the last finish() came back empty when a reel was due, with the
   * session's trace; null when there was nothing to report (a reel came
   * out, or the session was too short for one).
   */
  failure: { reason: string; trace: string } | null = null;

  /** The session's trace so far (see ReelNotes.log). */
  trace(): string {
    return this.notes.trace();
  }

  /** Lets go of everything without keeping anything. */
  release(): void {
    this.stopCapture();
    this.reelDone();
  }

  private async finishReel(): Promise<SessionReel | null> {
    this.stopWorkClock();
    this.notes.log(`finish: worked ${Math.round(this.workedMs / 1000)}s of ${Math.round(this.roundMs / 1000)}s rounds`);
    // A voice that has gone silent "finishes" each call at once: speech
    // that took a few ms was never heard.
    const said = [...this.speechMs].sort((a, b) => a - b).map(Math.round);
    this.notes.log(
      `calls ${this.callsMade}, spoken ${this.spokenCount}` +
        (said.length ? `, speech took ${said[0]}-${said[said.length - 1]}ms (median ${said[Math.floor(said.length / 2)]})` : "")
    );
    // Stopped before a round's worth of work: no reel. A minute of warming
    // up isn't a session, and its reel would land in the gallery anyway.
    if (!keepsReel(this.workedMs, this.roundMs)) {
      this.keepFull = false;
      void this.notes.save();
      this.release();
      // On purpose, not a failure: nothing to apologise for.
      this.failure = null;
      return null;
    }
    const full = this.full;
    // The recording closes on the end card, burned into it.
    await full?.end(endCard(this.callsMade, this.workedMs));
    const timeline = full ? this.timeline(full) : null;
    // Nothing more is filmed: the camera goes, the recording is finished.
    this.stopCapture();
    if (!this.makesReel) {
      // On purpose: the full session is the video.
      void this.notes.save();
      this.failure = null;
      return null;
    }
    if (!full || !timeline) {
      this.fail("nothing was filmed");
      return null;
    }
    const source = await full.reelSource;
    if (!source) {
      this.fail("the recording could not be read back");
      return null;
    }
    return this.cutReel(source, timeline);
  }

  /** Plans the reel from the timeline and cuts it out of `source`. */
  private async cutReel(source: string, tl: SessionTimeline): Promise<SessionReel | null> {
    const log = (line: string) => this.notes.log(line);
    const cardsMs = (tl.title ? tl.title.toMs - tl.title.fromMs : 0) +
      (tl.endCard ? tl.endCard.toMs - tl.endCard.fromMs : 0);
    const budget = Math.max(6000, reelBudgetMs(this.workedMs) - cardsMs);
    const cands = reelCandidates(tl);
    const short = shortlist(cands, budget);
    log(`${tl.calls.length} calls, ${cands.length} clips with action, ${short.length} shortlisted, budget ${Math.round(budget / 1000)}s`);
    const frames = await probeFraming(source, short.flatMap(probeTimes), log);
    const judged = frames ? applyFraming(short, frames) : short;
    if (frames) log(`${judged.length} of ${short.length} shortlisted fully in shot`);
    const picks = pickReel(judged, budget);
    picks.forEach((c) =>
      log(`pick r${c.round + 1} #${c.seq} ${c.family} ${c.score.toFixed(2)} ${c.fromMs}-${c.toMs}ms ${c.calls.map((x) => x.text).join(" + ")}`)
    );
    if (!picks.length) {
      this.fail(cands.length ? "no clip had the whole of you in shot" : "no clips with action in them");
      return null;
    }
    const { uri: out } = await Filesystem.getUri({
      path: `shotcaller-reel-${Date.now()}.mp4`,
      directory: Directory.Cache,
    });
    const made = await exportReel(source, exportRanges(tl, picks), out, log);
    if (!made) {
      this.fail("the reel could not be exported");
      return null;
    }
    try {
      const blob = await (await fetch(Capacitor.convertFileSrc(made.uri))).blob();
      if (!blob.size) throw new Error("empty reel");
      const reel = new Blob([blob], { type: "video/mp4" });
      log(`reel ${reel.size} bytes, ${picks.length} clips`);
      void this.notes.save();
      return {
        blob: reel,
        url: URL.createObjectURL(reel),
        ext: "mp4",
        durationMs:
          made.durationMs ??
          exportRanges(tl, picks).reduce((n, s) => n + s.toMs - s.fromMs, 0),
        clips: picks.length,
      };
    } catch (e) {
      this.fail(`the reel could not be read back: ${errText(e)}`);
      return null;
    } finally {
      await Filesystem.deleteFile({ path: made.uri }).catch(() => undefined);
    }
  }

  /** The session as the planner needs it, in ms from the recording's first frame. */
  private timeline(full: FullSession): SessionTimeline {
    const base = full.startedAt;
    const { marks, spans, title, endCard: card } = full.timeline();
    const cardFrom = card?.fromMs ?? Infinity;
    return {
      calls: marks.flatMap((m) =>
        m.type === "called"
          ? [{ t: m.t, text: m.text, between: m.between, combo: m.text.includes(",") }]
          : []
      ),
      speech: this.speech.map((s) => ({ from: s.from - base, to: s.to - base })),
      hits: (this.hits?.between(0, Infinity) ?? []).map((t) => t - base),
      motion: (this.meter?.between(0, Infinity) ?? []).map((s) => ({
        at: s.at - base,
        m: s.m,
        disturbed: s.disturbed,
      })),
      // The work, without the end card that may run on from the last round.
      work: spans
        .map((s) => ({ fromMs: s.fromMs, toMs: Math.min(s.toMs, cardFrom) }))
        .filter((s) => s.toMs > s.fromMs),
      roundEnds: marks.filter((m) => m.type === "roundOver").map((m) => m.t),
      ...(title ? { title } : {}),
      ...(card ? { endCard: card } : {}),
    };
  }

  private fail(reason: string): void {
    this.notes.log(`no reel: ${reason}`);
    void this.notes.save();
    this.failure = { reason, trace: this.notes.trace() };
  }

  private stopWorkClock(): void {
    if (this.workingSince === null) return;
    if (this.full) this.onRecordingChange(false);
    this.workedMs += performance.now() - this.workingSince;
    this.workingSince = null;
  }

  private stopCapture(): void {
    // iOS: the sound stops with the picture, and goes under the recording.
    if (this.nativeSound) {
      const log = (line: string) => this.notes.log(line);
      const started = this.nativeSound;
      this.nativeSound = null;
      this.sessionSound = started.then(async (at) => {
        const uri = await stopNativeSound(log);
        return uri && at !== null ? { uri, startedAtMs: at } : undefined;
      });
    }
    // Before the camera's tracks end, or the recording loses its tail. Its
    // cut and gallery save wait for the reel, which is cut from it.
    const fullDone =
      this.full?.stop(
        this.hits?.between(0, Infinity) ?? [],
        this.keepFull,
        this.sessionSound,
        this.reelFinished
      ) ?? Promise.resolve();
    this.full = null;
    const sound = this.sessionSound;
    void Promise.all([fullDone, sound]).then(([, s]) =>
      s ? Filesystem.deleteFile({ path: s.uri }).catch(() => undefined) : undefined
    );
    this.meter?.stop();
    this.meter = null;
    this.hits?.stop();
    this.hits = null;
    this.camera?.getTracks().forEach((t) => t.stop());
    this.camera = null;
    if (this.audioCheck) {
      clearTimeout(this.audioCheck);
      this.audioCheck = undefined;
      void logAudioSession((line) => this.notes.log(line), "at the end");
    }
  }
}
