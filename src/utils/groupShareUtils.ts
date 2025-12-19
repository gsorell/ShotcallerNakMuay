import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type { TechniqueShape } from "./techniqueUtils";

/**
 * Structure for shared group data
 */
export interface ShareableGroup {
  version: string; // Format version for future compatibility
  appVersion: string; // App version that created the share
  group: {
    label: string;
    title?: string;
    description?: string;
    singles?: Array<string | { text: string; favorite?: boolean }>;
    combos?: Array<string | { text: string; favorite?: boolean }>;
  };
  sharedAt: string; // ISO timestamp
}

/**
 * Check if running as a native Capacitor app
 */
function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Convert Blob to base64 string
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:application/json;base64,")
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("Failed to convert blob to base64"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Share a technique group as a JSON file
 */
export async function shareGroup(
  groupKey: string,
  groupData: TechniqueShape
): Promise<void> {
  // 1. Create shareable data structure
  const shareData: ShareableGroup = {
    version: "1.0",
    appVersion: "1.4.21", // TODO: Import from package.json
    group: {
      label: groupKey,
      title: groupData.title,
      description: groupData.description,
      singles: groupData.singles,
      combos: groupData.combos,
    },
    sharedAt: new Date().toISOString(),
  };

  // 2. Generate JSON file
  const json = JSON.stringify(shareData, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const timestamp = Date.now();
  const filename = `${groupKey}_${timestamp}.nakmuay.json`;

  // 3. Share text
  const groupTitle = groupData.title || groupKey;
  const shareText = `Check out my "${groupTitle}" technique group for Shotcaller Nak Muay! 🥊\n\nOpen with the app or save the file to import later.\n\n#NakMuay #MuayThai`;

  // 4. Platform-specific sharing
  if (isNativeApp()) {
    try {
      // Convert blob to base64 for Capacitor Filesystem
      const base64String = await blobToBase64(blob);

      // Write to cache directory
      const result = await Filesystem.writeFile({
        path: filename,
        data: base64String,
        directory: Directory.Cache,
      });

      // Share using native share dialog
      await Share.share({
        title: `Shotcaller Nak Muay - ${groupTitle}`,
        text: shareText,
        url: result.uri,
        dialogTitle: "Share technique group",
      });
    } catch (error) {
      console.error("Error sharing group on native platform:", error);
      throw new Error("Failed to share group. Please try again.");
    }
  } else {
    // Web platform - use the same approach as downloadJSON from fileUtils
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Small delay before revoking to ensure download starts
      setTimeout(() => URL.revokeObjectURL(url), 100);

      // Show share text with instructions
      alert(
        `Group exported as "${filename}"!\n\n${shareText}\n\nShare this file with others - they can import it using the "Import Backup" button in the Technique Manager.`
      );
    } catch (error) {
      console.error("Error downloading group file:", error);
      throw new Error("Failed to export group. Please try again.");
    }
  }
}

/**
 * Validate imported group data
 */
export function validateShareableGroup(data: any): ShareableGroup {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid group data format");
  }

  if (data.version !== "1.0") {
    throw new Error(`Unsupported group format version: ${data.version}`);
  }

  if (!data.group || typeof data.group !== "object") {
    throw new Error("Missing group data");
  }

  if (!data.group.label || typeof data.group.label !== "string") {
    throw new Error("Invalid group label");
  }

  return data as ShareableGroup;
}

/**
 * Parse and validate group data from JSON file
 */
export async function parseGroupFromFile(file: File): Promise<ShareableGroup> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    return validateShareableGroup(data);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to parse group file");
  }
}
