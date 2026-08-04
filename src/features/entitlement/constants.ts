import type { EmphasisKey } from "@/types";

// RevenueCat entitlement identifier — confirmed as "Pro" (capital P) in the
// RevenueCat dashboard. The identifier is locked there and must match exactly.
export const PRO_ENTITLEMENT_ID = "Pro";

// Store product identifiers, kept for reference/documentation. Runtime code
// keys off the entitlement + offerings rather than these raw ids, but they
// record the per-store mapping RevenueCat ties to the `Pro` entitlement.
export const PRODUCT_IDS = {
  ios: {
    monthly: "snm_pro_monthly",
    annual: "snm_pro_annual",
    lifetime: "snm_lifetime",
  },
  android: {
    // Play uses two separate subscriptions plus a one-time product.
    monthly: "premium_monthly", // base plan: monthly-trial
    annual: "premium_yearly",
    lifetime: "premium_lifetime", // purchase option: lifetime
  },
} as const;

// Fighting styles available on the free tier. Everything else is Pro-gated.
// Free = basic timer, freestyle, and Nak Muay Newb.
export const FREE_EMPHASIS_KEYS: ReadonlySet<EmphasisKey> = new Set<EmphasisKey>(
  ["timer_only", "freestyle", "newb"]
);

export function isFreeEmphasis(key: EmphasisKey): boolean {
  return FREE_EMPHASIS_KEYS.has(key);
}

// Persistent flag marking a user who owned the app during its paid era.
// Stored via Capacitor Preferences → Android SharedPreferences, which Android
// Auto Backup covers by default, so the flag survives reinstall on the same
// Google account even after the app becomes free.
export const LEGACY_OWNER_KEY = "shotcaller_legacy_owner";

// Phase 0 switch. The release shipped WHILE the app is still paid sets this
// true, so every current install — all of whom are paying owners — gets
// stamped as a legacy owner on launch. The later free release flips this to
// false so brand-new free installs are NOT stamped; only the persisted (and
// auto-backed-up) flag then grants legacy access.
export const LEGACY_STAMP_ENABLED = true;

// iOS grandfathering. RevenueCat exposes the original downloaded app version
// (CFBundleVersion / build number). Any user whose original build is below the
// first free release is a legacy owner. `null` = not yet configured (skips the
// check and grants nothing, which is the safe default before the flip).
// TODO(flip): set to the build number of the first free iOS release before
// switching the App Store price to Free.
export const IOS_FREE_TRANSITION_BUILD: number | null = null;
