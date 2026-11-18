import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";

import type { NativeSound } from "./micChoice";
import { getKeepFullSession, reelWanted } from "./recordPreference";
import { writeBlobInPieces } from "./reelFile";
import { drawCard, drawTitleOverlay, type Card } from "./reelRenderer";
import { patchFullSession, setFullSession } from "./reelStore";
import { remuxFileToMp4, type KeepSpan } from "./remux";
import { saveFileToGallery } from "./saveToGallery";
import { cardAssetsReady, drawWatermark, loadWatermark } from "./watermark";

/**
 * The whole session saved to the gallery beside the reel, as `..._full`
 * ("Also keep the full session", on unless turned off in Session Settings).
 * It's for watching yourself back, but a stretch of it gets clipped and
 * sent on, or fed to someone's own tools, so it's branded on every frame:
 * the camera is drawn onto a canvas with the reel's banner along the
 * bottom and the round in the corner, and the canvas is what's recorded.
 * It opens on the reel's title over the first round and closes on its
 * end card.
 *
 * The rests, pauses and the countdown aren't in the saved file. They are
 * filmed and then cut out when the file is rewritten (remuxFileToMp4, with
 * the spans worked through: KeepSpans). The recorder can't simply be
 * paused for them: on the Pixel, MediaRecorder's MP4 writer garbles the file
 * after a pause()/resume() (audio frames written into the video track, the
 * length tripled, no usable picture; 2026-11-16), and the gallery then
 * hides it. Cuts start on a keyframe (one every 2 s), so a round can open on
 * up to 2 s of the rest before it.
 *
 * The file is appended to in the app cache as the recorder hands over each
 * chunk (a session runs to hundreds of MB, too much to hold in memory),
 * saved to the gallery when the session ends, then deleted from the cache.
 * A session too short to keep a reel keeps no full video either.
 *
 * DEBUG: with this flag set in the app's localStorage (by hand, over the
 * WebView devtools), it is filmed even with the setting off, and beside it
 * `files/raw-session.json` holds what was called and when, the app's own
 * sounds, the hits heard and the spans kept, in ms from the first frame;
 * the file as recorded, before the cut, is left in the cache:
 *   localStorage.setItem("shotcaller_debug_raw_session", "1")
 *   adb shell run-as com.shotcallernakmuay.app cat files/raw-session.json
 */
export const RAW_FLAG = "shotcaller_debug_raw_session";

const debugFlag = (): boolean => {
  try {
    return localStorage.getItem(RAW_FLAG) === "1";
  } catch {
    return false;
  }
};

/** Whether this session is filmed in full as well as cut into a reel. */
/** Without a reel, the full session is the video: always kept. */
export const fullSessionWanted = (): boolean =>
  Capacitor.isNativePlatform() && (!reelWanted() || getKeepFullSession() || debugFlag());

export type RawMark =
  | { t: number; type: "called"; text: string; between: boolean }
  | { t: number; type: "spoken" | "hold" | "roundOver" }
  | { t: number; type: "sound"; durationMs: number };

/**
 * The stretches of the session to keep, in ms from the first frame: from
 * each time work starts (a round, or a pause ending) to when it stops.
 */
export class KeepSpans {
  private readonly spans: KeepSpan[] = [];
  private openAt: number | null = null;

  /** Work (or the end card) starts at `t`. No-op if already open. */
  open(t: number): void {
    if (this.openAt === null) this.openAt = t;
  }

  /** It stops at `t`. No-op if nothing is open. */
  close(t: number): void {
    const from = this.openAt;
    if (from === null) return;
    this.openAt = null;
    if (t - from < 250) return; // a blip, not work
    const last = this.spans[this.spans.length - 1];
    // Back to back (the end card straight after the last round): one span.
    if (last && from - last.toMs < 250) last.toMs = t;
    else this.spans.push({ fromMs: Math.max(0, Math.round(from)), toMs: Math.round(t) });
  }

  get isOpen(): boolean {
    return this.openAt !== null;
  }

