# Release Notes — v1.28.0

**Date:** 2026-11-24
**versionCode:** 120 (119 / 1.27.1 went only to TestFlight, runs 112-113)
**Type:** Minor. The highlight reel is built natively after the session, on both
platforms, with editing rules and a clip picker. Prices raised the same day.
Commits `2a2803c`..`41146d1` on top of v1.27.0 (`28035fc`).

---

## The reel is built after the session, natively (`reelPlan.ts`, `ReelExport.java`, `ReelProbe.java`, `AppDelegate.swift`)

During the session only the full-session recorder runs, plus a timeline of
calls, speech, hits and motion. Afterwards the reel is planned in TypeScript,
each shortlisted clip is checked for framing with pose detection (Vision on
iOS, ML Kit on Android), and it is exported natively at 1080x1920, 30 fps.
**Reels are on for iPhone again** (off since v1.27.0).

## Pick your own clips (`reelEdit.ts`, completion screen, player)

The player switches between Reel and Full session. Edit clips opens a picker
over the session's shortlisted clips; Rebuild reel cuts it again from the uncut
recording, kept in the cache until the next session. Hand-picked reels run up
to 60 s, in filmed order.

## Reel cut rules (`motion.ts`, `highlights.ts`, `reelPlan.ts`)

- **No waiting.** A clip opens 200 ms before the first real movement after its
  call, and no earlier than the first heard strike's wind-up.
- **Never cut the finish.** A clip's stretch runs 1.2 s past the next call, it
  never ends before the strikes the call asked for have landed, and over its
  length cap it loses its run-up, not its finish.
- **Clean over sloppy.** The pose check compares the fighter's outline at the
  start and the finish; finishing out of stance costs score, and well out of
  stance drops the clip. Thresholds are first guesses.
- **Round order.** The pacing arc tried on 2026-11-22 (`c5dfe96`) is undone.

Not yet checked against a real filmed session. Each session now saves
`files/reel-replay.json` (latest only) so the planner can be re-run on it.

## Filming past the bell, end-card freeze, export progress (`798234c`)

Filming runs 1.5 s past the round bell so the last strike is kept. The end card
is painted on a clock, so reels no longer freeze on their last picture. The
export shows a progress bar and "Keep the app open until it's done".

## Prices (store consoles, `public/home.html`, `docs/STORE_LISTING.md`)

New subscribers only: monthly $3.99 → $5.99, annual $24.99 → $39.99, lifetime
$39.99 → $79.99. Trials unchanged. The website tiers and the App Store
description's subscription block are updated to match.

---

## App Store "What's New"

Your highlight reel is back on iPhone, and it's sharper. After a filmed session Shot Caller cuts the reel from the whole recording: each clip starts when you move, not while you wait, and runs until the combination is finished. Clips where you finish balanced and back in stance are favoured.

Don't like a pick? Tap Edit clips to choose your own and rebuild the reel. Switch between the reel and the full session in the player. Filming now runs just past the bell, so the last strike of a round makes it in, and you'll see progress while the reel is being made.

## Play Store release notes (≤500)

Sharper highlight reels: clips start when you move, not while you wait, and run until the combination is finished. Clean, balanced finishes are favoured. Tap Edit clips to choose your own and rebuild the reel, and switch between the reel and the full session in the player. Filming runs just past the bell so the last strike makes it in.
