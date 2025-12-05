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
  const shareText = `Just completed a ${stats.difficulty} workout with ${
    stats.shotsCalledOut
  } shots called out! 🥊 ${stats.roundsCompleted}/${
    stats.roundsPlanned
  } rounds of ${stats.emphases.join(
    ", "
  )} training. #NakMuay #ShotcallerNakMuay #MuayThai`;

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
      const filename = `${generateWorkoutFilename(stats)}.png`;

      // Save to cache directory temporarily
      const result = await Filesystem.writeFile({
        path: filename,
        data: base64String,
        directory: Directory.Cache,
      });

      // Share the file
      await Share.share({
        title: "Shotcaller Nak Muay Workout Complete!",
        text: shareText,
        url: result.uri,
        dialogTitle: "Share your workout",
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
          title: "Shotcaller Nak Muay Workout Complete!",
          text: shareText,
          files: [file],
        });
      } else {
        // Fallback: try sharing without files (text only)
        await navigator.share({
          title: "Shotcaller Nak Muay Workout Complete!",
          text: shareText,
        });
      }
    } else {
      // Fallback: Copy text to clipboard
      if (typeof navigator !== "undefined" && "clipboard" in navigator) {
        await (navigator as any).clipboard.writeText(shareText);
        alert(
          "Workout details copied to clipboard!\n\nNote: Your browser doesn't support sharing. The image has been downloaded separately."
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
