import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import html2canvas from "html2canvas";

export interface WorkoutStats {
  timestamp: string;
  emphases: string[];
  difficulty: string;
  shotsCalledOut: number;
  roundsCompleted: number;
  roundsPlanned: number;
  roundLengthMin: number;
}

/**
 * Internal difficulty values to the labels the user actually sees. Lives here
 * rather than in the completion screen because the card and the share caption
 * have to agree — a card reading "Amateur" beside a caption reading "medium"
 * is the kind of seam that makes a share look machine-made.
 */
export const getDifficultyLabel = (difficulty: string): string => {
  switch (difficulty) {
    case "easy":
      return "Novice";
    case "medium":
      return "Amateur";
    case "hard":
      return "Pro";
    default:
      return difficulty;
  }
};

/**
 * Round length as a person would say it. Whole minutes stay minutes; anything
 * else becomes clock time, because "0.25 min" is a number nobody has ever used
 * to describe a round and the shortest rounds are exactly where the card gets
 * read most literally.
 */
export const formatRoundLength = (minutes: number): string => {
  if (Number.isInteger(minutes)) return `${minutes} min`;
  const whole = Math.floor(minutes);
  const seconds = Math.round((minutes - whole) * 60);
  return `${whole}:${String(seconds).padStart(2, "0")}`;
};

/**
 * The caption that travels with a shared card.
 *
 * Deliberately flat: the numbers do the bragging so the words don't have to.
 * No exclamation mark, no emoji in the body, and never the word "workout" —
 * see `docs/SOCIAL_VOICE.md`. The speaker here is the user rather than the
 * brand, but the brand's restraint is what keeps a boast from reading as an ad.
 *
 * The challenge is "match this setup", never "beat my score". The app cannot
 * see the user and does not judge the work (SOCIAL_VOICE rule 9), and shots
 * called is a function of round length and difficulty rather than of effort,
 * so it is not a number anyone could fairly beat. The setup is the part a
 * friend can actually repeat, which is why the setup leads.
 *
 * Single seam on purpose: when a setup becomes a deep link, the URL is
 * appended here and nothing else in the app has to change.
 */
export const buildChallengeText = (stats: WorkoutStats): string => {
  const setup = [
    `${stats.roundsCompleted} × ${formatRoundLength(stats.roundLengthMin)}`,
    getDifficultyLabel(stats.difficulty),
    stats.emphases.join(", "),
  ]
    .filter((part) => part.length > 0)
    .join(" · ");

  return `${setup}. ${stats.shotsCalledOut} shots called. Same setup — your move. #NakMuay #ShotcallerNakMuay #MuayThai`;
};

/**
 * Captures a DOM element as a canvas and downloads it as an image
 * @param element - The DOM element to capture
 * @param filename - The filename for the downloaded image
 * @param options - html2canvas options for customization
 */
export const captureAndDownloadElement = async (
  element: HTMLElement,
  filename: string = "workout-summary",
  options: Partial<Parameters<typeof html2canvas>[1]> = {}
): Promise<void> => {
  try {
    // Default options for high quality capture
    const defaultOptions = {
      backgroundColor: null,
      scale: 2, // Higher resolution
      useCORS: true,
      allowTaint: false,
      height: element.scrollHeight,
      width: element.scrollWidth,
      ...options,
    };

    // Capture the element as canvas
    const canvas = await html2canvas(element, defaultOptions);

    // Check if we're running in a native app
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      // Native mobile: Use Capacitor Filesystem API
      await downloadImageNative(canvas, filename);
    } else {
      // Web: Use traditional download approach
      await downloadImageWeb(canvas, filename);
    }
  } catch (error) {
    console.error("Error capturing element:", error);
    throw new Error("Failed to capture and download image");
  }
};

/**
 * Downloads image in web environment using blob URL and anchor element
 */
