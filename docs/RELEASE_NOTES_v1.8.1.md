# Release Notes v1.8.1 — Bottom-bar spacing & content-only scrollbar

## Version Information
- **Version:** 1.8.1
- **versionCode (Android):** 80
- **Previous:** 1.8.0 (versionCode 79)
- **Date:** 2026-05-28

## Highlights (user-facing)

### 1. "Let's Go!" clears the system navigation
On Android the Start bar sat too close to the back/home/recents buttons. The bar's bottom padding now adds the device's bottom safe-area inset (`env(safe-area-inset-bottom)`) on top of the existing gap, so the button stays comfortably above the system navigation on edge-to-edge devices.

### 2. Scrollbar stays in the content
The page previously scrolled at the document level while the Start bar was `position: fixed`, so the scroll indicator ran the full viewport height and visually overlapped the bar. The layout is now a fixed-height flex shell (`100dvh`): header on top, a single scrollable content region in the middle, and the Start bar as an in-flow item at the bottom. The scrollbar lives inside the content region and ends at the bar's top edge.

## Technical detail (root cause)
- A document/body scrollbar's track always spans the full viewport, so it cannot be clipped above a `position: fixed` footer. The fix moves scrolling off the document onto a contained `.app-scroll` region whose box ends where the in-flow bottom bar begins.
- `StickyStartControls` was lifted out of `WorkoutSetup` into a new `bottomBar` slot on `AppLayout` so it renders as a flex sibling below the scroll region (no longer fixed). This also removed the old 200px/32px clearance hack on the links footer.
- Because the body no longer scrolls, `window.scrollTo({ top: 0 })` no longer reaches the content. Added `src/utils/scroll.ts` (`scrollContentToTop`) targeting `.app-scroll`, and routed the existing scroll-to-top call sites (logo, session start/resume, logs mount, technique-editor fallback) through it. `scrollIntoView`-based paths keep working unchanged.

## Other changes
- `tsconfig.app.json`: removed the deprecated `baseUrl` option (slated for removal in TypeScript 7.0) and made the `@/*` path mapping config-relative (`["./src/*"]`). Vite alias is configured separately, so imports are unaffected.

## Files changed (since v1.8.0)
- `src/features/shared/components/AppLayout.tsx` *(flex shell + bottomBar slot + scroll reset)*
- `src/features/shared/components/AppLayout.css` *(`.app-shell` / `.app-scroll` flex layout)*
- `src/features/shared/components/Footer.tsx` *(removed fixed-bar clearance hack)*
- `src/features/workout/components/StickyStartControls.tsx` *(in-flow + safe-area-inset-bottom padding)*
- `src/features/workout/components/WorkoutSetup.tsx` *(Start bar removed from here)*
- `src/features/workout/contexts/WorkoutProvider.tsx` *(scroll-to-top via helper)*
- `src/features/logs/components/WorkoutLogs.tsx` *(scroll-to-top via helper)*
- `src/features/technique-editor/components/TechniqueEditor.tsx` *(scroll-to-top fallback via helper)*
- `src/App.tsx` *(renders `StickyStartControls` as `bottomBar`; logo scroll via helper)*
- `src/utils/scroll.ts` *(new — `scrollContentToTop`)*
- `tsconfig.app.json` *(drop deprecated `baseUrl`)*
- `package.json`, `android/app/build.gradle` *(version bump)*

## Test plan
1. **Bottom-bar spacing (Android device)**
   - Setup screen → select a style so the Start bar appears.
   - Confirm "Let's Go!" sits clearly above the back/home/recents buttons (gesture-nav and 3-button nav).
2. **Content-only scrollbar**
   - Scroll the style list → the scroll indicator stays within the content area and does not overlap the Start bar.
   - With a style selected (taller bar with difficulty pills) on a short viewport, the content area shrinks and the bar stays fully visible.
3. **Scroll-to-top still works**
   - Navigate Logs → tap logo / footer logo → returns to top.
   - Start a workout then stop → content is at top.
   - Technique editor → duplicate a group → view scrolls to the new group.
4. **Smoke test (golden path)**
   - Start workout → "Get ready" → first round bell → first callout → rest with 10s warning → second round → complete.
   - Verify GA4 receives `workout_complete` events from version 1.8.1.

## Rollback
If a P0 surfaces on Play Store:
1. Play Console → Production → Halt rollout (if staged).
2. Build a hotfix or upload prior signed AAB at versionCode 81+ (cannot reuse 79).

## Build instructions

```bash
# From repo root
npm install
npm run build
npx cap sync android
cd android
./gradlew bundleRelease
```

Output AAB: `android/app/build/outputs/bundle/release/app-release.aab`

Upload to Play Console → Production (or Internal first). Add Play Store release notes from the draft below.

## Play Store release notes (draft, ≤500 char)
```
Polish update: the "Let's Go!" button now sits comfortably above your phone's navigation buttons, and the scroll indicator stays within the list instead of overlapping the start controls.
```
