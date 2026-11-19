import { Capacitor, registerPlugin } from "@capacitor/core";

import { MIN_VISIBLE, type FramingFrame } from "./reelPlan";

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
  probeFraming(opts: { file: string; timesMs: number[] }): Promise<{ frames: FramingFrame[] }>;
  exportReel(opts: {
    file: string;
    clips: KeepSpan[];
    out: string;
    width?: number;
    height?: number;
    fps?: number;
    videoBps?: number;
    targetLufs?: number;
  }): Promise<{ uri: string; summary?: string; durationMs?: number }>;
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
 * Whether the fighter is in shot at each moment of a recording on disk:
 * pose detection on the exact frame, natively (Vision on iOS, ML Kit on
 * Android). Null on any failure or in the browser: the reel is then picked
 * without the check.
 */
export const probeFraming = async (
  file: string,
  timesMs: number[],
  log: (line: string) => void = () => {}
): Promise<FramingFrame[] | null> => {
  if (!Capacitor.isNativePlatform() || !timesMs.length) return null;
  try {
    const startedAt = Date.now();
    const { frames } = await VideoRemux.probeFraming({ file, timesMs });
    const out = frames.filter((f) => f.person && f.visible >= MIN_VISIBLE).length;
    log(`framing probed: ${frames.length} frames in ${Date.now() - startedAt}ms, ${out} fully in shot`);
    return frames;
  } catch (e) {
    log(`framing not checked: ${String(e)}`);
    return null;
  }
};

/** The reel's picture: portrait 1080p at 30 fps, about 10 Mbps. */
export const REEL_EXPORT = { width: 1080, height: 1920, fps: 30, videoBps: 10_000_000, targetLufs: -14 };

/**
 * Cuts `clips` out of a recording on disk, back to back, into `out`:
 * frame-accurate, scaled to REEL_EXPORT, encoded once with the phone's
 * hardware encoder, the sound faded at each cut and brought to a feed's
 * loudness. Null on any failure or in the browser.
 */
export const exportReel = async (
  file: string,
  clips: KeepSpan[],
  out: string,
  log: (line: string) => void = () => {}
): Promise<{ uri: string; durationMs?: number } | null> => {
  if (!Capacitor.isNativePlatform() || !clips.length) return null;
  try {
    const startedAt = Date.now();
    const { uri, summary, durationMs } = await VideoRemux.exportReel({ file, clips, out, ...REEL_EXPORT });
    log(`reel exported in ${Date.now() - startedAt}ms: ${summary ?? "?"}`);
    return { uri, ...(typeof durationMs === "number" ? { durationMs } : {}) };
  } catch (e) {
    log(`reel could not be exported: ${String(e)}`);
    return null;
  }
};
