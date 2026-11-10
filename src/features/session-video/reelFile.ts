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

/** The newest two files are kept: a session's reel and its short cut. */
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
  const result = await Filesystem.writeFile({
    path: name,
    data: await blobToBase64(reel.blob),
    directory: Directory.Cache,
  });
  recent.push(name);
  recent.splice(0, Math.max(0, recent.length - 2));
  void pruneOldReels();
  patchSessionReel(reel, { fileUri: result.uri });
  reel.fileUri = result.uri;
  return result.uri;
};
