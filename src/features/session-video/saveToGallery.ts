import { Capacitor } from "@capacitor/core";
import { Media } from "@capacitor-community/media";

import { trackEvent } from "@/utils/analytics";
import { ensureReelFile } from "./reelFile";
import { patchSessionReel, type SessionReel } from "./reelStore";

const ALBUM = "Shot Caller";

/**
 * Where Android keeps the app's album: a "Shot Caller" folder in the app's
 * shared media directory. The phone's gallery and Google Photos index it,
 * and saving there needs no storage permission. (Unlike the rest of the
 * gallery, Android removes it if the app is uninstalled.)
 */
const androidAlbum = async (): Promise<string> => {
  const { path } = await Media.getAlbumsPath();
  const album = `${path}/${ALBUM}`;
  try {
    await Media.createAlbum({ name: ALBUM });
  } catch {
    /* already there: the usual case after the first reel */
  }
  return album;
};

const stamp = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
};

/** Saves a video file that is already on disk (see rawCapture.ts). */
export const saveFileToGallery = async (path: string, suffix: string): Promise<void> => {
  if (Capacitor.getPlatform() === "android") {
    await Media.saveVideo({
      path,
      albumIdentifier: await androidAlbum(),
      fileName: `ShotCaller_${stamp()}${suffix}`,
    });
  } else {
    await Media.saveVideo({ path });
  }
};

/**
 * Saves the session's reel to the phone's gallery as soon as it exists, so
 * it is kept without anyone having to remember to. iOS asks once for
 * permission to add to Photos (add-only, not access to the library); the
 * reel goes to Recents. Android files it in a "Shot Caller" album.
 *
 * The browser build has no gallery and leaves the reel unsaved; the player
 * offers a download there.
 */
export const autoSaveReel = async (
  reel: SessionReel,
  /** Added to the file name: "_short" for the short cut. */
  suffix = ""
): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  patchSessionReel(reel, { gallery: "saving" });
  try {
    const path = await ensureReelFile(reel);
    if (Capacitor.getPlatform() === "android") {
      await Media.saveVideo({
        path,
        albumIdentifier: await androidAlbum(),
        fileName: `ShotCaller_${stamp()}${suffix}`,
      });
    } else {
      await Media.saveVideo({ path });
    }
    patchSessionReel(reel, { gallery: "saved" });
    try {
      trackEvent("session_reel_saved", { platform: Capacitor.getPlatform() });
    } catch { /* analytics must never break the save */ }
  } catch (e) {
    console.warn("Reel could not be saved to the gallery:", e);
    patchSessionReel(reel, { gallery: "failed" });
    try {
      trackEvent("session_reel_error", {
        stage: "gallery",
        error: String((e as Error)?.message ?? e).slice(0, 100),
      });
    } catch { /* analytics must never break the save */ }
  }
};
