import { Capacitor } from "@capacitor/core";

// RevenueCat public SDK keys, read from Vite env so they aren't hard-committed.
// Populated once the real App Store / Play apps are connected in RevenueCat
// (Task 6): VITE_RC_IOS_KEY = "appl_…", VITE_RC_ANDROID_KEY = "goog_…".
// Returns null when no key is configured for the current platform (e.g. web,
// or before Task 6), in which case the app skips RevenueCat and falls back to
// legacy/free evaluation.
export function getRevenueCatApiKey(): string | null {
  const platform = Capacitor.getPlatform();
  if (platform === "ios") return import.meta.env.VITE_RC_IOS_KEY ?? null;
  if (platform === "android") return import.meta.env.VITE_RC_ANDROID_KEY ?? null;
  return null;
}
