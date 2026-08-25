# Release Notes v1.14.0 — The Figures

## Version Information
- **Version:** 1.14.0
- **versionCode (Android):** 90
- **Previous:** 1.13.0 (versionCode 89)
- **Date:** 2026-08-25

96 commits since v1.13.0. The release is one idea carried through every screen
that teaches technique: **show the movement instead of describing it.** Learn,
the roadmap ladder and the setup screen all now lead with a looping silhouette
cut from real footage.

---

## Highlights (user-facing)

### 1. Learn is a shelf of figures

Learn used to open on a wall of text — a title, a banner, eight category rows
carrying static neon icons — and browsing was two steps: pick a category, then
read a list of names. The only silhouette in the section was buried three taps
deep on a lesson page.

It is now **one screen**. Every technique that has been filmed appears as a tile
with its figure stepping on it, grouped into sections, with the categories
demoted from a step to a **filter chip** that narrows the shelf in place.
Looking a technique up is a tap and a scroll instead of three taps and a back
button. The per-category list screen is gone.

**26 lessons, 32 sheets.** Six lessons were shot from both sides and get two
tiles each — teep, check, straight knee, up elbow, horizontal elbow (Lead/Rear)
and the slip (Left/Right). Showing one sheet and calling it "the elbow" hid half
of what was filmed and half of what the app says out loud.

**A lesson with no sheet is not on the shelf at all.** An earlier cut of this
gave un-shot lessons a placeholder tile carrying their category's artwork; that
read as a half-built page rather than a library. 37 lessons have not been filmed
(13 of them feints, which may never be filmable solo). Their written lessons
still exist in `techniqueLibrary` and a tile appears the moment a sheet lands,
with no other change. What is still un-shot is tracked in
[TECHNIQUE_SHOT_LIST.md](./TECHNIQUE_SHOT_LIST.md).

**Pause.** Thirty-two figures stepping at once is a lot to read past when you
are looking for one particular thing. A pause control sits on its own row under
the filter chips — a hairline across the shelf with the control in the break —
and holds every figure still. Tiles are `content-visibility: auto` so the
browser can skip the ones scrolled past.

### 2. The figures stand the way the user does

Every sheet was shot orthodox, so a southpaw browsing Learn was looking at a
picture of someone standing the other way round from them, on the screens whose
whole job is showing what a technique looks like.

Figures now mirror when Southpaw is set. Three rules, and a test for each:

- **The window flips, not the image.** The image already carries the
  frame-stepping transform and a second transform on the same element fights
  it; flipping the window mirrors the visible cell and leaves the stepping
  alone.
- **Side labels flip only where they name a direction.** A mirrored "Slip Left"
  sheet shows a slip to the figure's right, which is also what the callout
  engine says out loud. **Lead and Rear do not move** — the lead leg is the lead
  leg whichever way you stand.
- **Names flip; numbers do not.** Only four names carry a side (Left/Right Hook,
  Left/Right Uppercut). A southpaw's tile reading "Right Hook · 3" is correct,
  and matches the voice. Roadmap cards get the same treatment including the
  "Called as" line.

**Lesson prose is never mirrored**, deliberately. The copy is written in lead
and rear so it needs no flipping, and the stray "right"s in it are English
rather than directions — one lesson reads "right before it stops being
harmless". Anatomy would not survive it either; the liver sits on one side of a
body whichever way the puncher stands. There is a test pinning that sentence as
a canary.

### 3. Silhouettes on the roadmap cards

The closed lesson card on the guided path now carries its silhouette, with the
expand marker moved to the card corner to make room. On a phone, a lesson with a
paired figure gets its own row so both sides fit.

### 4. The setup screen: Learn earns a card

Learn and Manage Techniques were styled as a matched pair of icon buttons, and
they were never peers — Learn is a curriculum and a library of filmed technique,
Manage is a tool you open when you want to change what gets called out. The
symmetry made the larger thing wear the smaller thing's size.

- **Learn is a card** with a live head-kick figure held at full extension. The
  figure is a sample of what is inside rather than a symbol standing for it, and
  it is the only thing on the setup screen that would move — which is what stops
  it being read as another selectable style tile.
- **Manage Techniques is a text link**, sitting with "Show Advanced Settings",
  which is the company it actually keeps.
- **The Start Here card now links to the library.** Learn has always linked back
  to the path; the path had no way forward, so the two halves of the same
  material were navigable in one direction only.

### 5. Back is a link, and it puts you where you were

