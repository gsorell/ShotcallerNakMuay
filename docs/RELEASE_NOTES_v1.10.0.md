# Release Notes v1.10.0 — The Answer Back

## Version Information
- **Version:** 1.10.0
- **versionCode (Android):** 84
- **Previous:** 1.9.0 (versionCode 83)
- **Date:** 2026-07-15

## Highlights (user-facing)

### 1. The Answer Back — a counters style group

A new style group where **every callout opens with a defensive technique**. Counters already existed scattered across the other groups (mostly Muay Femur), but nowhere was defense the organizing principle rather than a side effect of a style.

The 22 callouts come from a coverage matrix rather than a brainstorm. Each of the ten basic attacks gets one answer that **meets** it (parry, block, check, catch) and one that **avoids** it (slip, duck, lean back, step), so no attack is drilled with only a single habit. Jab and low kick get a third, being the two you eat most often.

| Incoming | Answers | Incoming | Answers |
|---|---|---|---|
| Jab | 3 | Body kick | 2 |
| Cross | 2 | Head kick | 2 |
| Hook | 2 | Teep | 2 |
| Uppercut | 2 | Knee | 2 |
| Low kick | 3 | Elbow | 2 |

**Naming rule:** the incoming attack is always *named* ("the Jab", "the Low Kick") and numbers are always *your own* output. Every other group uses numbers for the caller's strikes, so a callout like "Block the 3" would collide with that convention — "Block the Hook, 2 3" cannot be misread.

`singles` is intentionally empty for this group: the pool calls singles on their own, and a bare "Slip Left" is a slip, not a counter. Muay Femur keeps its own counters; selecting both groups merges the pools and simply weights the shared material up.

Tile art: `public/assets/icon.counters.png`. The group sits at the top of the below-the-fold specialty groups.

### 2. Even tile heights on the home screen

Tile height used to track how many lines each description wrapped to, so the style grid read as a ragged field of two- and three-line tiles. Tiles now hold one uniform height.

## Other changes

- **Migration (important):** a technique version bump previously overwrote the entire stored library with `INITIAL_TECHNIQUES`, so **every content release silently destroyed any custom groups a user had built and any edits to the built-in ones.** Shipping new content and resetting everyone's library were the same action. v1.10.0 introduces a baseline snapshot (`shotcaller_techniques_baseline`) of the defaults the saved data was last reconciled against, which separates "the user edited this group" from "we shipped new content for this group":
  - absent from saved data → newly shipped, add it
  - identical to baseline → untouched, take the latest content
  - otherwise → customized, keep the user's copy

  Untouched groups therefore keep tracking upstream content, which a naive "never overwrite" fix would have given up. `resetToDefault` / `resetGroupToDefault` remain the explicit way back to shipped content.

  The v36 → v37 upgrade is lossless: `techniques.ts` had not changed since the v36 bump, so this release's only content change is an addition. Users with no baseline yet are assumed customized and keep their data.

- Five shipped tile descriptions ran past the two-line budget and were trimmed (Freestyle was worst at 83 chars). Copy only — no behavior change.

## Files changed (since v1.9.0)

- `src/constants/techniques.ts` *(new `counters` group)*
- `src/emphasisConfig.ts` *(counters tile config; five description trims)*
- `src/features/technique-editor/constants.ts` *(thumbnail + CORE_ORDER)*
- `src/features/technique-editor/hooks/useEmphasisList.ts` *(home order, below the fold)*
- `src/features/technique-editor/hooks/useTechniqueData.ts` *(**merge migration**; TECHNIQUES_VERSION v36 → v37)*
- `src/constants/storage.ts` *(new `TECHNIQUES_BASELINE_KEY`)*
- `src/features/technique-editor/components/EmphasisSelector.tsx` *(tile/title/desc classes, title tooltips)*
- `src/features/shared/components/AppLayout.css` *(uniform tile min-height, two-line clamps)*
- `src/__tests__/techniqueMigration.test.ts` *(new — 6 tests)*
- `src/__tests__/countersGroup.test.ts` *(new — 3 tests)*
- `public/assets/icon.counters.png` *(new)*
- `docs/ARCHITECTURE.md` *(group table)*

## Test plan

1. **New group appears for an existing user (the migration path)**
   - With a v36 library in localStorage, load the app → "More" → **The Answer Back** tile is present, and any custom groups/edits are still intact.
   - Confirm `shotcaller_techniques_version` is now `v37` and `shotcaller_techniques_baseline` exists.

2. **Migration does not clobber customizations**
   - Before upgrading: edit a core group (e.g. remove all Muay Femur combos) and create a custom group.
   - Upgrade → both survive; the counters group is added alongside them.

3. **Counters group callouts**
   - Select **The Answer Back** alone → every callout starts with a defensive technique, and no callout leads with a bare number.
   - Select it alongside Muay Femur → pool merges, both styles' callouts are heard.
   - Southpaw mode → Left/Right swap in counters callouts (numbered strikes do not mirror; pre-existing behavior across all groups).

4. **Tile grid**
   - Home screen → tiles are uniform height above and below the fold.
   - Expand a tile's technique quick-edit → only that tile grows; its row-mates stay put.
   - **Check on a real phone (<600px, single column):** tiles are even but may read airy; `\.emphasis-tile` min-height in `AppLayout.css` is the one number to tune.

5. **Smoke test (golden path)**
   - Start workout → "Get ready" → first round bell → first callout → rest with 10s warning → second round → complete.
   - Verify GA4 receives `workout_complete` events from version 1.10.0.

## Rollback

- **Web (Netlify):** Deploys → previous good deploy → Publish deploy (~30s).
- **Android:** Play Console → Halt rollout (if staged) → upload prior signed AAB at versionCode 85+ (cannot reuse 83).
- **iOS:** Reject build before phased release, or ship a patch.

> **Note on rolling back the migration:** the baseline key is additive and older builds ignore it, so a rollback is safe. However, a user who upgrades to v1.10.0 and then rolls back to v1.9.0 will hit the old wipe behavior on the *next* version bump they receive.

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

New style group: The Answer Back. Every callout starts with defense — block, slip, catch, or check the incoming strike, then fire back. It covers the answers to all ten basic attacks, with two ways to handle each one, so you drill reading a shot and punishing it instead of just throwing first.

Your saved techniques now survive app updates. Custom groups you have built and edits you have made to the built-in ones are kept when a new version adds content, instead of being reset.

Also in this release: the style tiles on the home screen are now an even, uniform size.

## Play Store release notes (draft — ≤500 chars)

New style group: The Answer Back. Every callout starts with defense — block, slip, catch, or check the incoming strike, then fire back. Covers answers to all ten basic attacks, two ways to handle each.

Your saved techniques now survive updates: custom groups and your edits to the built-in ones are kept when a new version adds content, instead of being reset.

Also: the style tiles on the home screen are now an even, uniform size.