  /** Everything kept, with anything still open closed at `t`. */
  all(t: number): KeepSpan[] {
    this.close(t);
    return this.spans.map((s) => ({ ...s }));
  }
}

/** "ROUND 2 / 5": the round being worked, or the one coming after a rest. */
export const roundTag = (roundsOver: number, roundCount: number): string =>
  `ROUND ${Math.min(roundsOver + 1, Math.max(1, roundCount))} / ${roundCount}`;

export class FullSession {
  private rec: MediaRecorder | null = null;
  private readonly canvas = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D | null = null;
  private source: HTMLVideoElement | null = null;
  private drawing = false;
  private writes: Promise<void> = Promise.resolve();
  private readonly path = `shotcaller-raw-${Date.now()}`;
  private ext = "mp4";
  private bytes = 0;
  private chunks = 0;
  private wrote = false;
  private broken = false;
  /** performance.now() of the first frame; spans and marks are relative to it. */
  private began = 0;
  private marks: RawMark[] = [];
  private readonly sidecar = debugFlag();
  private readonly spans = new KeepSpans();
  private held = true;
  private roundsOver = 0;
  /** The title over the action: up until work starts, then for its duration. */
  private title: { card: Card; until: number } | null = null;
  /** The end card, full frame, once the session is over. */
  private card: Card | null = null;
  /**
   * The banner and the round tag, drawn once onto a clear layer and laid
   * over each frame: drawn fresh, the banner's soft shadow alone is a blur
   * of a third of the frame 30 times a second for the whole session.
   */
  private readonly layer = document.createElement("canvas");
  /** What the layer shows, so it's redrawn only when that changes. */
  private layerKey = "";
  /** The microphone went into the recording (it was granted). */
  private withMic = false;
  /** Date.now() of the first frame, against the native sound's start. */
  private beganEpoch = 0;
  private micTracks: MediaStreamTrack[] = [];

  constructor(
    private readonly log: (line: string) => void,
    private readonly roundCount: number
  ) {}

  /**
   * Starts filming `source` (the live preview, playing the camera) with
   * `audio` (the microphone's tracks). `held`: the session opens on a
   * countdown or a pause, not on work.
   */
  start(
    source: HTMLVideoElement,
    audio: MediaStreamTrack[],
    mimeType: string,
    held: boolean,
    title: Card,
    /**
     * iOS: the session's sound is being recorded natively (ReelRecorder
     * starts and stops it, and hands it over at stop()).
     */
    nativeSound = false
  ): void {
    try {
      const ctx = this.canvas.getContext("2d");
      if (!ctx) throw new Error("No 2D canvas");
      if (typeof this.canvas.captureStream !== "function") {
        throw new Error("canvas.captureStream unsupported");
      }
      this.ctx = ctx;
      this.source = source;
      // The camera's own shape and size, set once: the recorder takes the
      // canvas's size at the start.
      this.canvas.width = source.videoWidth || 1280;
      this.canvas.height = source.videoHeight || 720;
      this.title = { card: title, until: Infinity };
      this.held = held;
      void cardAssetsReady();
      this.paint();
      this.drawing = true;
      this.loop();

      const stream = this.canvas.captureStream(30);
      audio.forEach((t) => stream.addTrack(t));
      this.withMic = audio.length > 0;
      this.micTracks = audio;
      // The sound stopping mid-session (iOS hands the microphone to a call,
      // or the audio session is changed under it) shows up as a mute.
      audio.forEach((t) => {
        t.addEventListener("mute", () => this.log(`full session mic muted at ${Math.round(this.now() / 1000)}s`));
        t.addEventListener("unmute", () => this.log(`full session mic back at ${Math.round(this.now() / 1000)}s`));
        t.addEventListener("ended", () => this.log(`full session mic ended at ${Math.round(this.now() / 1000)}s`));
      });
      // The MP4 writer only hands over finished fragments, and a fragment
      // ends at a keyframe. Left to itself the Pixel's encoder sent none
      // after the first, so the whole session arrived as one chunk at the
      // end (and crashed the app on its way to disk). Ask for one every 2 s;
      // it is also how close to a round's start a cut can land.
      const rec = new MediaRecorder(stream, {
        videoBitsPerSecond: 2_500_000,
        ...(audio.length ? { audioBitsPerSecond: 128_000 } : {}),
        videoKeyFrameIntervalDuration: 2000,
        ...(mimeType ? { mimeType } : {}),
      } as MediaRecorderOptions);
      this.ext = rec.mimeType.includes("webm") ? "webm" : "mp4";
      rec.onstart = () => {
        this.began = performance.now();
        this.beganEpoch = Date.now();
      };
      rec.ondataavailable = (e) => {
        if (!e.data?.size) return;
        const chunk = e.data;
        this.writes = this.writes.then(() => this.append(chunk));
      };
      rec.onerror = (e) =>
        this.log(`full recorder error: ${String((e as unknown as { error?: unknown }).error ?? e)}`);
      // Handed over every 10 s, so at most that much sits in memory.
      rec.start(10_000);
      this.began = performance.now();
      this.beganEpoch = Date.now();
      this.rec = rec;
      if (nativeSound) this.withMic = true;
      if (!held) this.work();
      this.log(
        `full session on, ${rec.mimeType}, ${this.canvas.width}x${this.canvas.height}, ` +
          `mic ${audio.map((t) => `${t.readyState}${t.muted ? " muted" : ""}`).join(",") || "none"}, ` +
          `${"requestVideoFrameCallback" in source ? "per frame" : "per animation frame"}`
      );
    } catch (e) {
      this.drawing = false;
      this.log(`full session could not start: ${String(e)}`);
    }
  }

