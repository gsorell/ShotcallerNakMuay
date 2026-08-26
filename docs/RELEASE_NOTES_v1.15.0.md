# Release Notes — v1.15.0

**versionCode:** 91 · **Previous:** v1.14.0 (versionCode 90)

The technique figures stop being decoration on a lesson page and become the way
you browse. Learn is one filterable shelf; the figures mirror for a southpaw;
you can stop one and step through it frame by frame.

---

## What shipped

### Learn is a single shelf

Browsing used to be two steps — pick a category, read a list of names — with
the only silhouette in the section buried on the lesson page underneath. It is
now one surface. Categories are a filter that narrows in place rather than a
screen you push into, so looking a technique up is a tap and a scroll instead
of three taps and a back button. The per-category list screen is gone.

A lesson with no sheet is not on the shelf at all. Thirty-seven lessons have
not been filmed — all thirteen feints among them — and a grid with holes in it
reads as half-built where a shelf of real figures reads as a library. Those
lessons still exist and the app still calls the techniques out; they reappear
the moment a sheet lands. What is left to shoot is tracked in
[TECHNIQUE_SHOT_LIST.md](./TECHNIQUE_SHOT_LIST.md).

A pause control holds every figure still, on its own row beneath the filters.

### Both sides of every pair are visible

Six lessons were shot from both sides and the shelf was rendering one of them —
`spritesFor(slug)[0]` and nothing else. Right Elbow, Slip Right, Rear Teep,
Rear Check, Rear Knee and Rear Up-Elbow were filmed, committed, and invisible.
A tile is now per **sheet**, not per lesson.

### Southpaw mirrors the figures

Every sheet was shot orthodox, so a southpaw browsing Learn was looking at
someone standing the other way round from them. The figures now flip, and so
does everything naming a side: the Left/Right label on a paired sheet, and the
four lesson names that carry a side.

Lead and Rear do not flip, and neither does the numbering — both are
stance-relative, so a southpaw's "Right Hook · 3" is correct and is already
what the callout engine says out loud. Lesson prose is deliberately untouched:
it is written in lead and rear so it needs no flipping, and one lesson contains
"right before it stops being harmless", which a naive pass would ruin. A test
pins that sentence.

### Step through a technique

Six frames in 1.15s puts each pose on screen for under 200ms — right when you
want the rhythm, useless when you want to know where the rear heel is at the
moment of extension. Lesson pages now have back / play-pause / forward, and
arrow keys step. Pause lands on the extension frame, which is the frame the
sheet was built around.

The held frame is applied inline so it beats the reduced-motion rule, which
means stepping still works for a reader who has asked the system not to
animate.

### Back returns you to where you were

Every navigation reset the content region to the top, so reading one lesson and
coming back meant losing your place and scrolling to find it again. Positions
are remembered per view and restored by back — the shelf, the roadmap ladder,
and every page's back button.

Opt-in rather than restore-on-arrival: arriving still means arriving at the top,
because that is right for the logo and for starting a session. The page-level
handoff is a one-shot token, so an unconsumed request cannot leak into a later
navigation.

### New and corrected sheets

- **Roll** is a pair. The shipped sheet is the roll right; the left is cut from
  a clip shot for it. The first cut caught the reset between rolls rather than
  the roll — the drill is a continuous weave, and the head drifts back across
  the frame at a shallow dip between the deep ones.
- **Double Jab** is derived from the jab's own cells rather than filmed, via
  `--derive`. The bar for that is that the derived sheet contains no pose the
  source does not.
- **Body punches** split from one sheet standing for four callouts into
  Jab to the Body, Cross to the Body, and Body Hooks — the last named for what
  its footage actually shows, a 4-3 combination rather than an isolated hook.
- **Roundhouse kick** re-shot from the gym clip.

### Smaller

- Learn and Manage Techniques stopped pretending to be a matched pair. Learn is
  a card carrying a held figure; Manage is a text link.
- Start Here links into the library, so the path and the reference are navigable
  in both directions rather than one.
- Back is a link on all four pages that have one, not a filled pill.
- Copy: Start Here trimmed, Nak Muay Newb's description corrected (it had
  claimed all eight limbs, and that style calls no elbows), and counts removed
  from prose that had to keep promising them.

---

## Fixes

- **`tsc -b` was failing on `main`** — three `noUncheckedIndexedAccess` errors
  on the same `callouts[0]` in RoadmapSection. `npm run build` did not work
  before this release.
- **Two level 9 callouts resolved to no lesson.** `4 to the Body` and
  `3 to the Head` are both spoken in that level's combination round and neither
  had a lesson behind it — in the level whose whole subject is that suffix. Only
  the *drawn* combinations were validated against the vocabulary; a level's own
  authored combos went in unchecked. Now guarded by a test.

---

## Files of note

| Path | |
|---|---|
| `src/features/learn/components/TechniqueGallery.tsx` | the shelf |
| `src/features/learn/components/TechniqueViewer.tsx` | frame stepping |
| `src/features/learn/data/galleryTiles.ts` | tile per sheet, and what is excluded |
| `src/utils/scroll.ts` | scroll memory and the one-shot page handoff |
| `scripts/technique-sprites.mjs` | `--derive` for sheets cut from sheets |

---

## Test plan

- `npx vitest run` — 197 tests, 19 files.
- `npm run build` — must succeed; it did not on v1.14.0.
- Learn: filter each category, pause, tap a figure, back returns to the tile.
- Lesson page: play/pause, step both directions, wrap at both ends.
- Advanced Settings → Southpaw on: figures flip, "Left Hook" reads "Right Hook",
  the numbering does not change, lesson prose is untouched.
- Scroll the style grid, open Learn, press Back — the grid is where you left it.
- Reduced motion enabled: figures hold a frame, stepping still works.

---

## Known gaps

- `2 to the Body` and `4 to the Body` have sheets only insofar as Body Hooks
  covers the hooks; there is no cross-to-body-only figure beyond its own sheet.
- 37 lessons remain unfilmed and are therefore not reachable from Learn.
- The test suite intermittently fails *collection* on all 19 files at once with
  "no tests", while the build passes in the same run. Seen four times, never
  reproducible on demand, and always clean on a re-run. If CI shows it, capture
  the output above the FAIL list — that is where the collection error prints.
