# Release Notes — v1.20.0

**Date:** 2026-09-25
**versionCode:** 105
**Type:** Redesign. The completion screen only — layout, actions, and new belt art. No behaviour change to the timer, the callout engine, entitlement, or logging.

---

## Summary

The screen a user lands on after the last bell was a receipt with its facts in
the wrong order and five identical icon buttons under it. It now has one
subject, a hierarchy of actions, and a piece of art worth looking at.

Three independent changes, in three commits, each revertible on its own.

---

## 1. The card had no subject

The order ran belt → headline → date → style → setup → shots → wordmark.
That is identity, then metadata, then identity again. The timestamp — the least
interesting fact on a screen read four seconds after the last bell — held the
third-most prominent slot, and the style was stranded between it and the stats.

Two inversions were measurable rather than matters of taste:

- **The headline wrapped.** 2rem bold inside 2rem card padding broke "Training
  Complete" across two lines on a phone.
- **Shots called was demoted typographically and promoted structurally.** It had
  its own divider and a full-width row while being set at 1.2rem against
  Level/Rounds at 1.6rem — the layout and the type disagreeing about what it is.

### The fix

| Was | Now |
|---|---|
| Date on its own tier, style on another | One metadata line: `STYLE · LEVEL · DAY TIME` |
| Four stats at competing sizes | One hero: total time trained (`roundsCompleted × roundLengthMin`) |
| Shots called as a bordered row | One sentence, `11 shots called` |
| Headline at a flat `2rem` | `clamp(1.35rem, 6.5vw, 1.75rem)`, `white-space: nowrap` |
| In-card SHOT CALLER footer | Removed — the app header says it directly above |

`roundsPlanned` was already in `WorkoutStats` and never rendered; the round line
now appends `· of N` **only when the user stopped early**. Saying "of 6" after
six rounds turns a finished session into a quota met.

The metadata line is set to wrap rather than forced onto one line: "Amateur" is
longer than "Pro" and two selected styles are longer again, so no width was ever
going to guarantee a single line. `text-wrap: balance` and looser leading make a
two-line break read as a block.

The in-card wordmark stays on the **export** card, which leaves the app and has
to introduce itself.

## 2. The actions had no primary

Five 48px bitmaps in a row, all one size, none labelled. Three problems, only
one of them cosmetic:

- **No primary.** Share is the only action that does anything for the user once
  the phone is down, and it sat fifth dressed exactly like the other four.
- **It asked people to guess.** A page glyph for "view log" and a circular arrow
  for "restart" are not conventions, and the `title` tooltips that explained
  them do nothing on a touchscreen — the only place this screen ships.
- **They were `<img onClick>`.** Not focusable, not keyboard-reachable, not
  announced as controls.

Now a hierarchy, in `WorkoutCompleted.css` alongside `styles/setupActions.css`:

1. **Share your round** — primary, the wordmark ramp with dark type. The same
   reversal the export card closes with, and the only thing on the screen that
   is not light type on near-black. Contrast is what makes it primary, not size.
2. **Train again** — outlined secondary.
3. **Home · View log · Save image** — text links. None is why anyone is here.

Real `<button>` elements with `:focus-visible`, labelled in words — which is
also why this needed no new artwork.

## 3. The belt was an icon, not a trophy

The medallion held a generic lightning bolt. It now carries the
gloves-and-bolt mark, drawn as a single illustration with a double-ringed plate,
a sunburst behind it, hexagonal side plates, and neon glow on every stroke.

**An earlier attempt composited the existing mark into the old belt's oval and
was abandoned.** The reason was measurable: fitting the mark inside the oval
meant scaling it to 44%, which took its strokes from 17px to 7.5px against the
belt's 25 — a **3.35× mismatch**. No amount of repositioning fixes a scale
problem, so the art was redrawn as one piece at one line weight.

Verified before shipping:

| | Old belt | New art |
|---|---|---|
| Core pixels (≥200) | 86.5% | 27.4% |
| Halo (6–39) | 7.6% | 30.0% |
| Aspect | 1.88:1 | **1.44:1** |
| webp size | 40KB | **75KB** |

The glow is the point — the old art was essentially flat, which is why it read
as an icon. The 35KB is soft alpha, which the cutout script's own notes identify
as what makes these files big; `alpha_quality` stays at 80 to hold it down.

Rendered at 168px @1x and at 168/200/240 @3x before choosing a width. The gloves
survive 168 in a desktop browser but only just, so the belt draws at **200px**.
Because the sunburst makes the art squarer, that is ~139px tall where the old
belt took ~106 at the same width.

`scripts/build_belt_medallion.py` is deleted. With hand-drawn art as the source
it stopped being a build step and became a hazard — running it would have
overwritten the artwork with the old composite.

---

## Files changed

| File | Change |
|---|---|
| `src/features/logs/components/WorkoutCompleted.tsx` | Card reorder, hero stat, action hierarchy, belt src and width |
| `src/features/logs/components/WorkoutCompleted.css` | **New.** Action button styles |
| `assets-src/raster/icon_belt_logo.png` | **New.** Hand-drawn belt art |
| `public/assets/icon_belt_logo.webp` | **New.** Pipeline output, 480×334 |
| `scripts/build_icon_cutouts.py` | Emits `icon_belt_logo` |
| `scripts/build_belt_medallion.py` | **Deleted** |

## Test plan

- [x] `tsc --noEmit` clean
- [x] `vite build` clean; `icon_belt_logo.webp` present in `dist/assets/`
- [x] `vitest run` — 259 tests across 23 files
- [x] Driven through a real round in Chrome at Pixel 9 metrics; headline measured
      at one line (36px tall at 26.78px, no overflow)
- [ ] TestFlight smoke-test on device
- [ ] Play internal-track smoke-test on device

## Known loose ends

Four assets are now unreferenced in `src/` and were left in place rather than
swept up in a layout release: `icon_restart.webp`, `icon_home.webp`,
`icon_view_log.webp`, and `icon_belt.webp`. The last is still needed as the
*source* PNG's pipeline entry; the other three are dead.

ESLint does not run repo-wide — `eslint.config` declares `plugins` as an array
of strings, which flat config rejects. Pre-existing, unrelated to this release.
