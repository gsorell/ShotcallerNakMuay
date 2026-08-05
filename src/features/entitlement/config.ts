import { Capacitor } from "@capacitor/core";

// RevenueCat *public* SDK keys. These are the app-specific keys RevenueCat
// designs to be embedded in the shipped client — they are not secrets, so
// committing them here is safe and means every build works without extra env
// setup. A Vite env var still overrides, e.g. to point a build at a different
// RevenueCat project. Web (PWA) has no purchase path and returns null, so the
// app skips RevenueCat there and applies free-tier gating.
const RC_IOS_PUBLIC_KEY = "appl_kEwaLKjnCJdCjyrmIWyvdbOjZsN";
const RC_ANDROID_PUBLIC_KEY = "goog_nYfoTbEVMxTPpHnPFqdUTcvJSeC";

export function getRevenueCatApiKey(): string | null {
  const platform = Capacitor.getPlatform();
  if (platform === "ios") {
    return import.meta.env.VITE_RC_IOS_KEY ?? RC_IOS_PUBLIC_KEY;
  }
  if (platform === "android") {
    return import.meta.env.VITE_RC_ANDROID_KEY ?? RC_ANDROID_PUBLIC_KEY;
  }
  return null;
}
