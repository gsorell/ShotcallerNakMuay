import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";

import { getKeepFullSession } from "./recordPreference";
import { writeBlobInPieces } from "./reelFile";
import { remuxFileToMp4 } from "./remux";
import { saveFileToGallery } from "./saveToGallery";

/**
 * The whole session, uncut, saved to the gallery beside the reel ("Also keep
 * the full session", on unless turned off in Session Settings).
 *
 * Filmed straight off the camera, rests and pauses included. It is never
 * paused: on the Pixel, MediaRecorder's MP4 writer garbles the file after a
 * pause()/resume() (audio frames written into the video track, the length
 * tripled, no usable picture; 2026-11-16), and the gallery then hides it.
 *
 * The file is appended to in the app cache as the recorder hands over each
 * chunk (a session runs to hundreds of MB, too much to hold in memory),
 * saved to the gallery as `..._full` when the session ends, then deleted from
 * the cache. A session too short to keep a reel keeps no full video either.
 *
 * DEBUG: with this flag set in the app's localStorage (by hand, over the
 * WebView devtools), it is filmed even with the setting off, and beside it
 * `files/raw-session.json` holds what was called and when, the app's own
 * sounds and the hits heard, in ms from the first frame:
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
export const fullSessionWanted = (): boolean =>
  Capacitor.isNativePlatform() && (getKeepFullSession() || debugFlag());

export type RawMark =
  | { t: number; type: "called"; text: string; between: boolean }
  | { t: number; type: "spoken" | "hold" | "roundOver" }
  | { t: number; type: "sound"; durationMs: number };

export class RawCapture {
  private rec: MediaRecorder | null = null;
  private writes: Promise<void> = Promise.resolve();
  private readonly path = `shotcaller-raw-${Date.now()}`;
  private ext = "mp4";
  private bytes = 0;
  private chunks = 0;
  private wrote = false;
  private broken = false;
  /** performance.now() of the first frame; marks are relative to it. */
  private began = 0;
  private marks: RawMark[] = [];
  private readonly sidecar = debugFlag();

  constructor(private readonly log: (line: string) => void) {}

  start(stream: MediaStream, mimeType: string): void {
    try {
      // The MP4 writer only hands over finished fragments, and a fragment
      // ends at a keyframe. Left to itself the Pixel's encoder sent none
      // after the first, so the whole session arrived as one chunk at the
      // end (and crashed the app on its way to disk). Ask for one every 2 s.
      const rec = new MediaRecorder(stream, {
        videoBitsPerSecond: 2_500_000,
        ...(stream.getAudioTracks().length ? { audioBitsPerSecond: 128_000 } : {}),
        videoKeyFrameIntervalDuration: 2000,
        ...(mimeType ? { mimeType } : {}),
      } as MediaRecorderOptions);
      this.ext = rec.mimeType.includes("webm") ? "webm" : "mp4";
      rec.onstart = () => {
        this.began = performance.now();
      };
      rec.ondataavailable = (e) => {
        if (!e.data?.size) return;
        const chunk = e.data;
        this.writes = this.writes.then(() => this.append(chunk));
      };
      rec.onerror = (e) =>
        this.log(`raw recorder error: ${String((e as unknown as { error?: unknown }).error ?? e)}`);
      // Handed over every 10 s, so at most that much sits in memory.
      rec.start(10_000);
      this.began = performance.now();
      this.rec = rec;
      this.log(`raw capture on, ${rec.mimeType}`);
    } catch (e) {
      this.log(`raw capture could not start: ${String(e)}`);
    }
  }

  /** Something the reel recorder saw, stamped against the raw video. */
  mark(m: RawMark extends infer M ? (M extends RawMark ? Omit<M, "t"> : never) : never): void {
    if (!this.rec) return;
    if (!this.sidecar) return;
    this.marks.push({ ...m, t: Math.round(performance.now() - this.began) } as RawMark);
  }

  /**
   * Stops filming. Call before the camera's tracks stop. The save to the
   * gallery runs on in the background, or with `keep` false the file is
   * thrown away; `hitTimes` (performance.now()) go to the debug sidecar.
   */
  stop(hitTimes: number[], keep: boolean): void {
    const rec = this.rec;
    if (!rec) return;
    this.rec = null;
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
    void stopped
      .then(() => this.writes)
      .then(() => (keep ? this.finish(hits) : this.discard()));
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
      this.log(`raw capture write failed after ${this.bytes} bytes: ${String(e)}`);
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

  private async finish(hits: number[]): Promise<void> {
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
        }),
      });
    } catch {
      /* the video matters more */
    }
    this.log(`full session recorded: ${this.chunks} chunks, ${this.bytes} bytes${this.broken ? ", write failed" : ""}`);
    if (!this.wrote) return;
    const file = { path: `${this.path}.${this.ext}`, directory: Directory.Cache };
    const indexed = { path: `${this.path}_indexed.mp4`, directory: Directory.Cache };
    try {
      const { uri } = await Filesystem.getUri(file);
      // As recorded it plays but can't be scrubbed; see remuxFileToMp4.
      const { uri: to } = await Filesystem.getUri(indexed);
      const saved = (await remuxFileToMp4(uri, to, this.log)) ?? uri;
      await saveFileToGallery(saved, "_full");
    } catch (e) {
      this.log(`full session gallery save failed: ${String(e)}`);
    } finally {
      // DEBUG: the recording as it came, kept for a look over adb.
      if (!this.sidecar) await Filesystem.deleteFile(file).catch(() => undefined);
      await Filesystem.deleteFile(indexed).catch(() => undefined);
    }
  }
}