const downloadImageWeb = async (
  canvas: HTMLCanvasElement,
  filename: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to create image blob"));
          return;
        }

        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${filename}.png`;

        // Trigger download
        document.body.appendChild(link);
        link.click();

        // Cleanup
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        resolve();
      },
      "image/png",
      0.95
    );
  });
};

/**
 * Downloads image in native environment using Capacitor Filesystem
 */
const downloadImageNative = async (
  canvas: HTMLCanvasElement,
  filename: string
): Promise<void> => {
  try {
    // Convert canvas to base64
    const base64Data = canvas.toDataURL("image/png", 0.95);

    // Remove the data URL prefix to get just the base64 string
    const base64String = base64Data.replace(/^data:image\/png;base64,/, "");

    // Save to device using Capacitor Filesystem in Documents directory
    // Create a ShotcallerNakMuay subdirectory for better organization
    const result = await Filesystem.writeFile({
      path: `ShotcallerNakMuay/${filename}.png`,
      data: base64String,
      directory: Directory.Documents,
      // Note: For base64 data, we don't need to specify encoding
    });

    // File saved successfully

    // Show a success message (you might want to use a toast library)
    if (typeof window !== "undefined" && "alert" in window) {
      alert(
        `Workout image saved to Documents/ShotcallerNakMuay folder as ${filename}.png`
      );
    }
  } catch (error) {
    console.error("Error saving file:", error);

    // Try one more time with just the root Documents directory
    try {
      const base64Data = canvas.toDataURL("image/png", 0.95);
      const base64String = base64Data.replace(/^data:image\/png;base64,/, "");

      const result = await Filesystem.writeFile({
        path: `${filename}.png`,
        data: base64String,
        directory: Directory.Documents,
      });

      // File saved to Documents root

      if (typeof window !== "undefined" && "alert" in window) {
        alert(`Workout image saved to Documents folder as ${filename}.png`);
      }
    } catch (fallbackError) {
      console.error("Fallback save also failed:", fallbackError);
      throw new Error("Failed to save image to device");
    }
  }
};

/**
 * Captures a DOM element and returns it as a blob for sharing
 * @param element - The DOM element to capture
 * @param options - html2canvas options for customization
 * @returns Promise<Blob> - The image blob
 */
export const captureElementAsBlob = async (
  element: HTMLElement,
  options: Partial<Parameters<typeof html2canvas>[1]> = {}
): Promise<Blob> => {
  try {
    const defaultOptions = {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      allowTaint: false,
      height: element.scrollHeight,
      width: element.scrollWidth,
      ...options,
    };

    const canvas = await html2canvas(element, defaultOptions);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create image blob"));
          }
        },
        "image/png",
        0.95
      );
    });
  } catch (error) {
    console.error("Error capturing element:", error);
    throw new Error("Failed to capture element as blob");
  }
};

/**
 * Generates a unique filename for workout summary based on stats
 * Includes date and time to prevent file overwrites on multiple downloads
 * @param stats - Workout statistics
 * @returns string - Generated filename with unique timestamp (YYYY-MM-DD-HH-MM-SS format)
 */
export const generateWorkoutFilename = (stats: WorkoutStats): string => {
  const date = new Date(stats.timestamp);
  const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
  const timeStr = date
    .toISOString()
    .split("T")[1]!
    .replace(/:/g, "-")
    .split(".")[0]; // HH-MM-SS
  const emphases = stats.emphases.join("-").replace(/\s+/g, "-").toLowerCase();

  return `shotcaller-workout-${dateStr}-${timeStr}-${emphases}-${stats.difficulty}`;
};

/**
 * Shares a charm/achievement image using Capacitor Share (native) or the
 * Web Share API (web), mirroring shareWorkoutImage but for collectibles.
 * @param blob - Image blob to share
 * @param charm - Charm name + Thai name for the share caption/filename
 */
export const shareCharmImage = async (
  blob: Blob,
  charm: { name: string; thaiName?: string }
): Promise<void> => {
  const safeName = charm.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "").toLowerCase();
  const filename = `shotcaller-charm-${safeName || "achievement"}.png`;
  const shareText = `I just earned the "${charm.name}"${
    charm.thaiName ? ` (${charm.thaiName})` : ""
  } charm in Shot Caller! 🥊 #NakMuay #ShotcallerNakMuay #MuayThai`;

  try {
    if (Capacitor.isNativePlatform()) {
      const base64Data = await blobToBase64(blob);
      const cachePath = freshCardPath(
        `shotcaller-charm-${safeName || "achievement"}`
      );
      const result = await Filesystem.writeFile({
        path: cachePath,
        data: base64Data,
        directory: Directory.Cache,
      });
      await pruneSharedCards(cachePath);
      await Share.share({
        title: "New Charm Earned!",
        text: shareText,
        url: result.uri,
        dialogTitle: "Share your achievement",
      });
    } else if ("share" in navigator) {
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "New Charm Earned!",
          text: shareText,
          files: [file],
        });
      } else {
        await navigator.share({ title: "New Charm Earned!", text: shareText });
      }
    } else if (typeof navigator !== "undefined" && "clipboard" in navigator) {
      await (navigator as any).clipboard.writeText(shareText);
      alert("Achievement details copied to clipboard!");
    } else {
      alert("Sharing is not supported in this browser. Try the Download button instead.");
    }
  } catch (error) {
    console.error("Error sharing charm:", error);
    if (error instanceof Error && error.name !== "AbortError") {
      alert("Unable to share. Try using the Download button instead.");
    }
  }
};

