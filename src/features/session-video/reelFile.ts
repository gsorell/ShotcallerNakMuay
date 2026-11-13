import { Directory, Filesystem } from "@capacitor/filesystem";

import { patchSessionReel, type SessionReel } from "./reelStore";

/**
 * The reel as a file in the app's cache: what both the gallery save and the
 * share sheet hand to native code, which cannot read a browser Blob. Written
 * once per reel and reused.
 */
const REEL_PREFIX = "shotcaller-reel-";

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const s = String(reader.result ?? "");
      resolve(s.slice(s.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** Largest piece sent across the native bridge at once. */
const PIECE = 2 * 1024 * 1024;

/**
 * Writes (or, with `append`, adds to) a file from a Blob, a piece at a time.
 * Everything crossing to native code travels as one base64 string in the
 * app's Java heap (256 MB on a Pixel 9); a 43 MB recording sent in one call
 * ran it out of memory and killed the app (2026-11-13).
 */
export const writeBlobInPieces = async (
  path: string,
  directory: Directory,
  blob: Blob,
  append = false
): Promise<string> => {
  let uri = "";
  let started = append;
  for (let at = 0; at < blob.size || (!started && at === 0); at += PIECE) {
    const data = await blobToBase64(blob.slice(at, at + PIECE));
    if (started) {
      await Filesystem.appendFile({ path, directory, data });
    } else {
      uri = (await Filesystem.writeFile({ path, directory, data })).uri;
      started = true;
    }
  }
  return uri || (await Filesystem.getUri({ path, directory })).uri;
};

/** The newest two files are kept: this session's reel and the last. */
const recent: string[] = [];

/** One session's reels in the cache at a time; earlier ones are dropped. */
const pruneOldReels = async (): Promise<void> => {
  const keep = new Set(recent);
  try {
    const { files } = await Filesystem.readdir({
      path: "",
      directory: Directory.Cache,
    });
    await Promise.all(
      files
        .filter((f) => !keep.has(f.name) && f.name.startsWith(REEL_PREFIX))
        .map((f) =>
          Filesystem.deleteFile({
            path: f.name,
            directory: Directory.Cache,
          }).catch(() => undefined)
        )
    );
  } catch {
    /* nothing worth surfacing */
  }
};

/** The reel's cache file URI, writing it the first time it is asked for. */
export const ensureReelFile = async (reel: SessionReel): Promise<string> => {
  if (reel.fileUri) return reel.fileUri;
  const name = `${REEL_PREFIX}${Date.now()}.${reel.ext}`;
  const uri = await writeBlobInPieces(name, Directory.Cache, reel.blob);
  recent.push(name);
  recent.splice(0, Math.max(0, recent.length - 2));
  void pruneOldReels();
  patchSessionReel(reel, { fileUri: uri });
  reel.fileUri = uri;
  return uri;
};
