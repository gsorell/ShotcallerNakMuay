import { Preferences } from "@capacitor/preferences";

import { LEGACY_OWNER_KEY } from "./constants";

// Reads the persisted "owned during the paid era" flag. Best-effort: any
// storage failure resolves to false rather than throwing.
export async function isLegacyOwner(): Promise<boolean> {
  try {
    const { value } = await Preferences.get({ key: LEGACY_OWNER_KEY });
    return value === "1";
  } catch {
    return false;
  }
}

// Persists the legacy-owner flag. Written by Phase 0 auto-stamping (while the
// app is still paid), by the iOS original-version grandfather check, and by
// the honor-system "I bought this before" restore button.
export async function markLegacyOwner(): Promise<void> {
  try {
    await Preferences.set({ key: LEGACY_OWNER_KEY, value: "1" });
  } catch {
    // Best-effort; a failed write just means we re-evaluate next launch.
  }
}
