import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

import { ensureReelFile } from "./reelFile";
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

/**
 * Opens the share sheet with a video already on disk: the reel's copy, or
 * the full session (too big to read into the web view). Native only.
 */
export const shareVideoFile = async (
  uri: string
): Promise<"shared" | "dismissed" | "failed"> => {
  try {
    await Share.share({
      title: "My Shot Caller session",
      text: SHARE_TEXT,
      files: [uri],
      dialogTitle: "Share your session",
    });
    return "shared";
  } catch (error) {
    if (isDismissal(error)) return "dismissed";
    console.error("Error sharing video:", error);
    return "failed";
  }
};

/**
 * Opens the share sheet with the reel. On native the sheet is also a way to
 * save it somewhere else (Files, Drive) — the gallery copy is made
 * automatically when the session ends.
 *
 * Returns "shared", "dismissed" or "failed".
 */
export const shareReel = async (
  reel: SessionReel
): Promise<"shared" | "dismissed" | "failed"> => {
  const name = `shotcaller-reel.${reel.ext}`;
  try {
    if (Capacitor.isNativePlatform()) return await shareVideoFile(await ensureReelFile(reel));

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
