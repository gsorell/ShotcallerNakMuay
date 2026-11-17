import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Rewrites a recorder-made video as an ordinary, indexed MP4.
 *
 * MediaRecorder writes *fragmented* MP4: an empty header, then the video in
 * one-second pieces with no index. It plays start to finish, but gallery
 * apps can't seek in it — scrubbing a saved reel did nothing (seen on the
 * Pixel, 2026-11-07). Rewriting it with the index up front ("fast start")
 * fixes that. It copies the encoded video as it is, no re-encoding, so it
 * takes a moment and costs no quality.
 *
 * mediabunny is loaded only when a reel is finished, so it stays out of the
 * app's startup bundle. If anything goes wrong the original is returned:
 * a reel that can't be scrubbed beats no reel.
 */
export const remuxToMp4 = async (
  blob: Blob
): Promise<{ blob: Blob; remuxed: boolean }> => {
  try {
    const {
      Input,
      Output,
      Conversion,
      BlobSource,
      BufferTarget,
      Mp4OutputFormat,
      MP4,
      WEBM,
    } = await import("mediabunny");
    const input = new Input({ source: new BlobSource(blob), formats: [MP4, WEBM] });
    const target = new BufferTarget();
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target,
    });
    const conversion = await Conversion.init({ input, output });
    if (!conversion.isValid) throw new Error("Nothing to convert");
    await conversion.execute();
    if (!target.buffer) throw new Error("Empty output");
    return {
      blob: new Blob([target.buffer], { type: "video/mp4" }),
      remuxed: true,
    };
  } catch (e) {
    console.warn("Reel left as recorded (could not remux):", e);
    return { blob, remuxed: false };
  }
};

/** A stretch of a recording to keep, in ms from its first frame. */
export interface KeepSpan {
  fromMs: number;
  toMs: number;
}

interface VideoRemuxPlugin {
  remuxToMp4(opts: {
    from: string;
    to: string;
    keep?: KeepSpan[];
  }): Promise<{ uri: string; summary?: string }>;
}

const VideoRemux = registerPlugin<VideoRemuxPlugin>("VideoRemux");

/**
 * The same fix for a video already on disk and too big to hold in memory:
 * the full session (see fullSession.ts). Done natively, file to file
 * (VideoRemuxPlugin.java on Android, VideoRemuxPlugin in AppDelegate.swift on
 * iOS), since the WebView can't read a large file a piece at a time. With
 * `keep`, only those stretches are written, back to back: the rests are cut.
 * If the cut fails the plugin writes the whole file instead (the summary says
 * "uncut"). On any other failure, and in the browser, null is returned and
 * the caller keeps the original.
 */
export const remuxFileToMp4 = async (
  from: string,
  to: string,
  log: (line: string) => void = () => {},
  keep?: KeepSpan[]
): Promise<string | null> => {
  const platform = Capacitor.getPlatform();
  if (platform !== "android" && platform !== "ios") return null;
  try {
    const startedAt = Date.now();
    const { uri, summary } = await VideoRemux.remuxToMp4({
      from,
      to,
      ...(keep?.length ? { keep } : {}),
    });
    log(`full session indexed in ${Date.now() - startedAt}ms: ${summary ?? "?"}`);
    return uri;
  } catch (e) {
    log(`full session left as recorded (could not remux): ${String(e)}`);
    return null;
  }
};