  /** Paused, resting or counting down: cut from here. */
  hold(): void {
    this.mark({ type: "hold" });
    this.held = true;
    this.spans.close(this.now());
  }

  /** Working again: kept from here. */
  resume(): void {
    if (!this.held) return;
    this.held = false;
    this.work();
  }

  /** A round ended: cut from here, and the tag moves on to the next. */
  roundOver(): void {
    this.mark({ type: "roundOver" });
    this.held = true;
    this.spans.close(this.now());
    this.roundsOver += 1;
  }

  /**
   * Closes on `card`: shown full frame for its duration and kept, then the
   * caller stops the recording.
   */
  async end(card: Card): Promise<void> {
    if (!this.rec) return;
    await cardAssetsReady();
    this.card = card;
    this.spans.close(this.now());
    this.spans.open(this.now());
    await new Promise((r) => setTimeout(r, card.durationMs));
    this.spans.close(this.now());
  }

  /** Something the reel recorder saw, stamped against the video (debug). */
  mark(m: RawMark extends infer M ? (M extends RawMark ? Omit<M, "t"> : never) : never): void {
    if (!this.rec || !this.sidecar) return;
    this.marks.push({ ...m, t: Math.round(this.now()) } as RawMark);
  }

  /**
   * Stops filming. Call before the camera's tracks stop. The cut and the
   * save to the gallery run on in the background, or with `keep` false the
   * file is thrown away; `hitTimes` (performance.now()) go to the debug
   * sidecar.
   */
  stop(
    hitTimes: number[],
    keep: boolean,
    /** iOS: the session's sound, recorded natively; laid under the picture. */
    nativeSound: Promise<NativeSound | undefined> = Promise.resolve(undefined),
    /**
     * Held until this settles (the reel's done): cut, exported and saved
     * while the last round's clips were assembled, the reel froze (build 100).
     */
    after: Promise<void> = Promise.resolve()
  ): Promise<void> {
    const rec = this.rec;
    if (!rec) return Promise.resolve();
    this.rec = null;
    const spans = this.spans.all(this.now());
    this.log(
      `full session stopping, mic ${
        this.micTracks.map((t) => `${t.readyState}${t.muted ? " muted" : ""}`).join(",") || "none"
      }`
    );
    const stopped = new Promise<void>((resolve) => {
      rec.addEventListener("stop", () => resolve(), { once: true });
      setTimeout(resolve, 5000);
    });
    try {
      if (rec.state !== "inactive") rec.stop();
    } catch {
      /* already stopped */
    }
    const hits = hitTimes.map((t) => Math.round(t - this.began)).filter((t) => t >= 0);
    // The native sound, stopped with the picture; where it starts against
    // the first frame, for the remux to lay it under.
    const sound = nativeSound.then((s) =>
      s ? { uri: s.uri, offsetMs: s.startedAtMs - this.beganEpoch } : undefined
    );
    // Said on the completion screen from the moment the session ends, so
    // nobody finds it in the gallery days later by surprise.
    if (keep) {
      setFullSession({
        id: this.path,
        status: "saving",
        durationMs: spans.reduce((n, s) => n + s.toMs - s.fromMs, 0),
      });
    }
    return stopped
      .then(() => {
        this.drawing = false;
        return this.writes;
      })
      .then(() => sound)
      .then(async (audio) => {
        await after;
        if (keep) await this.finish(hits, spans, audio);
        else await this.discard();
      })
      .catch((e) => this.log(`full session could not be finished: ${String(e)}`));
  }

