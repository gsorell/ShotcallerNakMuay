# Shotcaller Nak Muay

Muay Thai training timer that calls out techniques via text-to-speech during shadowboxing and bagwork. Ships as a PWA (Netlify), iOS app (App Store), and Android app (Play Store) from a single React + Capacitor codebase.

**Current version:** see [package.json](./package.json) (`version` field).

## Quick start

```bash
npm install
npm run dev          # Vite dev server
npm run build        # Production build → dist/
npm test             # Vitest
```

Native:

```bash
npx cap sync         # Sync web build → ios/ and android/
npx cap open ios     # Open Xcode
npx cap open android # Open Android Studio
```

## Documentation

| Topic | File |
|---|---|
| Codebase architecture | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| **How to ship a release** (version bumps, release notes, store listings, rollback) | [docs/RELEASE_PROCESS.md](./docs/RELEASE_PROCESS.md) |
| Build & deploy mechanics per platform | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) |
| iOS CI one-time setup | [docs/GITHUB_ACTIONS_IOS_SETUP.md](./docs/GITHUB_ACTIONS_IOS_SETUP.md) |
| Mobile testing | [docs/MOBILE_TESTING_GUIDE.md](./docs/MOBILE_TESTING_GUIDE.md) |
| Privacy policy | [docs/PRIVACY_POLICY.md](./docs/PRIVACY_POLICY.md) |
| Release notes (per version) | [docs/RELEASE_NOTES_v*.md](./docs/) |

## Platforms

| Surface | Deploys via | Trigger |
|---|---|---|
| Web / PWA | Netlify | Push to `main` (auto) |
| iOS | GitHub Actions → TestFlight | Manual `workflow_dispatch` |
| Android | Local `./gradlew bundleRelease` → Play Console | Manual |

Bundle ID / app ID: `com.shotcallernakmuay.app` on both stores.

## Tech stack

React 19 · TypeScript · Vite · Capacitor 8 · Vitest. See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full breakdown.
