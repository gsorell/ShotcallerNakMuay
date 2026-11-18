import { Capacitor, registerPlugin } from "@capacitor/core";

import { closedTime, findHoles, type Hole } from "./reelHoles";

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
  blob: Blob,
  log: (line: string) => void = () => {}
): Promise<{ blob: Blob; remuxed: boolean; holes: Hole[] }> => {
  try {
    const closed = await remuxClosingHoles(blob);
    if (closed) {
      if (closed.holes.length) {
        const cut = closed.holes.reduce((n, h) => n + h.cutS, 0);
        log(
          `reel holes closed: ${closed.holes.length} (${closed.holes
            .map((h) => `${h.cutS.toFixed(2)}s at ${h.atS.toFixed(2)}s`)
            .join(", ")}), ${Math.round(cut * 1000)}ms cut`
        );
      }
      return { blob: closed.blob, remuxed: true, holes: closed.holes };
    }
  } catch (e) {
    log(`reel holes left open: ${String(e)}`);
  }
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
      holes: [],
    };
  } catch (e) {
    console.warn("Reel left as recorded (could not remux):", e);
    return { blob, remuxed: false, holes: [] };
  }
};

/**
 * The same rewrite, packet by packet, with the reel's holes closed (see
 * reelHoles.ts). Only for a reel that is picture alone, as an iPhone's is
 * (its sound is laid under it afterwards): with a sound track of its own the
 * sound would have to be cut too. Null when it doesn't apply.
 */
const remuxClosingHoles = async (
  blob: Blob
): Promise<{ blob: Blob; holes: Hole[] } | null> => {
  const {
    Input,
    Output,
    BlobSource,
    BufferTarget,
    Mp4OutputFormat,
    EncodedPacketSink,
    EncodedVideoPacketSource,
    MP4,
    WEBM,
  } = await import("mediabunny");
  const input = new Input({ source: new BlobSource(blob), formats: [MP4, WEBM] });
  const tracks = await input.getTracks();
  const video = await input.getPrimaryVideoTrack();
  if (!video || tracks.length !== 1 || !video.codec) return null;
  const config = await video.getDecoderConfig();
  if (!config) return null;
  const packets = [];
  for await (const p of new EncodedPacketSink(video).packets()) packets.push(p);
  if (!packets.length) return null;
  const { holes, stepS } = findHoles(packets.map((p) => p.timestamp));
  const source = new EncodedVideoPacketSource(video.codec);
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target,
  });
  output.addVideoTrack(source, { rotation: await video.getRotation() });
  await output.start();
  let first = true;
  for (const p of packets) {
    const timestamp = closedTime(p.timestamp, holes);
    // The frame before a hole now runs one step, not the length of the hole.
    const before = holes.some((h) => Math.abs(h.atS - stepS - p.timestamp) < 1e-6);
    const packet = p.clone({ timestamp, ...(before ? { duration: stepS } : {}) });
    await source.add(packet, first ? { decoderConfig: config } : undefined);
    first = false;
  }
  await output.finalize();
  if (!target.buffer) throw new Error("Empty output");
  return { blob: new Blob([target.buffer], { type: "video/mp4" }), holes };
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
    /** iOS: sound recorded natively, starting offsetMs after the first frame. */
    audio?: { uri: string; offsetMs: number };
  }): Promise<{ uri: string; summary?: string; audio?: boolean }>;
  laySound(opts: {
    from: string;
    to: string;
    sound: string;
    parts: { durMs: number; soundFromMs?: number }[];
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
 * the caller keeps the original. `audio`: whether the written file has any
 * sound in it, where the plugin says.
 */
export const remuxFileToMp4 = async (
  from: string,
  to: string,
  log: (line: string) => void = () => {},
  keep?: KeepSpan[],
  sound?: { uri: string; offsetMs: number }
): Promise<{ uri: string; audio?: boolean } | null> => {
  const platform = Capacitor.getPlatform();
  if (platform !== "android" && platform !== "ios") return null;
  try {
    const startedAt = Date.now();
    const { uri, summary, audio } = await VideoRemux.remuxToMp4({
      from,
      to,
      ...(keep?.length ? { keep } : {}),
      ...(sound ? { audio: sound } : {}),
    });
    log(`full session indexed in ${Date.now() - startedAt}ms: ${summary ?? "?"}`);
    return { uri, ...(typeof audio === "boolean" ? { audio } : {}) };
  } catch (e) {
    log(`full session left as recorded (could not remux): ${String(e)}`);
    return null;
  }
};

/**
 * iOS: lays the session's sound, recorded natively, under a finished reel.
 * The reel's clips were filmed silent (the web view never opens the
 * microphone on an iPhone: see micChoice.ts), but each stretch of the reel
 * knows when in the session it was filmed; `parts` says, in order, how long
 * each runs and where in the sound file it starts (none: a card, silent).
 * The result is an indexed MP4, read back as a Blob; null, and the silent
 * reel stands, on any failure or off iOS.
 */
export const laySoundUnderReel = async (
  reel: Blob,
  soundUri: string,
  parts: { durMs: number; soundFromMs?: number }[],
  log: (line: string) => void = () => {}
): Promise<Blob | null> => {
  if (Capacitor.getPlatform() !== "ios") return null;
  const { Directory, Filesystem } = await import("@capacitor/filesystem");
  const { writeBlobInPieces } = await import("./reelFile");
  const name = `reel-silent-${Date.now()}`;
  const from = `${name}.mp4`;
  const to = `${name}-sound.mp4`;
  try {
    const fromUri = await writeBlobInPieces(from, Directory.Cache, reel);
    const toUri = (await Filesystem.getUri({ path: to, directory: Directory.Cache })).uri;
    const { uri, summary } = await VideoRemux.laySound({ from: fromUri, to: toUri, sound: soundUri, parts });
    const blob = await (await fetch(Capacitor.convertFileSrc(uri))).blob();
    log(`reel sound laid: ${summary ?? "?"}, ${blob.size} bytes`);
    return blob.size ? new Blob([blob], { type: "video/mp4" }) : null;
  } catch (e) {
    log(`reel left silent (sound not laid): ${String(e)}`);
    return null;
  } finally {
    await Filesystem.deleteFile({ path: from, directory: Directory.Cache }).catch(() => undefined);
    await Filesystem.deleteFile({ path: to, directory: Directory.Cache }).catch(() => undefined);
  }
};
