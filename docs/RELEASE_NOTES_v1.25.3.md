# Release Notes — v1.25.3

**Date:** 2026-11-13
**versionCode:** 116
**Type:** Patch. Session reel ("Record My Session") quality fixes, from
`b37bc8a`.

---

## Why

Reels were "not terrible, not good". A debug capture of whole sessions let
four reel styles be cut from the same real footage and compared side by side;
the user preferred the app's own short montage, so the montage stays and its
failures were fixed. Every change below was checked by replaying the app's
motion meter offline over real raw footage, which reproduced the phone's
clip-by-clip verdicts exactly.

## Camera disturbances (`motion.ts`, `reelRecorder.ts`)

**Symptom.** Reels opened on the phone being set down, and featured a dog's
nose and a hand over the lens. A round's clips came back empty ("0-0ms" in
`reel-notes.txt`) for about a minute at a time.

**Cause.** Movement scoring can't tell the camera being handled from
training, so disturbances scored as the best action. And the "real movement"
threshold is set from the busiest 5% of the last minute: one walk away from
the phone set it ~8x above real strikes, so every clip for the next 60s read
as "nothing moved". The recorder was not dropping clips.

**Fix.** A motion sample is a disturbance when 30%+ of the frame changes, or
the frame's brightness shifts by 0.03+ (training, even a head kick close to
the lens, stays under ~25% and 0.02). Samples within 1.5s of one are left
out of the threshold and the trim, and a clip near one is dropped
(`clip N: camera disturbed, dropped` in the notes). On a real round, usable
clips went from 17 to 28 of 30.

## Shorter reels, no slow motion, no short cut

- Length: 12s + 0.6s per minute of work, capped at 20s (was 4s/min up to
  60s, with bursts of jump cuts). About one clip per round on a 5 x 3.
- Slow motion at each round's best moment removed (read as random).
- The ~15s "short" cut and the viewer's Full/Short switch removed: no reel
  is long enough to need one.

## Work clock and filming the rest (`reelRecorder.ts`, `SessionCameraPip.tsx`)

A callout scheduled as a round ended arrived after the recorder had paused,
restarted the work clock (a 4 x 3 session's end card read "14 MIN") and
opened a clip that filmed the rest. The recorder now ignores the engine
while holding; a schedule received then is replayed on `resume()` if still
due.

## Native writes in pieces (`reelFile.ts`)

`writeBlobInPieces` sends files to native code 2 MB at a time. A 43 MB
recording sent in one bridge call ran the app's Java heap out of memory and
killed it (debug capture, 2026-11-13); the gallery save had the same exposure
at reel size.

## Debug-only (`rawCapture.ts`)

Films a whole session next to the reel, with a sidecar of callouts, sounds
and hits, when `localStorage.shotcaller_debug_raw_session = "1"` is set by
hand over WebView devtools. Off for everyone else.

## Test plan

- [x] Typecheck, lint, 420 unit tests (new: disturbance rules, reel length).
- [x] Pixel: full 4 x 3 pad session gave a 17.5s, 4-clip reel, disturbances
      dropped, no empty stretches.
- [ ] Pixel: end card minutes match the session (work-clock fix).
- [ ] Pixel and iPhone: reel saves to the gallery (in-pieces write).

## Store notes

**App Store / Play (≤500 chars):**
Your session reel is sharper: it skips the moments you're setting up or
adjusting the phone, picks your best combinations from every round, and
keeps the whole reel short and easy to share.
