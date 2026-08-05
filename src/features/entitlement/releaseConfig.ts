// ===========================================================================
// SUBSCRIPTION RELEASE SWITCH
// ---------------------------------------------------------------------------
// This is the ONE place that controls the paid → free migration. Changing
// RELEASE_PHASE (and, for the free flip, IOS_FREE_TRANSITION_BUILD) is the
// entire code-side of flipping the app to free. Do not scatter these flags.
//
// Full step-by-step flip sequence lives in docs/SUBSCRIPTION_RELEASE.md.
// ===========================================================================

// Which side of the migration this build represents:
//
//   "paid" — the app is STILL a paid app. This build stamps every install as a
//            legacy owner (grandfathering), because everyone running a paid
//            build is by definition a paying owner. This is the Phase 0 build
//            that must ship to the stores BEFORE any price flip.
//
//   "free" — the app has gone free with subscriptions. New installs are NOT
//            stamped; legacy access comes only from the persisted (and
//            Android-Auto-Backup'd) flag, or the iOS original-version check
//            below. Use this value once you are about to flip prices to free.
export type ReleasePhase = "paid" | "free";
export const RELEASE_PHASE: ReleasePhase = "paid";

// Derived: only stamp installs as legacy owners while the app is still paid.
// (Also handy for local paywall testing — set RELEASE_PHASE to "free" to see
// the free-tier + paywall flow on a native build instead of being stamped.)
export const LEGACY_STAMP_ENABLED = RELEASE_PHASE === "paid";

// iOS grandfathering. RevenueCat exposes each user's original downloaded app
// version (CFBundleVersion / build number). Any user whose original build is
// BELOW the first free iOS release owned the paid app → grant lifetime legacy
// access. `null` skips the check and grants nothing (the safe default while
// still paid).
//
// ⚠️ MUST be set to the build number of the first free iOS release BEFORE
// flipping the App Store price to Free — otherwise iOS legacy owners who
// reinstall won't be recognized. See the runbook.
export const IOS_FREE_TRANSITION_BUILD: number | null = null;