/**
 * A cache path no earlier share has used.
 *
 * Android thumbnails a shared file by its content URI and holds on to that
 * thumbnail. Both card names were deterministic — the workout one derives from
 * the session timestamp, the charm one from the charm — so re-sharing wrote a
 * new card over a path the share sheet had already previewed, and the sheet
 * kept showing the older image beside the newer file. The bytes were always
 * current; only the preview lied. Uniqueness per share is what stops it.
 *
 * The download filename stays deterministic on purpose: that one the user
 * sees and files away, and it is not what the share sheet keys on.
 */
const freshCardPath = (base: string): string => `${base}-${Date.now()}.png`;

/**
 * Best-effort tidy-up. Every share now leaves a card behind under a name
 * nothing will reuse, so earlier ones are dropped once the new one is safely
 * written. A cache that cannot be listed is a cache that needs no tidying, and
 * none of this is worth failing a share over.
 */
const pruneSharedCards = async (keep: string): Promise<void> => {
  try {
    const { files } = await Filesystem.readdir({
      path: "",
      directory: Directory.Cache,
    });
    await Promise.all(
      files
        .filter((f) => f.name !== keep && /^shotcaller-.+\.png$/.test(f.name))
        .map((f) =>
          Filesystem.deleteFile({
            path: f.name,
            directory: Directory.Cache,
          }).catch(() => undefined)
        )
    );
  } catch {
    // Nothing to do, and nothing worth surfacing.
  }
};

/** Converts a PNG blob to a bare base64 string (no data-URL prefix). */
const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || "");
      resolve(result.replace(/^data:image\/png;base64,/, ""));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

/**
 * Checks if the Web Share API is available (Web or Native)
 * @returns boolean
 */
export const isWebShareSupported = (): boolean => {
  // Check if we're in a native app (Capacitor Share is always available)
  if (Capacitor.isNativePlatform()) {
    return true;
  }
  // Otherwise check for Web Share API
  return "share" in navigator;
};

/**
 * Checks if we're running in a native app environment
 * @returns boolean
 */
export const isNativeApp = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Shares workout image using Capacitor Share (native) or Web Share API (web)
 * @param blob - Image blob to share
 * @param stats - Workout stats for generating share text
 */
export const shareWorkoutImage = async (
  blob: Blob,
  stats: WorkoutStats
): Promise<void> => {
  const shareText = buildChallengeText(stats);

  try {
    // Check if running in native app
    if (Capacitor.isNativePlatform()) {
      // Use Capacitor Share for native apps
      // First save the image to filesystem, then share it
      const canvas = document.createElement("canvas");
      const img = new Image();
      const blobUrl = URL.createObjectURL(blob);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve();
          } else {
            reject(new Error("Failed to get canvas context"));
          }
        };
        img.onerror = reject;
        img.src = blobUrl;
      });

      URL.revokeObjectURL(blobUrl);

      const base64Data = canvas.toDataURL("image/png", 0.95);
      const base64String = base64Data.replace(/^data:image\/png;base64,/, "");
      const cachePath = freshCardPath(generateWorkoutFilename(stats));

      // Save to cache directory temporarily
      const result = await Filesystem.writeFile({
        path: cachePath,
        data: base64String,
        directory: Directory.Cache,
      });
      await pruneSharedCards(cachePath);

      // Share the file
      await Share.share({
        title: "Shot Caller — your move",
        text: shareText,
        url: result.uri,
        dialogTitle: "Send the challenge",
      });

      // Optionally clean up the temp file after sharing
      // Note: We keep it for now as the share might be async
    } else if ("share" in navigator) {
      // Use Web Share API for web browsers if available
      const file = new File([blob], `${generateWorkoutFilename(stats)}.png`, {
        type: "image/png",
      });

      // Check if we can share files
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "Shot Caller — your move",
          text: shareText,
          files: [file],
        });
      } else {
        // Fallback: try sharing without files (text only)
        await navigator.share({
          title: "Shot Caller — your move",
          text: shareText,
        });
      }
    } else {
      // Fallback: Copy text to clipboard
      if (typeof navigator !== "undefined" && "clipboard" in navigator) {
        await (navigator as any).clipboard.writeText(shareText);
        alert(
          "Challenge copied to clipboard.\n\nNote: Your browser doesn't support sharing. The image has been downloaded separately."
        );
      } else {
        alert(
          "Sharing is not supported in this browser. Please use the Download button instead."
        );
      }
    }
  } catch (error) {
    console.error("Error sharing workout:", error);
    // Don't throw if user cancelled
    if (error instanceof Error && error.name !== "AbortError") {
      // Show user-friendly message instead of throwing
      alert("Unable to share. Try using the Download button instead.");
    }
  }
};
