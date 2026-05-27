# Release Notes v1.8.0 — Streak Charms & Inline Quick-Edit

## Version Information
- **Version:** 1.8.0
- **versionCode (Android):** 79
- **Previous:** 1.7.0 (versionCode 78)
- **Date:** 2026-05-27

## Highlights (user-facing)

### 1. Streak charms
Six Muay Thai-themed milestones earned at consecutive workout-day streaks. A full-screen celebration modal fires once on the workout-complete screen the first time each threshold is crossed; earned charms then persist as a third row in the Summary card on the Logs page. Future milestones stay hidden — discovering the next one is part of the experience.

| Streak | Charm |
|---|---|
| 3 days | Pra Jiad — the student's armband |
| 7 days | Mongkol — sacred fight headband |
| 14 days | Bronze Belt |
| 30 days | Kru — Silver Belt |
| 60 days | Gold Belt |
| 100 days | Arjarn — master tier |

### 2. Inline technique quick-edit
Each style tile in the Choose Your Fighting Style picker can now be expanded inline to add/remove single techniques and combos without leaving the setup screen. Tile-level edits open the full editor pre-scrolled to that group via a new `editorFocusKey` on `UIProvider`.

### 3. Cleaner workout setup footer
- Removed the standalone `WorkoutConfiguration` panel. Rounds, length, rest, and difficulty all live in `StickyStartControls` now.
- The "clear selected styles" `×` moved out of the Rounds/Length/Rest grid (where it crowded the REST column) to the footer's top-right corner. Hidden when nothing is selected.

## Other changes
- README rewritten from the Vite template to a real project intro with links to architecture, deployment, and the new release-process doc.
- New [docs/RELEASE_PROCESS.md](./RELEASE_PROCESS.md) documenting the full ship procedure.
- `@capacitor/preferences` synced into the Android Gradle build (was already a JS dependency).
- Build fix: wrapped `onManageTechniques` invocation in `EmphasisSelector.tsx:270` to satisfy `tsc -b` (parameter mismatch with `MouseEvent`).

## Files changed (since v1.7.0)
- `src/features/logs/components/StreakCelebrationModal.tsx` *(new)*
- `src/features/logs/components/CharmTrophyCase.tsx` *(new)*
- `src/features/logs/constants/milestones.ts` *(new)*
- `src/features/logs/utils/milestones.ts` *(new)*
- `src/features/logs/components/WorkoutCompleted.tsx`
- `src/features/logs/components/WorkoutLogs.tsx`
- `src/features/logs/index.ts`
- `src/features/technique-editor/components/TechniqueQuickEdit.tsx` *(new)*
- `src/features/technique-editor/components/EmphasisSelector.tsx`
- `src/features/technique-editor/components/TechniqueEditor.{tsx,css}`
- `src/features/technique-editor/components/TechniqueGroupHeader.tsx`
- `src/features/technique-editor/components/TechniqueGroupPanel.tsx`
- `src/features/technique-editor/components/TechniqueListSection.tsx`
- `src/features/technique-editor/hooks/useEmphasisList.ts`
- `src/features/technique-editor/hooks/useTechniqueEditor.ts`
- `src/features/technique-editor/index.ts`
- `src/features/workout/components/StickyStartControls.tsx`
- `src/features/workout/components/WorkoutSetup.tsx`
- `src/features/workout/components/WorkoutConfiguration.{tsx,css}` *(deleted)*
- `src/features/workout/index.ts`
- `src/features/shared/contexts/UIProvider.tsx`
- `src/constants/storage.ts` *(new `MILESTONES_STORAGE_KEY`)*
- `scripts/dev-seed-streak.js` *(new dev helper)*
- `docs/RELEASE_PROCESS.md` *(new)*
- `README.md`, `docs/ARCHITECTURE.md`
- `android/app/capacitor.build.gradle`, `android/capacitor.settings.gradle` *(cap sync)*

## Test plan
1. **Streak celebration (fresh install path)**
   - Wipe localStorage. Complete one workout per day for 3 days (or run `scripts/dev-seed-streak.js` for a 100-day seed) → confirm Pra Jiad modal fires once on the completion screen.
   - Complete a 4th day → no modal (3-day already awarded).
   - On a real 7-day streak → Mongkol modal fires.

2. **Charm Trophy Case**
   - Logs page → Summary card shows earned charms as a third row matching the Current/Best Streak typography.
   - Locked charms must NOT be visible — only earned ones render.

3. **Inline quick-edit**
   - Setup → expand any style tile → add a single technique → save. Verify it appears in callouts when that style is selected and a workout starts.
   - Tile "edit full" → confirm Technique Editor opens scrolled to that group.

4. **Footer cleanup**
   - Setup screen with no selected styles → `×` button is hidden.
   - Select a style → `×` appears top-right of footer. Click → all selections clear.
   - Rounds/Length/Rest steppers no longer have a stray glyph next to REST.

5. **Smoke test (golden path)**
   - Start workout → "Get ready" plays → first round bell → first callout → rest with 10s warning → second round → complete.
   - Verify GA4 receives `workout_complete` events from version 1.8.0.

## Rollback
If a P0 surfaces on Play Store:
1. Play Console → Production → Halt rollout (if staged).
2. Build a hotfix or upload prior signed AAB at versionCode 80+ (cannot reuse 78).

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
