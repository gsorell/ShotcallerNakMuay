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
export const RELEASE_PHASE: ReleasePhase = "free";

// Derived: only stamp installs as legacy owners while the app is still paid.
// (Also handy for local paywall testing — set RELEASE_PHASE to "free" to see
// the free-tier + paywall flow on a native build instead of being stamped.)
//
// The cast is load-bearing, not decoration. TypeScript narrows a `const` with
// a literal-union annotation down to the single literal it was assigned, so
// the moment RELEASE_PHASE is set to "free" this comparison looks like a
// provably-false test between "free" and "paid" and becomes a compile error
// (TS2367). Since `npm run build` runs `tsc -b` first, that would break the
// production build on the exact day of the price flip — the worst possible
// moment. Widening back to ReleasePhase keeps both branches legitimate.
export const LEGACY_STAMP_ENABLED =
  (RELEASE_PHASE as ReleasePhase) === "paid";

// iOS grandfathering. RevenueCat exposes each user's original downloaded app
// version (CFBundleVersion / build number). Any user whose original build is
// BELOW the first free iOS release owned the paid app → grant lifetime legacy
// access. `null` skips the check and grants nothing (the safe default while
// still paid).
//
// ⚠️ MUST be set to the build number of the first free iOS release BEFORE
// flipping the App Store price to Free — otherwise iOS legacy owners who
// reinstall won't be recognized. See the runbook.
//
// The CI sets CFBundleVersion from `github.run_number`, so this is the run
// number of the build that gets submitted. Last completed run was #56, so the
// next "Run workflow" produces #57. If any other run of that workflow happens
// first, this value must be bumped to match before submitting.
//
// ⚠️ Sandbox returns "1.0" for the original version and App Review runs in
// sandbox — see ./originalVersion for why that is handled explicitly rather
// than compared numerically.
export const IOS_FREE_TRANSITION_BUILD: number | null = 57;

// Android grandfathering — the counterpart to the iOS check above.
//
// Play keeps no retroactive record of who bought a paid app, which is why the
// migration stamps owners while the app is still paid. But that stamp requires
// the user to OPEN the app before the flip, and a phone that auto-updates to
// the free build first would never stamp — leaving a real buyer at a paywall.
//
// `firstInstallTime` (via the native InstallInfo plugin) survives updates, so
// a device that installed the app before the flip installed it while it still
// cost money. Those users are grandfathered silently, with no action required.
//
// ⚠️ MUST be set BEFORE flipping the Play price to Free, and must ship in a
// build users actually have. `null` skips the check entirely (the safe default
// while still paid — nothing to grandfather yet).
//
// Set it slightly AFTER the moment you flip, not before: letting a handful of
// genuinely-free installs through is far cheaper than locking out someone who
// paid minutes before the switch.
// 2026-08-09 23:59:00 ET (2026-08-10T03:59Z) — the deadline the Play price
// flip must happen BEFORE. Anyone who installed while the app still cost money
// is on the early side of this and is grandfathered automatically.
export const ANDROID_FREE_TRANSITION_DATE: number | null = 1786334340000;

// How long the manual "I bought this before it went free" claim stays offered
// after the Android flip, in days. Real owners surface quickly — mostly on
// their first launch after the change — so leaving an unverifiable unlock in
// the paywall forever is just a free-access button for everyone else.
//
// Counted from ANDROID_FREE_TRANSITION_DATE; the claim is always available
// when that date is null (i.e. pre-flip, where the app is still paid and there
// is nothing to steal).
export const LEGACY_CLAIM_WINDOW_DAYS = 90;
