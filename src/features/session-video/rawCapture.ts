import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";

import { writeBlobInPieces } from "./reelFile";
import { saveFileToGallery } from "./saveToGallery";

/**
 * DEBUG ONLY: films the whole session, uncut, next to the reel.
 *
 * This is for comparing reel styles cut from the same real footage, not a
 * feature. It is off unless this flag is set in the app's localStorage,
 * which only happens by hand over the WebView devtools:
 *   localStorage.setItem("shotcaller_debug_raw_session", "1")
 *
 * The file is appended to in the app cache as the recorder hands over each
 * chunk (a session runs to hundreds of MB, too much to hold in memory),
 * saved to the gallery as `…_raw` when the session ends, then deleted from
 * the cache. Beside it, `files/raw-session.json` holds what was called and
 * when, the app's own sounds and the hits heard, in ms from the first frame:
 *   adb shell run-as com.shotcallernakmuay.app cat files/raw-session.json
 */
export const RAW_FLAG = "shotcaller_debug_raw_session";

export const rawCaptureWanted = (): boolean => {
  try {
    return (
      Capacitor.isNativePlatform() && localStorage.getItem(RAW_FLAG) === "1"
    );
  } catch {
    return false;
  }
};

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
  private wrote = false;
  private broken = false;
  /** performance.now() of the first frame; marks are relative to it. */
  private began = 0;
  private marks: RawMark[] = [];

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
    this.marks.push({ ...m, t: Math.round(performance.now() - this.began) } as RawMark);
  }

  /**
   * Stops filming. Call before the camera's tracks stop. The save to the
   * gallery runs on in the background; `hitTimes` (performance.now()) are
   * written to the sidecar.
   */
  stop(hitTimes: number[]): void {
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
      .then(() => this.finish(hits));
  }

  /** Adds a chunk to the file (in pieces: see writeBlobInPieces). */
  private async append(chunk: Blob): Promise<void> {
    if (this.broken) return;
    try {
      await writeBlobInPieces(`${this.path}.${this.ext}`, Directory.Cache, chunk, this.wrote);
      this.wrote = true;
      this.bytes += chunk.size;
    } catch (e) {
      this.broken = true;
      this.log(`raw capture write failed after ${this.bytes} bytes: ${String(e)}`);
    }
  }

  private async finish(hits: number[]): Promise<void> {
    try {
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
    if (!this.wrote) return;
    const file = { path: `${this.path}.${this.ext}`, directory: Directory.Cache };
    try {
      const { uri } = await Filesystem.getUri(file);
      await saveFileToGallery(uri, "_raw");
    } catch (e) {
      this.log(`raw capture gallery save failed: ${String(e)}`);
    } finally {
      await Filesystem.deleteFile(file).catch(() => undefined);
    }
  }
}
