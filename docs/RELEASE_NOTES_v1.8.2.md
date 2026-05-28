# Release Notes v1.8.2 — iOS clear-selections button hotfix

## Version Information
- **Version:** 1.8.2
- **versionCode (Android):** 81
- **Previous:** 1.8.1 (versionCode 80)
- **Date:** 2026-05-28

## Highlights (user-facing)

### Clear-selections (×) button restored on iOS
On iPhone the "clear all selected styles" × in the top-right of the Start bar was not visible (it worked on Android). Tapping it to clear selections is now possible again on iOS.

## Technical detail (root cause)
v1.8.1 made the Start bar (`StickyStartControls`) in-flow, which removed its `position: fixed` declaration and left the container as `position: static`. The × button is `position: absolute`, so with no positioned ancestor it fell back to an implicit containing block:
- **Android (Chromium WebView):** the container's `backdrop-filter` establishes a containing block, so the × anchored to the Start bar correctly — visible.
- **iOS (WebKit WKWebView):** `backdrop-filter` does not establish a containing block the same way, so the × anchored to the viewport's top-right (behind the status bar) — effectively invisible.

Fix: add `position: relative` to the `StickyStartControls` container so the absolute × has an explicit, cross-engine positioning context.

## Files changed (since v1.8.1)
- `src/features/workout/components/StickyStartControls.tsx` *(add `position: relative` to container)*
- `package.json`, `android/app/build.gradle` *(version bump)*

## Test plan
1. **iOS (TestFlight):** Setup screen → select a style → confirm the × appears at the top-right of the Start bar → tap it → all selections clear.
2. **Android (regression check):** Same flow → × still visible and clears selections.
3. **Smoke test:** Start workout → first round → first callout → rest → second round → complete.

## Rollback
If a P0 surfaces on Play Store:
1. Play Console → Production → Halt rollout (if staged).
2. Build a hotfix or upload prior signed AAB at versionCode 82+ (cannot reuse 80/81).

## Build instructions

```bash
npm install
npm run build
npx cap sync android
cd android
./gradlew bundleRelease
```

Output AAB: `android/app/build/outputs/bundle/release/app-release.aab`

## Play Store release notes (draft, ≤500 char)
```
Bug fix: on iPhone, the button to clear your selected styles is now visible again on the start screen.
```