  private now(): number {
    return performance.now() - this.began;
  }

  private work(): void {
    this.spans.open(this.now());
    const t = this.title;
    if (t && t.until === Infinity) t.until = performance.now() + t.card.durationMs;
  }

  /** Draws on every camera frame where the browser says when one lands. */
  private loop(): void {
    const v = this.source as
      | (HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number })
      | null;
    if (!v) return;
    const next = () => {
      if (!this.drawing) return;
      this.paint();
      if (this.card || typeof v.requestVideoFrameCallback !== "function") {
        // The end card has no camera frame to wait for.
        requestAnimationFrame(next);
      } else {
        v.requestVideoFrameCallback(next);
      }
    };
    if (typeof v.requestVideoFrameCallback === "function") v.requestVideoFrameCallback(next);
    else requestAnimationFrame(next);
  }

  private paint(): void {
    const { ctx, canvas, source: v } = this;
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    if (this.card) {
      drawCard(ctx, w, h, this.card);
      return;
    }
    if (!v || v.readyState < 2 || !v.videoWidth) return;
    // The true view, as the reel has it: only the live preview is mirrored.
    // Covering the frame if the camera's shape ever changes mid-session.
    const scale = Math.max(w / v.videoWidth, h / v.videoHeight);
    const sw = w / scale;
    const sh = h / scale;
    ctx.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, w, h);
    const t = this.title;
    if (t && performance.now() < t.until) {
      // As on the reel, the title stands in for the banner while it's up.
      drawTitleOverlay(ctx, w, h, t.card);
      return;
    }
    this.title = null;
    ctx.drawImage(this.overlayLayer(w, h), 0, 0);
  }

  /** The banner and round tag for now, redrawn when either changes. */
  private overlayLayer(w: number, h: number): HTMLCanvasElement {
    const tag = roundTag(this.roundsOver, this.roundCount);
    // Until the logo has loaded the banner is drawn as text; redrawn once
    // it has.
    const key = `${tag}|${w}x${h}|${watermarkLoaded() ? "logo" : "text"}|${fontLoaded() ? "font" : "system"}`;
    if (key !== this.layerKey) {
      const layer = this.layer;
      layer.width = w;
      layer.height = h;
      const lctx = layer.getContext("2d");
      if (lctx) {
        lctx.clearRect(0, 0, w, h);
        drawRoundTag(lctx, w, h, tag);
        drawWatermark(lctx, w, h);
      }
      this.layerKey = key;
    }
    return this.layer;
  }

  /** Adds a chunk to the file (in pieces: see writeBlobInPieces). */
  private async append(chunk: Blob): Promise<void> {
    if (this.broken) return;
    try {
      await writeBlobInPieces(`${this.path}.${this.ext}`, Directory.Cache, chunk, this.wrote);
      this.wrote = true;
      this.bytes += chunk.size;
      this.chunks += 1;
    } catch (e) {
      this.broken = true;
      this.log(`full session write failed after ${this.bytes} bytes: ${String(e)}`);
    }
  }

  private async discard(): Promise<void> {
    if (!this.wrote) return;
    this.log("full session not kept: too short");
    await Filesystem.deleteFile({
      path: `${this.path}.${this.ext}`,
      directory: Directory.Cache,
    }).catch(() => undefined);
  }

  private async finish(
    hits: number[],
    spans: KeepSpan[],
    audio?: { uri: string; offsetMs: number }
  ): Promise<void> {
    if (this.sidecar) try {
      await Filesystem.writeFile({
        path: "raw-session.json",
        directory: Directory.Data,
        encoding: Encoding.UTF8,
        data: JSON.stringify({
          savedAt: new Date().toISOString(),
          bytes: this.bytes,
          broken: this.broken,
          marks: this.marks,
          hits,
          spans,
        }),
      });
    } catch {
      /* the video matters more */
    }
    const keptS = Math.round(spans.reduce((n, s) => n + s.toMs - s.fromMs, 0) / 1000);
    this.log(
      `full session recorded: ${this.chunks} chunks, ${this.bytes} bytes, ` +
        `${spans.length} spans (${keptS}s) to keep${this.broken ? ", write failed" : ""}`
    );
    if (!this.wrote) {
      patchFullSession(this.path, "failed");
      return;
    }
    const file = { path: `${this.path}.${this.ext}`, directory: Directory.Cache };
    const indexed = { path: `${this.path}_indexed.mp4`, directory: Directory.Cache };
    try {
      const { uri } = await Filesystem.getUri(file);
      // As recorded it can't be scrubbed and still has the rests in it.
      const { uri: to } = await Filesystem.getUri(indexed);
      if (audio) this.log(`native sound starts ${Math.round(audio.offsetMs)}ms after the first frame`);
      const remuxed = await remuxFileToMp4(uri, to, this.log, spans, audio);
      await saveFileToGallery(remuxed?.uri ?? uri, "_full");
      // Said, not hidden: a session filmed with the microphone that saved
      // without sound is a fault to hear about.
      const silent = this.withMic && remuxed?.audio === false;
      if (silent) this.log("full session saved WITHOUT sound");
      patchFullSession(this.path, "saved", silent);
    } catch (e) {
      this.log(`full session gallery save failed: ${String(e)}`);
      patchFullSession(this.path, "failed");
    } finally {
      // DEBUG: the recording as it came, kept for a look over adb.
      if (!this.sidecar) await Filesystem.deleteFile(file).catch(() => undefined);
      await Filesystem.deleteFile(indexed).catch(() => undefined);
    }
  }
}

