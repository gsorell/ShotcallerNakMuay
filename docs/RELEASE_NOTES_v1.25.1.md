# Release Notes — v1.25.1

**Date:** 2026-11-11
**versionCode:** 114
**iOS CI run:** 85 (built from `fix/ios-reel` at `fed4d92`, identical code to `main`)
**Type:** Fix to v1.25.0 before it reached either store. Everything in
[RELEASE_NOTES_v1.25.0.md](./RELEASE_NOTES_v1.25.0.md) applies; ship this
build instead of 1.25.0 on both platforms.

---

## No reel on iPhone

The first iPhone test of 1.25.0 (TestFlight run 84) filmed a session, showed
"Cutting your reel…", then showed nothing and saved nothing.

**Cause (most likely; no iOS console is reachable from the build machine):**
the renderer loaded each kept clip into a hidden `<video>` and waited for
`loadeddata` (5 s). iOS often fetches only metadata until a video is told to
play, so every clip timed out, the reel had no clips, and `finish()` returned
null without saying anything.

**Fix** (`reelRenderer.ts`, `loadFrames`): `preload="auto"` + `load()`; if
no frame arrives within 1.5 s, play (sound goes only to the reel's audio
graph) until one does, then return to the start. A clip blob whose recorder
reported no MIME type is now labelled from its data or the chosen MP4 type
rather than WebM, which Safari won't play.

Verified: iPhone via TestFlight run 85 — reel produced (user, 2026-11-11);
desktop Chrome render unchanged (25.3 s reel, 13.8 s short).

## Failure is now visible

The pipeline traces each step (`ReelNotes.log`): camera and mic, chosen
formats, a refused second recorder, recorder errors, skipped clips with the
reason, the finished file. When a reel was due and none came out:

- the completion screen shows **"Couldn't make your reel this time"**, with
  the trace under **Details** (selectable, for a screenshot);
- GA4 gets `session_reel_error` with `stage: "finish"` and the reason.

A session stopped before a round's work still shows nothing — that is on
purpose, not a failure.

## Store copy

Same as v1.25.0 (see its notes); this is the first build to reach the stores.
