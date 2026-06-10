# Release Notes v1.9.0 — Achievement Charms

## Version Information
- **Version:** 1.9.0
- **versionCode (Android):** 82
- **Previous:** 1.8.2 (versionCode 81)
- **Date:** 2026-06-10

## Highlights (user-facing)

### 1. Achievement charms
The streak-only collectible system now sits inside a general charm engine. In addition to the six streak milestones (Pra Jiad → Arjarn), there are six new charms earned from how you train — not just how many days in a row. Each fires a full-screen celebration on the workout-complete screen the first time it's earned, then lives in the Logs Summary trophy case.

| Charm | Earned by |
|---|---|
| First Blood 🩸 | Completing your first workout |
| Ten Toward Glory 🔟 | 10 total workouts |
| Double Session 🌅 | More than 5 rounds in a single day |
| Century Club 💯 | 100 total rounds completed |
| Jack of All Trades 🎒 | Training 5 different styles |
| Mat · Tae · Khao 🥋 | Training the heavy-hands, kicks, and knees archetypes |

### 2. Shareable charms
Every charm is now shareable, just like the workout completion card. The celebration modal renders a branded charm card you can **Save** or **Share** via the native share sheet (Capacitor) or Web Share API. This applies to streak charms too, which previously could only be dismissed.

### 3. Tap-to-share trophy case + "next charm" teaser
Earned charms in the Logs Summary are now tappable to reopen their shareable card. The trophy case also surfaces up to two **locked** charms greyed-out with live progress (e.g. `🔒 61/100`) so the next goal is visible — a gentle pull back into the app.

## Other changes
- **Migration:** `seedAwardedCharmsOnce()` runs once at startup for users who already have workout history when this version ships, silently marking their already-earned charms as awarded so they don't get a flood of celebration modals on their next workout. Brand-new users still get the full first-earn celebration for each charm.
- The celebration modal adopts the same icon-button + `isCapturing` share/save pattern used on the workout completion screen for consistency.
- `chore`: Vite dev-server watcher now ignores `android/` and `ios/` to prevent a Windows `scandir UNKNOWN` crash (Capacitor copies builds into those trees).

## Files changed (since v1.8.2)
- `src/features/logs/constants/charms.ts` *(new — charm catalog + predicates)*
- `src/features/logs/utils/charms.ts` *(new — earned/claim/persist + one-time seed)*
- `src/features/logs/components/CharmCelebrationModal.tsx` *(new — shareable celebration modal)*
- `src/features/logs/components/StreakCelebrationModal.tsx` *(now delegates to the shared modal)*
- `src/features/logs/components/CharmTrophyCase.tsx` *(earned + locked-teaser rendering, tap-to-share)*
- `src/features/logs/components/WorkoutCompleted.tsx` *(celebration queue: streak then charms)*
- `src/features/logs/index.ts`
- `src/constants/storage.ts` *(new `CHARMS_STORAGE_KEY`, `CHARMS_SEEDED_FLAG`)*
- `src/utils/imageUtils.ts` *(new `shareCharmImage`)*
- `src/App.tsx` *(calls `seedAwardedCharmsOnce` at startup)*
- `scripts/dev-seed-charms.js` *(new dev helper)*
- `vite.config.ts` *(dev-watcher ignores native folders)*

## Test plan
1. **First-earn celebrations (fresh install)**
   - Wipe localStorage. Complete your first workout → First Blood modal fires once on the completion screen.
   - Confirm Save downloads a PNG of the charm card and Share opens the share sheet (or Web Share on web).
   - Complete a session with >5 rounds in one day → Double Session fires.

2. **Seed demo / trophy case**
   - Run `scripts/dev-seed-charms.js` in the console → Logs Summary shows earned streak charms (3d, 7d) + First Blood, Ten Toward Glory, Double Session, Jack of All Trades, Mat·Tae·Khao, plus Century Club as a locked teaser (`🔒 61/100`).
   - Tap any earned charm → its shareable card reopens. Verify the branding/logo renders in the saved PNG (html2canvas).

3. **Migration (existing user, no celebration backlog)**
   - With pre-existing workout history and no `shotcaller_charms_seeded` flag, load the app → no modal fires at startup; earned charms still appear in the trophy case. The next completed workout only celebrates genuinely new charms.

4. **Smoke test (golden path)**
   - Start workout → "Get ready" → first round bell → first callout → rest with 10s warning → second round → complete.
   - Verify GA4 receives `workout_complete` events from version 1.9.0.

## Rollback
- **Web (Netlify):** Deploys → previous good deploy → Publish deploy (~30s).
- **Android:** Play Console → Halt rollout (if staged) → upload prior signed AAB at versionCode 83+ (cannot reuse 81).
- **iOS:** Reject build before phased release, or ship a patch.

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

---

## App Store "What's New" (draft — plain prose, no markdown)

Earn charms for how you train, not just how often. New achievements unlock for your first workout, exploring different styles, big-volume days, and hitting 100 total rounds — on top of the existing daily-streak charms. Every charm is now shareable: save it or post it straight from the celebration screen. Your trophy case also shows your next goal so you always know what's coming up.

## Play Store release notes (draft — ≤500 chars)

New achievement charms! Earn collectibles for your first workout, training 5+ styles, 5+ rounds in a day, and 100 total rounds — alongside your daily-streak charms. Every charm is now shareable: save or post it from the celebration screen. Your trophy case shows the next goal you're working toward, too.
