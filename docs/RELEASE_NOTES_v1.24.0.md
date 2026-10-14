# Release Notes — v1.24.0

**Date:** 2026-10-14
**versionCode:** 111
**Type:** Feature. The streak comes back to the home screen as a badge on the
menu button and becomes shareable as a card; the home screen's first row lines
up with the content; Apple Search Ads attribution; custom style names stop
going to GA4. No change to the callout engine, purchases, audio, or the native
projects beyond the version.

---

## Summary

Four things have landed on `main` since v1.23.0 was built. Two are
user-facing (the streak, the home row), one is iOS attribution plumbing, and
one is an analytics privacy fix.

---

## 1. Streak badge on the menu button

The current streak used to sit at the top of the home screen as a chip with
the favourite style; the home-screen declutter (`29a7741`) moved it into the
app menu beside Workout Logs, where it was rarely seen.

- On the home screen only, the menu button carries a small dark badge on its
  top-left corner: 🔥 and the day count.
- It is news, not a fixture. Opening the menu clears it; it comes back when the
  streak changes. A streak is identified by its start day and its length
  (`STREAK_BADGE_SEEN_KEY`, stored as `"<start day>:<length>"`), so a new streak
  that happens to reach an old count still shows.
- It is part of the menu button rather than a second control on a 36px target,
  and the button's accessible name carries the streak while the badge shows.

`useHomeStats` now returns `currentSince`, the day the current streak began.

[src/features/shared/components/AppMenu.tsx](../src/features/shared/components/AppMenu.tsx)

## 2. Shareable streak card

On Workout Logs, the "Day streak" stat is tappable (label in the accent pink)
from a one-day streak up. It opens a sheet with a preview of the card, **Share
your streak**, and **Save image**.

- The card follows the round's challenge card: the same palette (now shared in
  `logs/constants/cardBrand.ts`), a hero number, "Days straight" (or "Day
  one"), a footnote against the best streak, a reversed-colour band, and the
  domain printed on the card — Facebook and Instagram drop the caption, so the
  image has to carry the address.
- The band reads **"Show up. Repeat."**, not "Your move." A streak is not a
  setup anyone can match; the line is about consistency.
- Caption: `12 days straight. Show up. Repeat.` (or `Day one. …`), the site URL
  and the usual tags, per `SOCIAL_VOICE.md`.
- Same three share routes as the other cards (native sheet with a fresh cache
  path, Web Share, clipboard). New event: `streak_share`.

[src/features/logs/components/StreakShareSheet.tsx](../src/features/logs/components/StreakShareSheet.tsx)

## 3. Home screen first row

Timer Only, Freestyle and the menu button now sit on the 60rem content
column's edges — the Start Here card's — instead of the page margins. Home only;
other pages use other widths and keep the 2rem corner.

## 4. Fix: a single day was a streak forever

With exactly one training day logged, both streak calculations (home stats and
the logs page) returned a current streak of 1 however long ago that day was.
It now has to be today or yesterday, like any other streak.

## 5. Apple Search Ads attribution (iOS)

RevenueCat's AdServices attribution token collection is on for iOS
(`4bb318d`). Unlike the IDFA this needs no ATT consent, so with the RevenueCat
Apple Search Ads integration on, each subscriber carries campaign, ad group and
keyword.

## 6. Custom style names no longer go to GA4

A user-made style is keyed by the name typed for it, and that key was being
sent as an event parameter (`6a4268e`). Shipped styles and the two modes still
report by key; anything else reports as `custom`. `custom_group_created` drops
`group_name`. Names already collected stay in GA4 until deleted there.

---

## Files changed

| Area | Files |
|---|---|
| Streak badge | `AppMenu.tsx`, `AppMenu.css`, `App.tsx`, `constants/storage.ts`, `logs/hooks/useHomeStats.ts` |
| Streak card | `logs/components/StreakShareSheet.tsx`, `WorkoutLogs.*`, `logs/constants/cardBrand.ts`, `WorkoutCompleted.tsx`, `utils/imageUtils.ts` |
| Home row | `AppLayout.tsx`, `AppLayout.css` |
| Attribution | `entitlement/EntitlementProvider.tsx` |
| Analytics | `utils/analytics.ts` and its callers |

Commits: `6a4268e`, `4bb318d`, `ee1cd14`. (`386e838` and `90aff2b` are
tooling only and do not ship.)

---

## Test plan

**Automated:** 356 tests across 27 files pass, `tsc` clean.

**Driven in a browser** (Chrome via playwright-core, 375px and 1728px, seeded
workout history): the badge shows, clears on opening the menu, stays cleared
across a reload, and returns when a day is added; the logs streak opens the
sheet; Save image downloads the card, checked as a PNG at 1 and 12 days.

**Not verified before this build:** the Share button's native share sheet (the
test browser has none — it uses the same routes as the charm card) and
AdServices token collection, which only exists in a signed iOS build.

### Manual smoke test

- [ ] Golden path: start a workout, first callout, rest, second round, complete.
- [ ] Home with a streak: badge on the menu button; open the menu, badge gone;
      finish a round tomorrow, badge back.
- [ ] Workout Logs → Day streak → Share your streak opens the share sheet with
      the card and the caption (check a messaging target — Meta drops captions).
- [ ] Save image writes the card.
- [ ] Phone width: Timer Only, Freestyle and the badge clear each other.
