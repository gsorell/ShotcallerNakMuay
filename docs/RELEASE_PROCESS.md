# Release Process

End-to-end process for shipping a new version of Shotcaller Nak Muay across iOS, Android, and Web.

This document covers **what humans do for each release** (version bumps, store listings, release notes, coordination, rollback). For build mechanics and one-time CI setup see:
- [DEPLOYMENT.md](./DEPLOYMENT.md) — how each platform builds and deploys
- [GITHUB_ACTIONS_IOS_SETUP.md](./GITHUB_ACTIONS_IOS_SETUP.md) — one-time iOS CI configuration

---

## 1. Version bump

A release starts with a version bump. Three places must agree on the marketing version:

| File | Field | Notes |
|---|---|---|
| [package.json](../package.json) | `version` | Source of truth. iOS reads this automatically in CI. |
| [android/app/build.gradle](../android/app/build.gradle) | `versionName` | Must match `package.json`. |
| [android/app/build.gradle](../android/app/build.gradle) | `versionCode` | **Integer, must strictly increase.** Play Console rejects duplicates. |

iOS `CFBundleVersion` (build number) is set from `github.run_number` automatically by the workflow — do not edit `Info.plist`.

### Bump checklist

- [ ] Decide semver bump (patch / minor / major).
- [ ] Update `version` in `package.json`.
- [ ] Update `versionName` in `android/app/build.gradle` to the same value.
- [ ] Increment `versionCode` in `android/app/build.gradle` by 1.
- [ ] Verify the three numbers in a single grep before committing:
  ```bash
  grep -E '"version"|versionName|versionCode' package.json android/app/build.gradle
  ```
- [ ] Commit: `chore: bump to vX.Y.Z`.

---

## 2. Release notes

Three audiences, three places. Write each one — they are NOT interchangeable.

### 2a. Internal release notes — `docs/RELEASE_NOTES_vX.Y.Z.md`

Engineering-facing. Include root cause, files changed, test plan. Use [docs/RELEASE_NOTES_v1.4.6.md](./RELEASE_NOTES_v1.4.6.md) as a template.

### 2b. App Store "What's New" — App Store Connect

User-facing, ~4000 char limit. Plain prose, no markdown. Mention only what a user can perceive. Submitted with the build for review.

### 2c. Play Store release notes — Play Console

User-facing, **500 char hard limit per locale**. Submitted per release in the Play Console UI when creating the release.

> **Keep all three in sync at release time.** A common failure mode is shipping a Play Store update with no release notes because Play accepts the AAB without them.

---

## 3. Store listing updates (when needed)

Listing copy/screenshots/icons are *not* part of every release. Update only when they change. Track these as separate tasks.

### App Store Connect
- Screenshots (per device class: 6.7", 6.5", 5.5", iPad)
- App description, promotional text, keywords
- Support URL, marketing URL, privacy policy URL → [docs/PRIVACY_POLICY.md](./PRIVACY_POLICY.md)
- Age rating questionnaire
- Export compliance (ITSAppUsesNonExemptEncryption = `false` is already declared in [ios/App/App/Info.plist:50](../ios/App/App/Info.plist#L50))

### Play Console
- Screenshots (phone + tablet)
- Short description (80 char), full description (4000 char)
- Feature graphic (1024×500), icon (512×512)
- Content rating questionnaire
- Data safety form (review annually or when data flows change)
- Target audience and content

### Netlify
- Custom domain settings, DNS, HTTPS cert — Site settings → Domain management
- Environment variables — Site settings → Environment variables (none currently required for build)
- Deploy notifications — Site settings → Build & deploy → Deploy notifications

---

## 4. Release sequence

Default order when shipping all three surfaces together:

1. **Merge to `main`** → Netlify auto-deploys PWA. Verify the site is healthy before continuing (smoke-test [shotcallernakmuay.com](https://shotcallernakmuay.com) or the configured Netlify URL).
2. **Trigger iOS workflow** (`Actions` → `Build iOS App` → Run workflow with `upload_to_testflight=true`). Wait for TestFlight processing (10–30 min), then submit for review in App Store Connect.
3. **Build Android AAB locally** (`npx cap sync android && cd android && ./gradlew bundleRelease`) and upload to Play Console. Choose a track (Internal → Closed → Production) and a staged rollout percentage.

**Why this order:** The PWA is fastest to roll back (re-deploy previous commit) so it acts as the canary. iOS review can take 24–48h, so kick it off early. Android can be staged at 10% to limit blast radius.

If a release is *only* a native fix (no web changes), you can skip step 1 — but `package.json` still must be bumped, since iOS CI reads it.

---

## 5. Post-release verification

For each surface, after rollout begins:

- [ ] **Web:** Hard refresh in an incognito window; confirm the new version string is visible (check the about/help screen or `window.localStorage` if version is surfaced there).
- [ ] **iOS:** Install the build from TestFlight on a real device. Smoke-test the golden path (start workout → first round → first callout → rest → second round → complete).
- [ ] **Android:** Install from the Play Console internal track on a real device. Same smoke-test.
- [ ] **Analytics:** Confirm GA4 is receiving events from the new version ([src/utils/analytics.ts](../src/utils/analytics.ts), measurement ID `G-5GY5JTX5KZ`).
- [ ] **Crash reports:** Watch Play Console Vitals and App Store Connect Crashes for 24h after rollout.

---

## 6. Rollback

### Web (Netlify)
1. Netlify dashboard → Deploys → find the previous good deploy → **Publish deploy**.
2. Hard refresh to confirm the service worker picks up the older bundle.

Time to roll back: ~30 seconds.

### iOS (App Store)
You cannot remove a build users have already downloaded. Options:
1. **If not yet released:** Reject the build in App Store Connect before phased release starts.
2. **If released:** Ship a new patch version with the fix. App Store has no "revert to previous binary" affordance.
3. **Phased release:** Pause phased release in App Store Connect → Version → Phased Release for Automatic Updates.

Time to roll back: hours to days (expedited review possible for severe issues).

### Android (Play Store)
1. Play Console → Production (or affected track) → **Halt rollout** if staged.
2. Re-upload the prior good AAB as a **new release** with a higher `versionCode` than the broken one (you cannot reuse an old `versionCode`). Keep an "emergency rollback" AAB built and signed locally for fast turnaround.

Time to roll back: minutes (halt) to hours (replacement release).

---

## 7. Per-release checklist (copy this into the PR description)

```
## Release checklist — vX.Y.Z

### Code
- [ ] `package.json` version bumped to X.Y.Z
- [ ] `android/app/build.gradle` versionName matches, versionCode incremented
- [ ] All three values agree (grep verified)

### Docs
- [ ] `docs/RELEASE_NOTES_vX.Y.Z.md` written
- [ ] App Store "What's New" copy drafted
- [ ] Play Store release notes drafted (≤500 char)

### Build & deploy
- [ ] Merged to main → Netlify deploy green
- [ ] iOS workflow run → TestFlight processed → submitted for review
- [ ] Android AAB built → uploaded to Play Console → track selected

### Verification
- [ ] Web smoke-test passed
- [ ] iOS TestFlight smoke-test passed
- [ ] Android internal-track smoke-test passed
- [ ] GA4 receiving events from new version
- [ ] No spike in crash reports after 24h
```
