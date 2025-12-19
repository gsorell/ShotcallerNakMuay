import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

/**
 * Downloads a JSON object as a file
 * Works on both web (PWA) and native (Android/iOS) platforms
 *
 * @param data - The data object to export as JSON
 * @param filename - The filename (without extension)
 */
export const downloadJSON = async (
  data: any,
  filename: string
): Promise<void> => {
  const jsonString = JSON.stringify(data, null, 2);
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    await downloadJSONNative(jsonString, filename);
  } else {
    await downloadJSONWeb(jsonString, filename);
  }
};

/**
 * Downloads JSON in web environment using blob URL and anchor element
 */
const downloadJSONWeb = async (
  jsonString: string,
  filename: string
): Promise<void> => {
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.json`;

  // Append to body, click, and cleanup
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Downloads JSON in native environment using Capacitor Filesystem and Share
 */
const downloadJSONNative = async (
  jsonString: string,
  filename: string
): Promise<void> => {
  try {
    // Convert JSON string to base64
    const base64Data = btoa(unescape(encodeURIComponent(jsonString)));

    // Try saving to Documents directory with app subdirectory
    try {
      const result = await Filesystem.writeFile({
        path: `ShotcallerNakMuay/${filename}.json`,
        data: base64Data,
        directory: Directory.Documents,
        encoding: undefined, // For base64 data
      });

      // Use Share API to let user choose where to save/share the file
      await Share.share({
        title: "Export Backup",
        text: `${filename}.json`,
        url: result.uri,
        dialogTitle: "Save or Share Backup File",
      });
    } catch (error) {
      console.error("Error saving to subdirectory:", error);

      // Fallback: Try saving to root Documents directory
      const result = await Filesystem.writeFile({
        path: `${filename}.json`,
        data: base64Data,
        directory: Directory.Documents,
        encoding: undefined,
      });

      // Use Share API
      await Share.share({
        title: "Export Backup",
        text: `${filename}.json`,
        url: result.uri,
        dialogTitle: "Save or Share Backup File",
      });
    }
  } catch (error) {
    console.error("Error exporting JSON file:", error);
    throw new Error("Failed to export file on Android");
  }
};

/**
 * Checks if we're running in a native app environment
 * @returns boolean
 */
export const isNativeApp = (): boolean => {
  return Capacitor.isNativePlatform();
};
