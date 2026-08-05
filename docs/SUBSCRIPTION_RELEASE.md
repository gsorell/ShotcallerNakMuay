# Subscription Migration — Release Runbook

How to take the app from **paid** to **free + subscription (+ lifetime)** without
losing existing owners. Follow the phases in order. The store price flips are at
the very end and, for Google, **irreversible**.

## The one hard rule (Android)

**On Android, the Phase 0 build must ship while the app is still PAID.** That
build stamps every current install as a legacy owner, because Android has no
retroactive ownership signal — flip Google to free before Phase 0 is adopted and
those owners cannot be recovered.

**iOS is different — it does NOT stamp.** iOS grandfathers via
`originalApplicationVersion` (retroactive, works forever), so it needs no
separate paid-first build. Critically, this keeps the paywall **reachable for new
installs**, including Apple's App Review team — a stamping build would auto-
grandfather the reviewer and hide the paywall, getting the IAPs **rejected as
untestable**. So the Apple IAPs must be submitted with a `RELEASE_PHASE = "free"`
build, never a stamping one.

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

## Phase 0 — ANDROID: ship while still PAID (grandfathering)

Ship the Android subscription build with `RELEASE_PHASE = "paid"` to the
**Production** track, still priced as paid. This stamps all current Android owners
as legacy. (The stamp is Android-only; the same `RELEASE_PHASE = "paid"` build is
NOT used for the iOS submission — see Phase 2.)

1. Merge the subscription branch to `main`.
2. `RELEASE_PHASE = "paid"`. Bump versionCode.
3. Build a signed AAB, upload to the Android **Production** track, roll out.
4. **Wait for meaningful adoption** before flipping Google — the longer this is
   live, the more owners are stamped. (Owners who never update fall back to Auto
   Backup restore + the honor-system button.)

## Phase 1 — onboarding (fast-follow, before the flips)

Build/ship onboarding that explains free vs Pro. It only matters once free, so it
rides just ahead of the flips. Not required for Phase 0.

## Phase 2 — iOS: submit subscription build + IAPs, then flip → Free

iOS needs no separate paid Phase 0. Ship one build that carries the IAPs and
grandfathers via original version, then flip the price.

1. Set `RELEASE_PHASE = "free"` and `IOS_FREE_TRANSITION_BUILD` to the
   **CFBundleVersion (build number)** of the build you're about to submit (the CI
   sets CFBundleVersion = the GitHub Actions run number, so use that run's
   number). Existing owners' original build is below it → grandfathered; a fresh
   install (incl. the reviewer) is not → paywall reachable.
2. Run the `Build iOS App` workflow; the IAPs must have real paywall screenshots.
3. In App Store Connect, submit the app version **with the 3 IAPs attached** for
   review. Because `RELEASE_PHASE = "free"`, the reviewer's fresh install lands on
   the free tier and can reach + test the paywall.
4. On approval, **release the build and set the App Store price to Free together**
   (Pricing → Free), so no new buyer pays for what is now free-tier content.
5. Validate the returning-owner path in production (see checklist).

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
- [ ] Apple IAPs submitted with a `RELEASE_PHASE = "free"` iOS build (paywall
      reachable for the App Review team), NEVER a stamping (`"paid"`) build.
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
