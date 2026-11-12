# Release Notes — v1.25.2

**Date:** 2026-11-12
**versionCode:** 115
**Type:** Patch. Two fixes on top of v1.25.1: a clearer first run for new
users, and Android's paywall showing no plans.

---

## Paywall: plans missing on Android (`d1fa7aa`)

**Symptom.** In GA4, 2026-09-08 to 2026-11-11, 61 of 125 Android
`paywall_dismiss` events had `plans_loaded = false`, against 1 of 283 on iOS.
Those users saw "Plans aren't available" with nothing to tap. Since the free
flip, 168 new Android customers in RevenueCat started 2 trials; 210 iOS
customers started 18.

**Cause.** `getPackages` returned `[]`, and reported nothing, in three cases:

1. the paywall opened before `Purchases.configure` finished, and never asked
   again;
2. configuring failed, which left every paywall that session empty;
3. `getOfferings` threw, and the error went to `console.warn` only.

**Fix.**
- `src/features/entitlement/loadPlans.ts` (new): waits for configuring (10 s
  cap), retries once after 1.5 s, and returns why there are no plans
  (`not_configured`, `offerings_error` or `empty_offering`), plus the store's
  error code and message.
- `EntitlementProvider.tsx`: init settles a "configured" promise as soon as
  `configure()` returns, or with false when there's no key or it throws.
- `PaywallModal.tsx`: the empty state has a **Try again** button. On native
  builds, sends `paywall_plans_error` (`stage`, `code`, `error`, `attempts`,
  `source`) and `paywall_plans_retry`.

**To read the results in GA4,** register `stage`, `code` and `error` as
event-scoped custom dimensions. The `code` on `offerings_error` says whether
the next fix belongs in the app or in Play/RevenueCat setup.

## First run (`abf4943`)

- Onboarding's last step leads with **Start Level 1 — free**, which opens Start
  Here on Level 1. "See Pro Plans" / "Get the app" become the secondary button.
- New installs default to 3 × 2 min rounds instead of 5 × 3. Existing users keep
  their saved settings.
- Start Here: Pro levels show a Pro chip and open the paywall instead of a
  padlock. Free levels waiting on the previous one say "Free · opens after
  Level N".

## Test plan

- `npx vitest run`: 31 files, 419 tests pass (8 new in `loadPlans.test.ts`).
- `tsc -p tsconfig.app.json` clean; `npm run build` passes.
- On device: open the paywall right after a cold start. Plans should appear
  after "Loading plans…", not the empty state. With airplane mode on, the empty
  state shows Try again; turning the network back on and tapping it loads plans.

## Store copy

**App Store — What's New**

A smoother start for new fighters: the app now takes you straight into Level 1 of Start Here, with shorter first rounds (3 × 2 minutes) to ease you in. Locked levels now say clearly whether they're Pro or just waiting on the level before them. Also fixes plans sometimes not loading on the upgrade screen, and adds a Try again button if the store can't be reached.

**Play Store — release notes (≤500 chars)**

A smoother start: new users go straight into Level 1 of Start Here, with shorter first rounds (3 × 2 min). Locked levels now say whether they're Pro or waiting on the previous level. Fixes plans sometimes not loading on the upgrade screen, with a new Try again button.