const watermarkLoaded = (): boolean => {
  const img = loadWatermark();
  return !!img && img.complete && img.naturalWidth > 0;
};

const fontLoaded = (): boolean => {
  try {
    return document.fonts?.check("900 40px Poppins") ?? true;
  } catch {
    return true;
  }
};

/** The round, small, in the top left corner: where a clip came from. */
const drawRoundTag = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  text: string
): void => {
  const unit = Math.min(w, h);
  const fs = Math.round(unit * 0.045);
  const margin = Math.round(unit * 0.04);
  ctx.save();
  ctx.font = `900 ${fs}px Poppins, system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const tw = ctx.measureText(text).width;
  const padX = fs * 0.55;
  const padY = fs * 0.35;
  ctx.fillStyle = "rgba(12,7,16,0.62)";
  const bw = tw + padX * 2;
  const bh = fs + padY * 2;
  const r = bh / 2;
  ctx.beginPath();
  ctx.moveTo(margin + r, margin);
  ctx.arcTo(margin + bw, margin, margin + bw, margin + bh, r);
  ctx.arcTo(margin + bw, margin + bh, margin, margin + bh, r);
  ctx.arcTo(margin, margin + bh, margin, margin, r);
  ctx.arcTo(margin, margin, margin + bw, margin, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f4eef6";
  ctx.fillText(text, margin + padX, margin + padY);
  ctx.restore();
};
