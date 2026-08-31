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

// Lessons in the Learn library that open without Pro. These are the two
// techniques the first guided level teaches, so a free user's path and their
// library agree with each other rather than one of them dead-ending.
//
// A browsable shelf shows how much there is; it does not show what a lesson is
// actually like, which is the thing being sold. Two open lessons out of the
// library is a sample, not the product.
export const FREE_LEARN_SLUGS: ReadonlySet<string> = new Set(["jab", "cross"]);

export function isFreeLearnSlug(slug: string): boolean {
  return FREE_LEARN_SLUGS.has(slug);
}

// Persistent flag marking a user who owned the app during its paid era.
// Stored via Capacitor Preferences → Android SharedPreferences, which Android
// Auto Backup covers by default, so the flag survives reinstall on the same
// Google account even after the app becomes free.
export const LEGACY_OWNER_KEY = "shotcaller_legacy_owner";

// The paid→free release switch (LEGACY_STAMP_ENABLED, IOS_FREE_TRANSITION_BUILD,
// RELEASE_PHASE) lives in ./releaseConfig — the single place to flip to free.
