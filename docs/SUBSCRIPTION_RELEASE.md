# Subscription Migration — Release Runbook

How to take the app from **paid** to **free + subscription (+ lifetime)** without
losing existing owners. Follow the phases in order. The store price flips are at
the very end and, for Google, **irreversible**.

## The one hard rule

**Phase 0 must ship to the stores while the app is still PAID.** That build
stamps every current install as a legacy owner (grandfathering). If you flip a
store to free before Phase 0 is adopted, those owners cannot be recovered on
Android.

## The release switch (code)

Everything code-side is controlled from `src/features/entitlement/releaseConfig.ts`:

- `RELEASE_PHASE`: `"paid"` (Phase 0, stamps legacy owners) or `"free"` (post-flip).
  - `LEGACY_STAMP_ENABLED` is derived from it.
- `IOS_FREE_TRANSITION_BUILD`: the CFBundleVersion (build number) of the **first
  free iOS release**. `null` until the Apple flip. Grants legacy access to any
  iOS user whose original downloaded build is below it.

The RevenueCat public SDK keys live in `src/features/entitlement/config.ts`
(committed; overridable via `VITE_RC_IOS_KEY` / `VITE_RC_ANDROID_KEY`).

---

## Phase 0 — ship while still PAID (grandfathering)

Ship the subscription build with `RELEASE_PHASE = "paid"` to **production** on both
stores, still priced as paid. This stamps all current owners as legacy.

1. Merge the subscription branch to `main`.
2. `RELEASE_PHASE = "paid"` (default). Bump versionCode / build number.
3. **Android:** build a signed AAB, upload to the **Production** track, roll out.
4. **iOS:** run the `Build iOS App` workflow, submit the build (+ the 3 IAPs) for
   review with real paywall screenshots.
5. **Wait for meaningful adoption** before the flips — the longer Phase 0 is live,
   the more owners are stamped. (Android owners who never update in this window
   fall back to Auto Backup restore + the honor-system button.)

## Phase 1 — onboarding (fast-follow, before the flip)

Build/ship onboarding that explains free vs Pro. It only matters once free, so it
rides just ahead of the flip. Not required for Phase 0.

## Phase 2 — flip Apple → Free

1. Set `IOS_FREE_TRANSITION_BUILD` to the build number of the release you're about
   to ship as the first free version, and set `RELEASE_PHASE = "free"`.
2. Ship that iOS build (still paid at this point).
3. In App Store Connect → Pricing → set price to **Free**.
4. Validate: an existing owner who reinstalls is recognized via
   `originalApplicationVersion` (in production, not just sandbox — see checklist).

## Phase 3 — flip Google → Free (LAST, IRREVERSIBLE)

1. Confirm Phase 0 adoption on Android is as high as you're comfortable with.
2. Ship an Android build with `RELEASE_PHASE = "free"`.
3. Play Console → Monetize → App pricing → set to **Free**. **This cannot be
   undone.**

---

## Pre-flip verification checklist

- [ ] **Returning subscriber, production:** a real subscriber who reinstalls / gets
      a new phone lands unlocked (RevenueCat auto-syncs the StoreKit transaction) or
      unlocks via **Restore Purchases**. Sandbox can't prove this — verify in prod.
- [ ] **Legacy owner, Android:** an existing paid owner who updates to the Phase 0
      build shows Pro (stamped). After the free flip, a fresh install on the same
      Google account restores the flag via Auto Backup.
- [ ] **Legacy owner, iOS:** with `IOS_FREE_TRANSITION_BUILD` set, an existing owner
      is granted legacy access via original version.
- [ ] **Honor-system button** ("I bought this before it went free") grants access.
- [ ] Real iOS paywall screenshots replace the placeholders on all 3 products.
- [ ] Privacy policy has a "Purchases & Subscriptions" section; store data-safety /
      privacy labels updated to declare purchase data.
- [ ] `test/ios-paywall` throwaway branch deleted.

## Store product reference

| Tier | Apple | Google (product : base plan) | RevenueCat package |
|---|---|---|---|
| Monthly | `snm_pro_monthly` | `premium_monthly : monthly-trial` | `$rc_monthly` |
| Annual | `snm_pro_annual` | `premium_yearly : yearly-trial` | `$rc_annual` |
| Lifetime | `snm_lifetime` | `premium_lifetime` | `$rc_lifetime` |

Entitlement: **`Pro`** · Offering: **`default`** (current).
