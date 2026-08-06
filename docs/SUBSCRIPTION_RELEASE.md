# Subscription Migration — Release Runbook

Taking the app from **paid** to **free + subscription (+ lifetime)** without
losing existing owners.

**Status as of 2026-08-06:** Android is one step from done — v88 is uploaded and
awaiting review, and the only remaining Android action is the price flip. iOS
has not started.

---

## Where things stand

| Phase | State |
|---|---|
| Phase 0 — Android stamping build (v87) | ✅ Live in Production since 2026-08-05 |
| Android v88 — free build + grandfather cutoff | ⏳ Uploaded 2026-08-06, in review |
| **Android price flip → Free** | ⬜ **Must happen before Sun 2026-08-09 23:59 ET** |
| iOS Phase 2 — free build + IAP submission | ⬜ Not started |
| iOS price flip → Free | ⬜ Not started |

---

## The release switch

Everything code-side lives in `src/features/entitlement/releaseConfig.ts`:

| Constant | Now | Meaning |
|---|---|---|
| `RELEASE_PHASE` | `"free"` | Stamping is OFF. Was `"paid"` for v87. |
| `ANDROID_FREE_TRANSITION_DATE` | `1786334340000` | Sun 2026-08-09 23:59 ET |
| `IOS_FREE_TRANSITION_BUILD` | `null` | ⚠️ **Still unset — see iOS section** |
| `LEGACY_CLAIM_WINDOW_DAYS` | `90` | Manual claim closes 90 days after the flip |

---

## How existing owners are recognised

Four independent mechanisms, in the order `evaluate()` applies them. An owner
only needs one to work.

1. **The Phase 0 stamp.** v87 stamps every Android install as a legacy owner on
   launch. Anyone still on v87 gets stamped whenever they next open the app —
   including after the flip.
2. **Android Auto Backup.** The stamp lives in Capacitor Preferences, covered by
   Auto Backup, so it restores on reinstall on the same Google account.
3. **`firstInstallTime`** (the `InstallInfo` native plugin). A device that
   installed the app before `ANDROID_FREE_TRANSITION_DATE` installed it while
   the app still cost money — so that user paid. **This is retroactive and
   permanent**: an owner who updates to v88 months later and opens it then is
   still recognised.
4. **iOS `originalApplicationVersion`.** The iOS equivalent, gated on
   `IOS_FREE_TRANSITION_BUILD`. Currently inactive.

Last resort: the manual claim in the paywall, which asks for the store order
number, records the claim, and closes after `LEGACY_CLAIM_WINDOW_DAYS`.

### Why adoption no longer gates the flip

The original plan required waiting for v87 adoption, because stamping needed the
user to open the app *before* the flip. `firstInstallTime` removed that
constraint — it works whenever the user gets round to opening v88.

**The real gate is now v88 being Live at 100% rollout before the flip.** If the
stamping build were still newest when the price changed, every new free
installer would be stamped as a legacy owner and get Pro forever.

Residual uncovered case: an owner who uninstalled before the flip and reinstalls
afterwards on a fresh device — new install time, no backed-up flag. That is what
the manual claim window exists for.

---

## ⚠️ The cutoff is a deadline, not a target

`ANDROID_FREE_TRANSITION_DATE` grandfathers anyone who installed **before** it.
Its failure modes are asymmetric:

- **Flip before the cutoff** → a few free installs in the gap get Pro. Cheap.
- **Flip after the cutoff** → anyone who **paid** in the gap is locked out.
  Expensive: a real customer, denied what they bought.

If the deadline is going to slip, **rebuild with a later cutoff before flipping.**
It is a one-line change, but it must ship first — it cannot be fixed afterwards
for anyone who already installed.

---

## Remaining: Android

1. Wait for Play review; confirm the release shows **Live** at **100%** rollout.
2. Play Console → Monetize → App pricing → set to **Free**.
   **This cannot be undone**, and must happen before the cutoff above.
3. Spot-check afterwards: a fresh install shows the free tier with locks and a
   reachable paywall; an existing owner still shows Pro.

## Remaining: iOS

⚠️ **`IOS_FREE_TRANSITION_BUILD` is `null` while `RELEASE_PHASE` is `"free"`.**
Do not cut an iOS build from `main` as it stands. The stamp is Android-only by
design, so `originalApplicationVersion` is iOS's *only* grandfathering
mechanism — with it unset, every existing iPhone owner would hit a paywall.

1. Run the **Build iOS App** workflow once; note the run number (the CI uses it
   as `CFBundleVersion`).
2. Set `IOS_FREE_TRANSITION_BUILD` to that number, commit, re-run the workflow.
3. Confirm all three IAPs have real paywall screenshots.
4. Submit the version **with the 3 IAPs attached**. Because `RELEASE_PHASE` is
   `"free"`, the reviewer's fresh install lands on the free tier and can reach
   and test the paywall — a stamping build would hide it and get the IAPs
   rejected as untestable.
5. On approval, **release the build and set the App Store price to Free
   together.**

---

## Verification checklist

- [x] Legacy owner, Android: existing owner on the Phase 0 build shows Pro
- [x] `firstInstallTime` grant path: install before the cutoff → Pro, no locks
- [x] `firstInstallTime` deny path: install after the cutoff → free tier, locks
- [x] Custom native plugins present in the bridge (`InstallInfo`, `AudioSession`)
- [x] Privacy policy has a Purchases & Subscriptions section; Play listing URL
      points at the real policy page
- [ ] **Returning subscriber, production:** a real subscriber who reinstalls
      lands unlocked, or unlocks via Restore. Sandbox cannot prove this
- [ ] Manual claim grants access and is recorded
- [ ] Legacy owner, iOS: with `IOS_FREE_TRANSITION_BUILD` set, an existing owner
      is granted access via original version
- [ ] Real iOS paywall screenshots on all 3 Apple products

---

## Store product reference

| Tier | Apple | Google (product : base plan) | RevenueCat package |
|---|---|---|---|
| Monthly | `snm_pro_monthly` | `premium_monthly : monthly-trial` | `$rc_monthly` |
| Annual | `snm_pro_annual` | `premium_yearly : yearly-trial` | `$rc_annual` |
| Lifetime | `snm_lifetime` | `premium_lifetime` | `$rc_lifetime` |

Entitlement: **`Pro`** · Offering: **`default`** (current) ·
Prices: $3.99 / $24.99 / $39.99

## Build reference

```bash
npm run build
npx cap sync android
JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" \
  ./android/gradlew.bat -p android bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

`npx cap sync` also rewrites `capacitor.build.gradle` and
`capacitor.settings.gradle` with LF endings — pure churn, revert rather than
commit. A stale `app-v86-stampoff-TEST.aab` sits in the same output folder;
never upload it, stamping is off in it.

**Testing tip:** `VITE_RC_ANDROID_KEY=""` isolates RevenueCat out of a build
with no code edits (empty string is falsy, so the provider takes its
no-API-key path), which is how the grandfather paths were verified in
isolation. `adb shell pm clear` resets app state without changing
`firstInstallTime`.

**Native plugins must be registered BEFORE `super.onCreate()`** in
`MainActivity` — `registerPlugin()` only appends to `bridgeBuilder`, and
`super.onCreate()` is what calls `bridgeBuilder.create()`. Registering after
it silently does nothing. Verify with
`adb logcat | grep "Registering plugin instance"`.
