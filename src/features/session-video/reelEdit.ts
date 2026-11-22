import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";

import { adoptReelFile } from "./reelFile";
import { arcOrder, exportRanges, type ReelCandidate } from "./reelPlan";
import type { ReelEdit, SessionReel } from "./reelStore";
import { exportReel } from "./remux";

/** Longest a hand-picked reel's clips may run, title and end card aside. */
export const HAND_PICKED_MAX_MS = 60_000;

/** Where an exported reel goes: the app's cache, under reelFile's prefix. */
export const reelOutUri = async (): Promise<string> =>
  (
    await Filesystem.getUri({
      path: `shotcaller-reel-${Date.now()}.mp4`,
      directory: Directory.Cache,
    })
  ).uri;

/**
 * An exported reel as the completion screen holds it. The file stays in the
 * cache (adopted by reelFile, so the gallery save and Share use it as it is,
 * and the poster is drawn from it: a blob URL showed black on the iPhone).
 */
export const readExportedReel = async (
  uri: string,
  durationMs: number,
  clips: number
): Promise<SessionReel> => {
  const blob = await (await fetch(Capacitor.convertFileSrc(uri))).blob();
  if (!blob.size) throw new Error("empty reel");
  const reel = new Blob([blob], { type: "video/mp4" });
  adoptReelFile(uri);
  return {
    blob: reel,
    url: URL.createObjectURL(reel),
    ext: "mp4",
    durationMs,
    clips,
    fileUri: uri,
  };
};

/**
 * The clips chosen, in the reel's arc like the automatic reel (arcOrder),
 * whatever order they were ticked in. Every clip picked stays, even one that
 * repeats the type before it.
 */
export const chosenClips = (edit: ReelEdit, seqs: Iterable<number>): ReelCandidate[] => {
  const want = new Set(seqs);
  const clips = edit.candidates.filter((c) => want.has(c.seq)).sort((a, b) => a.fromMs - b.fromMs);
  return arcOrder(clips, { dropRepeats: false });
};

export const clipsMs = (clips: ReelCandidate[]): number =>
  clips.reduce((n, c) => n + c.toMs - c.fromMs, 0);

/**
 * Cuts the reel again with the clips someone picked, from the recording kept
 * for it: the same native export as the automatic reel. Null on failure.
 */
export const rebuildReel = async (
  edit: ReelEdit,
  seqs: number[],
  log: (line: string) => void = () => {},
  onProgress?: (fraction: number) => void
): Promise<SessionReel | null> => {
  const clips = chosenClips(edit, seqs);
  if (!clips.length) return null;
  const ranges = exportRanges(edit.timeline, clips);
  const made = await exportReel(edit.source, ranges, await reelOutUri(), log, onProgress);
  if (!made) return null;
  try {
    return await readExportedReel(
      made.uri,
      made.durationMs ?? ranges.reduce((n, s) => n + s.toMs - s.fromMs, 0),
      clips.length
    );
  } catch (e) {
    log(`rebuilt reel could not be read back: ${String(e)}`);
    await Filesystem.deleteFile({ path: made.uri }).catch(() => undefined);
    return null;
  }
};
