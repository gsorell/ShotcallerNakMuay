# Release Notes — v1.22.0

**Date:** 2026-10-06
**versionCode:** 108
**Type:** Feature. Round structure and Session Settings, a jab or check between
callouts, a new app menu, a decluttered home screen, and rebuilt Workout Logs.
This release **does** change the callout engine and how a session's pool is
built. No change to entitlement, purchases, audio session handling, or deep
links.

---

## Summary

A session is no longer one flat pool read for every round. It runs off a plan —
one entry per round — and a Pro user shapes that plan in a single **Session
Settings** sheet: which style gets which round, a warm-up round, how the pace
moves across rounds, where calisthenics go, and whether a jab or a check is
called between callouts.

Around that, navigation was consolidated into one app menu, the home screen lost
its ad-hoc entry points, and Workout Logs was rebuilt.

---

## 1. Round structure (Pro)

[src/features/workout/utils/roundPlan.ts](../src/features/workout/utils/roundPlan.ts)
turns the structure settings into a plan, and each planned round into the pool
the callout engine reads. The engine re-reads its pool ref on every callout, so
swapping it at a round boundary never restarts the loop — the guided path has
always worked this way.

- **Styles:** blended, or one style per round in the order they were picked,
  with any round overridable by hand.
- **Blending changed.** Each selected style now gets an **equal share** of
  callouts rather than a share proportional to the size of its list, so a style
  with sixty entries no longer drowns one with ten. Read-in-order alternates
  between styles.
- **Warm-up round:** round 1 calls single techniques only.
- **Pace:** steady, build, or pyramid across rounds.
- **Calisthenics:** mixed in, a finisher at the end of every round (marked with
  the interval bell), or a last round of their own.
- The rest screen shows what the next round holds, and the 10-second warning
  names it.
- The plan is logged with the session and rebuilt on resume. Resume now reads
  the log entry rather than whatever is selected on screen.
- Callouts wait for the browser to finish speaking before the next one starts,
  so a shortened gap can never cut one off.

Free users see the controls at rest; choosing anything opens the paywall.

## 2. Between callouts (Pro)

A new choice in Session Settings → Callouts: **Off / Jab / Check / Jab/Check**
(the last picks one at random each time).

The extra call does **not** take a callout slot. The gap after a callout is
worked out exactly as before; the jab or check is spoken 40% of the way into it
(`BETWEEN_CALLOUT_AT`), and the next callout from the pool still lands when it
would have. A round keeps its combinations and adds work on top. At least 300 ms
(`MIN_GAP_AFTER_BETWEEN_MS`) is left after it, which on Hard can push the next
callout slightly late.

- Skipped on guided roadmap levels, in a calisthenics-only round, and during a
  calisthenics finisher.
- Skipped once when the pool itself has just called a bare "Jab" or "Check".
- A round, and a resume after a pause, always opens on a callout from the pool.
- **The logged shot count includes these calls**, so it roughly doubles with the
  setting on. Counts are not comparable across sessions with and without it.
- It says a bare "Check", not the library's "Left Check" / "Right Check".

Both timing constants are first guesses, not tuned values.

[src/features/workout/hooks/useCalloutEngine.ts](../src/features/workout/hooks/useCalloutEngine.ts)

## 3. Session Settings replaces Advanced Settings

`AdvancedSettingsPanel` is removed. Round structure, read-in-order, southpaw and
the voice settings live in one sheet opened from the start bar, which shows a
one-line summary of whatever is set. The warm-up round toggle sits in the
Callouts section. The blog link moved to the foot of the Learn page.

## 4. App menu and home screen

- One menu — Train, Learn, Technique Manager, Workout Logs, Help — in the top
  corner of every page, hidden during a live session. Back shares its row.
- The home screen sheds the stats chip, the "browse technique library" link, the
  Manage Techniques link and the footer nav.
- Timer Only and Freestyle are switches in the page's first row rather than
  tiles in the grid.
- Styles can be reordered on the home grid (Pro). The order is saved and shared
  with the Technique Manager.

## 5. Technique Manager

A style's row is icon, name, a "more actions" menu (Share, Duplicate, Restore
defaults / Delete) and a chevron. Renaming moved into the open style as a Name
field. The list follows the home-screen order; a new or duplicated style is
opened and scrolled to.

## 6. Workout Logs rebuilt

- A fighter card leads the page: the sharing name with a pencil to change it,
  the favourite style as the avatar, and day streak, best streak, workouts and
  rounds in one row. It shows on a first visit, with zeros.
- Sessions are grouped under day headings (Today, Yesterday, then dates).
- Every row has one shape and one action in words — Resume, or View result.
  Delete moved into the "more actions" menu.
- The page is titled "Workout Logs" to match the menu; it was "Summary".
- The completion screen, opened from a log row, has a Back link to the logs.

---

## Files changed

| Area | Files |
|---|---|
| Planning | `workout/utils/roundPlan.ts` |
| Engine | `workout/hooks/useCalloutEngine.ts`, `workout/contexts/WorkoutProvider.tsx`, `workout/hooks/useWorkoutSettings.ts` |
| Settings UI | `RoundStructureSheet.*`, `VoiceSettings.tsx`, `StickyStartControls.tsx`; `AdvancedSettingsPanel.tsx` deleted |
| Navigation | `shared/components/AppMenu.*`, `AppLayout.*`, `Footer.tsx`, `ActionMenu.*` |
| Home | `EmphasisSelector.tsx`, `WorkoutSetup.*`, `styleDisplayOrder.ts` |
| Technique Manager | `TechniqueGroupHeader/Panel`, `StyleMenu.tsx`, `StyleNameField.tsx`, `groupSorting.ts` |
| Logs | `WorkoutLogs.*`, `WorkoutCompleted.tsx`, `utils/logUtils.ts` |

Commits: `29a7741`, `1c2d239`, `419c0b8`, `8e0e4dc`.

---

## Test plan

**Automated:** 346 tests across 26 files pass, `tsc -b` clean. `roundPlan.test.ts`
covers the plan: who gets which round, more styles than rounds, equal-share
blending, pace shapes, finisher length, and sanitising a stored structure.

**Not covered by any test:** the between-callouts timing. It lives inside the
engine's speech callbacks and has only been heard on a device.

**Android:** the debug build of `8e0e4dc` was installed over the existing app on
a Pixel 9 Pro XL. **iOS: not run on a device before this build.**

### Manual smoke test

- [ ] Start a normal session with Session Settings untouched — rounds run as
      they always have.
- [ ] Two styles, By round — each round calls only its style; the rest screen
      names the next one.
- [ ] Between callouts on Jab, Medium and Hard — the jab lands in the gap, not
      on top of the combination, and nothing is cut off.
- [ ] Calisthenics finisher with Between callouts on — no jabs inside it.
- [ ] Pause and resume mid-round — the first call back is from the pool.
- [ ] Close the app mid-session, then Resume from Workout Logs — same plan.
- [ ] Free tier: every Session Settings control opens the paywall.
- [ ] A guided roadmap level is unaffected by any of it.
