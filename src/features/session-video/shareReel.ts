import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

import type { SessionReel } from "./reelStore";

const SHARE_TEXT = "Today's rounds, called by Shot Caller 🥊 #MuayThai";

/** Closing the share sheet is not a failure; see imageUtils for the same. */
const isDismissal = (error: unknown): boolean => {
  if ((error as Error)?.name === "AbortError") return true;
  const message = String((error as Error)?.message ?? error).toLowerCase();
  return (
    message.includes("cancel") ||
    message.includes("abort") ||
    message.includes("dismiss")
  );
};

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

/** One file in the cache at a time; an earlier reel is dropped on write. */
const REEL_PREFIX = "shotcaller-reel-";

const pruneOldReels = async (keep: string): Promise<void> => {
  try {
    const { files } = await Filesystem.readdir({
      path: "",
      directory: Directory.Cache,
    });
    await Promise.all(
      files
        .filter((f) => f.name !== keep && f.name.startsWith(REEL_PREFIX))
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

/**
 * Opens the share sheet with the reel. On native that sheet is also how it
 * gets saved — "Save Video" on iOS, Photos or Files on Android — so there is
 * no separate save path to maintain.
 *
 * Returns "shared", "dismissed" or "failed".
 */
export const shareReel = async (
  reel: SessionReel
): Promise<"shared" | "dismissed" | "failed"> => {
  const name = `${REEL_PREFIX}${Date.now()}.${reel.ext}`;
  try {
    if (Capacitor.isNativePlatform()) {
      const data = await blobToBase64(reel.blob);
      const result = await Filesystem.writeFile({
        path: name,
        data,
        directory: Directory.Cache,
      });
      await pruneOldReels(name);
      await Share.share({
        title: "My Shot Caller session",
        text: SHARE_TEXT,
        files: [result.uri],
        dialogTitle: "Share or save your reel",
      });
      return "shared";
    }

    const file = new File([reel.blob], name, { type: reel.blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: SHARE_TEXT });
      return "shared";
    }
    // Desktop browsers: a download is the only way out.
    const a = document.createElement("a");
    a.href = reel.url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return "shared";
  } catch (error) {
    if (isDismissal(error)) return "dismissed";
    console.error("Error sharing reel:", error);
    return "failed";
  }
};
