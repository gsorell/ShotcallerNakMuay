# Release Notes — v1.23.0

**Date:** 2026-10-08
**versionCode:** 110
**Type:** Feature. A store-rating prompt, a stance question in onboarding with
southpaw mode made free, the move to `shotcallermuaythai.app`, and a roadmap
header fix. This release adds a native plugin and changes the deep-link hosts
both apps claim. No change to the callout engine, purchases, or audio.

---

## Summary

Four things have landed on `main` since v1.22.0 was built. Two are user-facing
features, one is the domain move reaching the native apps for the first time,
and one is a small fix.

---

## 1. Store rating prompt

After a session is finished in full, the completion screen asks the OS for its
rating sheet about 1.5 s later. Native only.

- Neither store reports whether the sheet was shown or used, so the limit is a
  budget: **two asks per install**, at 5 and 20 finished workouts, on at least
  two training days, 60 days apart.
- No further asks once the user has opened the store's review page from the new
  **Rate Shot Caller** row in the app menu.
- It stands down when the completion screen was reopened from the logs, when
  the session was stopped early, when the post-workout upsell or onboarding took
  that sitting, and while a charm celebration is open.
- New events: `review_requested`, `review_store_open`.

Adds `@capawesome/capacitor-app-review` 8.1.0 and its synced native entries.

[src/features/review/](../src/features/review/)

## 2. Stance in onboarding; southpaw mode is free

The onboarding name step now also asks which stance the user trains in, and sets
southpaw mode from the answer. It is applied on the tap, so it survives Skip.

Southpaw mode was Pro-locked in Session Settings while the callout engine
applied it ungated — and onboarding is only shown to free users — so a free user
who picked Southpaw would have had mirrored callouts and no way to turn them
off. The toggle moves out of the Pro-tagged Callouts section into its own
**Stance** section and is free.

[src/utils/southpawPreference.ts](../src/utils/southpawPreference.ts)

## 3. shotcallermuaythai.app

The site's primary domain is now `shotcallermuaythai.app`, and this is the first
native build to know about it.

- Share links are minted on the new host, and every in-app link points at it.
- Both apps now claim `/s/` on **both** hosts: the Android intent filter and
  the iOS associated domains list the new one alongside the old.
- Builds up to v1.22.0 claim only the old host, so a new-domain link sent to
  someone who has not updated opens the browser import rather than the app.

Reasoning is in [DEEP_LINKS.md](./DEEP_LINKS.md) under "Two hosts".

## 4. Roadmap header

The Start Here header ran its Pro chip under the app menu button; the row now
stops short of that corner. The unlock banner said "Level 1 is free" though
levels 1–3 have been free since v1.17.0; it now counts the free levels from the
path data.

---

## Files changed

| Area | Files |
|---|---|
| Review prompt | `features/review/*`, `WorkoutCompleted.tsx`, `AppMenu.*`, `constants/storeLinks.ts`, `utils/analytics.ts` |
| Stance | `OnboardingFlow.tsx`, `RoundStructureSheet.tsx`, `useWorkoutSettings.ts`, `utils/southpawPreference.ts` |
| Domain | `AndroidManifest.xml`, `App.entitlements`, `index.html`, `netlify.toml`, site and blog pages |
| Roadmap | `RoadmapSection.*` |
| Native plugin | `capacitor.build.gradle`, `capacitor.settings.gradle`, `CapApp-SPM/Package.swift` |

Commits: `982cad6`, `f049cec`, `658ef72`, `abb3b08`.

---

## Test plan

**Automated:** 356 tests across 27 files pass, `tsc -b` clean.
`reviewPrompt.test.ts` covers the ask budget and the stand-down rules.

**Not verified before this build:** the rating sheet itself and the new-domain
deep links. Both only exist in a store-signed native build, so this build is the
first place either can be exercised. Neither platform was run on a device from
this commit.

**Deep-link verification files:** confirmed live on the new host before
building — `/.well-known/assetlinks.json` and
`/.well-known/apple-app-site-association` both return 200 as
`application/json`. Verification runs at install time and does not retry, so
this had to be true first.

### Manual smoke test

- [ ] Golden path: start a workout, first callout, rest, second round, complete.
- [ ] Finish five workouts across two days — the OS rating sheet is requested
      once, on the completion screen.
- [ ] App menu → Rate Shot Caller opens the store's review page.
- [ ] Fresh install, onboarding: pick Southpaw — callouts are mirrored, and the
      Stance toggle in Session Settings is on and can be switched off without
      Pro.
- [ ] A `shotcallermuaythai.app/s/…` link opens the app on both platforms.
- [ ] A `shotcallernakmuay.netlify.app/s/…` link still opens the app.
- [ ] Start Here: the Pro chip clears the menu button.