Back was a filled pink pill — a lot of emphasis for the least interesting
control on the screen, and on Learn it sat inches from the filter chips as a
second pink rounded thing that was not a filter. It is now text and an arrow
that eases left on hover, defined **once** and shared by all four pages
(Learn, roadmap, Workout Logs, Technique Manager), two of which had
byte-identical copies of the same rule and one of which was inline styles with
JS hover handlers.

Scroll position is now remembered per view and restored **by back only**:

```
Learn shelf  ->  lesson or the path  ->  back to the same tile
Ladder       ->  a level             ->  back to the same rung
Any page     ->  back                ->  the part of home you left
```

Opt-in rather than restore-on-arrival: arriving somewhere still means arriving
at the top, because that is right for every forward move. The handoff is a
one-shot token, so an unconsumed request cannot leak into a later navigation.
Positions live in memory rather than `sessionStorage` — a reload is a fresh
start, and restoring an offset into content that may have changed underneath is
worse than starting at the top.

### 6. Copy

- **Nak Muay Newb no longer claims "all eight limbs."** It carries no elbows at
  all — 11 punches, 7 kicks and teeps, 2 knees, 12 defensive movements, and not
  one Sok. The line now names what is actually in there, defence included, which
  is the largest part of the group and went unmentioned before.
- **Start Here** reads as three lines rather than four, and says what the path is
  *for* rather than describing its shape.
- **Counts came out of prose.** Onboarding promised "all 63 techniques the app
  calls out"; the number never went stale, but Learn narrowed to what has been
  filmed, so "all" stopped being true. The filter chips keep their counts —
  those label what is in front of you rather than claiming what exists, and they
  cannot be wrong.

---

## Fixes

- **Two level 9 callouts had no lesson behind them.** "4 to the Body" and "3 to
  the Head" are both called in level 9's combination round and neither resolved
  to anything — and the suffix is the whole point of that level, its
  `languageNote` teaches it. Root cause: only *drawn* combinations run through
  `isWithinVocabulary`; a level's own authored combos went into the round
  unchecked.
- **Audio keepalive is now Android-only.** The inaudible keepalive source is
  what stops the AAudio MMAP path parking between bells, and it shipped
  unconditionally. On the deployed PWA the browser correctly reported the tab as
  playing audio from the first workout until the tab was closed — it read as the
  app misbehaving and kept the page from being discarded. On iOS it was never
  proven; the pop was measured on the AAudio path only. No behaviour change on
  Android.
- **The lesson sprite stacked below the copy on phones** (<600px). A rename left
  two `order: -1` rules naming the inner cell instead of the wrapper, so they
  were ordering a div with no sibling to order against. Nothing failed — build,
  types and tests were all green while the layout came out upside down. A guard
  now reads both stylesheets and fails if the rule targets the wrong class.
- **`tsc -b` was failing** on three `noUncheckedIndexedAccess` errors, all the
  same `callouts[0]`, which `lessons` guarantees is present.
- **GA4 was reporting the wrong app version.** `APP_VERSION` in
  [analytics.ts](../src/utils/analytics.ts) was a hand-maintained literal
  commented "imported from package.json at build time" and had sat at `"1.5.0"`
  through eight releases, so every event since reported a version nobody was
  running — including the post-release check in
  [RELEASE_PROCESS.md](./RELEASE_PROCESS.md) §5. It is now a build-time `define`
  fed from `package.json`, which cannot drift from the bump. **v1.14.0 is the
  first release whose `app_version` in GA4 is trustworthy; treat every earlier
  figure as "1.5.0 or later".**

---

## Tooling and pipeline (no user-facing change)

The sprite work needed a pipeline before it needed sheets.

- **Mask export and re-apply** (`scripts/technique-sprites.mjs`) — export a
  sheet's mask, hand-retouch it, re-apply it. All 26 sheets were rebuilt from
  painted masks so every figure has the same edge treatment.
- **Mask validation.** A saved composite (mask layer flattened onto the plate)
  renders a semi-transparent sprite with the footage visible inside the
  silhouette. The first check measured mid-grey against the whole sheet, where
  most of any sheet is empty black — a composite scored 8% and passed. Measured
  against the **figure**, four known-good masks read 7% (anti-aliased edge) and
  the composite reads 67%. It now refuses above 25%, warns above 15%, and the
  message names the actual fix.
- **`--derive`.** `double-jab` is cut from the jab's own cells rather than
  filmed — guard, extension, partial retract, extension, retract, guard — since
  a double jab is one jab and then another. The bar is documented in `DERIVED`:
  a derived sheet must contain **no pose the source does not**, or it stops
  being a rearrangement of real footage and becomes invented technique, which is
  exactly what the shot list's "why we film rather than generate" exists to
  prevent. A jab-cross would not qualify.
