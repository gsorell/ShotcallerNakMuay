# Deployment Guide

This document outlines the deployment processes for Shotcaller Nak Muay across all platforms.

## Overview

| Platform | Method | Automation |
|----------|--------|------------|
| iOS | GitHub Actions → TestFlight → App Store | Fully automated |
| Android | Manual build → Play Console | Manual |
| Web/PWA | Netlify | Fully automated |

---

## iOS Deployment

### Prerequisites

- Apple Developer account with App Store Connect access
- GitHub secrets configured (see [GITHUB_ACTIONS_IOS_SETUP.md](./GITHUB_ACTIONS_IOS_SETUP.md))

### Triggering a Build

1. Go to [GitHub Actions](https://github.com/gsorell/ShotcallerNakMuay/actions/workflows/ios-build.yml)
2. Click **Run workflow**
3. Select branch (usually `main`)
4. Check **Upload to TestFlight** if you want automatic TestFlight distribution
5. Click **Run workflow**

### What the Workflow Does

1. Checks out code
2. Installs Node.js 22 and dependencies
3. Runs `npm run build` (TypeScript + Vite)
4. Syncs Capacitor (`npx cap sync ios`)
5. Imports code signing certificates from GitHub secrets
6. Downloads provisioning profiles
7. Builds IPA via xcodebuild
8. Uploads to TestFlight (if enabled)
9. Stores IPA as artifact (30-day retention)

### After TestFlight Upload

1. Open [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to your app → TestFlight
3. Wait for processing (usually 10-30 minutes)
4. Add testers or submit for App Store review

### Configuration Files

- Workflow: `.github/workflows/ios-build.yml`
- App config: `ios/App/App/Info.plist`
- Bundle ID: `com.shotcallernakmuay.app`

---

## Android Deployment

### Prerequisites

- Android Studio installed
- Keystore file (`shotcallernakmuay.jks`) in `android/app/`
- Google Play Console access

### Building the Release

```bash
# Sync Capacitor
npx cap sync android

# Navigate to android directory
cd android

# Build release AAB (recommended for Play Store)
./gradlew bundleRelease

# Or build APK
./gradlew assembleRelease
```

### Output Locations

- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- APK: `android/app/build/outputs/apk/release/app-release.apk`

### Uploading to Play Store

1. Open [Google Play Console](https://play.google.com/console)
2. Select your app
3. Go to **Release** → **Production** (or testing track)
4. Click **Create new release**
5. Upload the AAB file
6. Add release notes
7. Submit for review

### Version Management

Update version in `android/app/build.gradle`:
- `versionCode` - Increment for each upload (integer)
- `versionName` - User-facing version string

### Configuration Files

- Build config: `android/app/build.gradle`
- Signing: `android/app/keystore.properties`
- SDK versions: `android/variables.gradle`
- App ID: `com.shotcallernakmuay.app`

---

## Web/PWA Deployment

### Automatic Deployment

The PWA deploys automatically via Netlify when changes are pushed to `main`.

### Manual Deployment

```bash
# Build the app
npm run build

# Preview locally
npm run preview
```

### Netlify Configuration

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Node version: 22

### Configuration Files

- Netlify: `netlify.toml`
- PWA manifest: `public/manifest.json`
- Service worker: `public/sw.js`

---

## Capacitor Sync

After making changes to the web app, sync to native platforms:

```bash
# Sync all platforms
npx cap sync

# Sync specific platform
npx cap sync ios
npx cap sync android

# Open in native IDE
npx cap open ios
npx cap open android
```

---

## Version Checklist

When releasing a new version:

1. [ ] Update version in `package.json`
2. [ ] Update `versionCode` and `versionName` in `android/app/build.gradle`
3. [ ] Commit changes
4. [ ] Push to `main` (triggers PWA deploy)
5. [ ] Trigger iOS build via GitHub Actions
6. [ ] Build and upload Android manually

---

## Troubleshooting

### iOS Build Fails

- Check GitHub Actions logs for specific errors
- Verify secrets are correctly configured
- Ensure provisioning profile matches bundle ID
- Check certificate expiration dates

### Android Build Fails

- Run `./gradlew clean` and rebuild
- Verify keystore password in `keystore.properties`
- Check SDK versions in `variables.gradle`

### PWA Not Updating

- Clear browser cache
- Check Netlify deploy logs
- Verify service worker is updating correctly
