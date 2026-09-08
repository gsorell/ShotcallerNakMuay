# Release Notes — v1.17.3

**versionCode:** 96 · **Previous:** v1.17.2 (versionCode 95)

An instrumentation release. Nothing in this build changes what a native app
user sees — the one perceptible fix is web-only — and it ships to the stores
anyway, because the analytics fixes only take effect in a new binary.

---

## What shipped

### GA4 could not tell web from Android

`trackEvent` stamped `platform` only on the Measurement Protocol path, which
is iOS. Web and Android both leave through `window.gtag`, and the Android app
is a Capacitor webview reporting to the **same measurement ID as the marketing
site** — so every Android session has been landing in GA4 indistinguishable
from a browser session.

Every question of the form "how do web visitors compare to app users" was
therefore unanswerable, and every number read as web was really web plus
Android. Two dashboard analyses in September 2026 answered exactly that
question anyway, both concluding there was no cannibalisation. The conclusion
may well be right; the numbers could not establish it.

The tell was in the data all along: `paywall_purchase_success`,
`paywall_restore` and `paywall_legacy_claim` all carry counts, and **none of
them can happen in a browser** — the web branch of `PaywallModal` renders store
links instead of plans, and `restore` returns early with no RevenueCat key.

`Capacitor.getPlatform()` returns `web`, `android` or `ios`, so stamping it on
the gtag path labels the browser too. `app_version` rides along for the same
reason: the Measurement Protocol path already sent it and gtag did not, so
release-over-release comparison worked on iOS only.

### `workout_complete` had no call site

`AnalyticsEvents.WorkoutComplete` was declared and never sent by anything.
GA4 recorded **1,225 `workout_start` events and zero completions** across the
90 days to 2026-09-07 — which reads as a delivery fault, and is simply a
missing call.

It now fires from `handleWorkoutComplete`, with params mirroring `WorkoutStart`
so starts and finishes cut the same way (style, difficulty, round count), plus
`guided` to separate the roadmap path from the style grid.

Note that `roadmap_level_complete` is **not** a substitute and never was: it
fires only for guided Start Here levels, so any rounds-completed figure built
on it misses everything started from the style grid.

### The install prompt no longer lands mid-round (web only)

The prompt's strongest criterion — `completedWorkouts > 0`, "they trained and
it worked" — had never once been true, because nothing in the app ever
incremented the counter. It fell through to `timeOnSite >= 120` instead, which
for anyone who pressed start is roughly the middle of round one: an install
modal over the live callouts.

The counter is now wired to the completion screen, and the prompt is
suppressed over a running round, on the completion screen, and in any session
where the paywall has already opened — the web paywall is itself a store
hand-off, so following it with an install modal is the same ask twice.

Corroboration that this was really happening: `pwa_prompt_dismissed` outran
`pwa_install_accept` 68 to 10 over 90 days.

**Native users never saw this prompt** (`Capacitor.isNativePlatform()` returns
early), so nothing about it is perceptible on iOS or Android.

### Landing page leads with the stores

Not in this binary — deployed to Netlify with `13ccdcb` — but part of the same
piece of work. The hero led with "Start a round — free" above the store
badges. The browser build has no purchase path at all, so it was spending the
page's strongest moment on the one route that cannot take money. Store badges
are now primary and carry the accent glow; the browser link survives as a line
of small print, keeping `data-cta="hero_app"` so `open_web_app` stays
comparable across the change.

---

## Neither analytics fix backfills

Clean, platform-segmented data starts at this deploy for web, and **only when
these store builds reach users** for the apps. The 90 days behind us stay
ambiguous. Expect a window where the Android segment looks empty because
installed users are still running versionCode 95 or older.

## Verify after release

- GA4 DebugView: confirm `workout_complete` arrives at all — a fresh call site
  is exactly the kind of thing that looks instrumented and isn't.
- Confirm `platform` is populated and takes all three values across web,
  TestFlight and the Play internal track.

---

## Play Console release notes (500 char limit)

```
Under-the-hood improvements to how the app measures its own usage, so we can
tell which parts of the app people actually finish and fix the ones they don't.
No change to how training works.
```

### App Store Connect "What's New"

```
Under-the-hood improvements to how the app measures its own usage, so we can
see which parts people actually finish and put the work where it's needed.
Nothing about training changes in this update.
```

Both are deliberately thin, because this release genuinely has nothing a user
can perceive. If that reads as too slight to justify a review cycle, the
alternative was to hold these fixes for the next feature release — at the cost
of every day of app analytics in between.