- **Dev review switch** (`src/utils/devUnlock.ts`) — walking every lesson and
  level to review content means clearing ten levels first, which is a workout
  rather than a review. Gated on `import.meta.env.DEV`, a Vite build-time
  literal, so the branch is **dead code in a production bundle and cannot ship
  enabled**. Excluded in test mode too, since the suite asserts the real gating.
  Set `localStorage["nmsc-dev-respect-locks"] = "1"` to check the real locks in
  dev.

---

## Test plan

- `npx vitest run` — **19 files, 197 tests, all passing.** New coverage:
  `techniqueSprites`, `learnGallery` (every sheet on disk appears exactly once;
  shelf count matches what was shot), `scrollMemory`, `learnCoverage`,
  `roadmapCoverage`.
- `npm run build` — clean; `1.14.0` verified present in the emitted bundle and
  the `"1.5.0"` literal verified gone.
- Manual, per surface: open Learn → filter by each chip → pause → open a lesson
  → back lands on the same tile. Toggle Southpaw → figures and sided names flip,
  Lead/Rear labels do not, lesson prose unchanged. Level 9 → both suffix
  callouts resolve to a lesson. Android: bells still gapless across a full
  round. PWA: the tab stops reporting audio once a session ends.

---

## Store copy

### App Store — "What's New"

Learn now opens on the techniques themselves. Every technique we have filmed is
on one screen as a looping figure you can actually watch, with the categories
turned into filters so finding one is a tap and a scroll instead of three taps
and a back button. Techniques shot from both sides — the teep, the check, the
knee, both elbows and the slip — show both, because which side does the work is
most of what they teach.

If you train southpaw, the figures now stand the way you do. The silhouettes
mirror, and the names that name a side mirror with them, while the numbers stay
where they belong.

The guided path carries the figures too, on every lesson card.

Also in this release: back takes you to the spot you left rather than the top of
the list, two level 9 callouts that had no lesson behind them now have one, and
the setup screen gives Learn the room it had earned.

### Play Store — release notes

```
Learn now opens on the techniques themselves — every filmed technique on one
screen as a looping figure, with categories as filters instead of a second step.
Techniques shot from both sides show both.

Train southpaw? The figures now stand the way you do, and the names that name a
side mirror with them. The guided path carries the figures too.

Plus: back returns you to the spot you left, two level 9 callouts that had no
lesson now have one, and a cleaner setup screen.
```

---

## Files changed (since v1.13.0)

**New**
- `src/features/learn/components/TechniqueGallery.tsx` / `.css` — the shelf
- `src/features/learn/components/TechniqueSprite.tsx` / `.css` — the figure, plus
  `SpriteFigure` for hosts that already know which sheet they want
- `src/features/learn/data/galleryTiles.ts` — what is on the shelf, and why
- `src/features/learn/data/techniqueSprites.ts` — sheet registry, southpaw naming
- `src/utils/scroll.ts` — scroll memory
- `src/utils/devUnlock.ts` — dev-only review switch
- `src/styles/backLink.css` — the shared back control
- `public/assets/technique/*.webp` — 32 sheets
- `docs/TECHNIQUE_SHOT_LIST.md` — what is shot, what is not

**Changed**
- `src/features/learn/components/LearnSection.tsx` / `.css` — category grid and
  per-category list screen removed
- `src/features/roadmap/components/RoadmapSection.tsx` / `.css` — card
  silhouettes, corner marker, paired rows
- `src/features/roadmap/components/StartHereBanner.tsx` — copy, link to library
- `src/features/workout/components/WorkoutSetup.tsx`, `src/styles/setupActions.css`
  — Learn card, Manage link
- `src/features/shared/components/AppLayout.tsx` — scroll listener and restore
- `src/features/shared/hooks/useSoundEffects.ts` — keepalive gated to Android
- `src/features/logs/components/WorkoutLogs.tsx`,
  `src/features/technique-manager/components/TechniqueEditor.tsx` — shared back link
- `src/features/learn/data/techniqueLibrary.ts` — the two level 9 callouts
- `src/features/entitlement/EntitlementProvider.tsx`, `src/features/roadmap/storage.ts`
  — dev unlock hook-in
- `src/utils/analytics.ts`, `vite.config.ts`, `src/vite-env.d.ts` — app version
- `scripts/technique-sprites.mjs` — mask export/re-apply, validation, `--derive`
