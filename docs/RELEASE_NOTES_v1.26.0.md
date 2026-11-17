# Release Notes — v1.26.0

**Date:** 2026-11-17
**versionCode:** 117
**Type:** Minor. Full-session recording, plus call, music and share fixes.
Commits `4c2c076`..`34793ed`.

---

## Keep the full session (`rawCapture.ts`, `recordPreference.ts`, `VideoRemuxPlugin.java`, `Fmp4Index.java`)

The whole session, uncut, is now saved beside the reel as `..._full`
("Also keep the full session" in Session settings, on by default). Record my
session moves from the menu to a Rec button on the setup screen
(`StickyStartControls.tsx`, `RoundStructureSheet.tsx`).

**Scrubbing.** MediaRecorder writes fragmented MP4 with no index, so the
gallery can't seek in it, and the file is too big to remux in the WebView.
Android remuxes it natively. In a real session the video runs ~40 s behind
the sound, so the first fragments hold empty video runs; MediaExtractor read
those as end-of-video and saved a sound-only file, which the gallery hides.
`Fmp4Index` reads every sample from the fragments itself (matches ffprobe:
1258 frames from a 50 s session) and converts NAL lengths to start codes for
MediaMuxer. Under a second for 50 s. A track that still comes out empty
keeps the original.

**iOS:** no native remux yet. `remuxFileToMp4` returns null off Android and
the original file is kept: it plays, but may not scrub.

The full session is never paused: pause()/resume() garbles the Pixel's MP4
recorder output. The reel's end card now counts every call, matching the
completion screen's "shots called".

## Ringing calls (`useRingingCall.ts`, `AudioSessionPlugin.java`, `WorkoutProvider.tsx`)

Android reports a call as it rings. The session (callouts and camera) pauses
at the first ring; ignored or declined, it resumes on its own; answered, it
waits for Resume as before.

## Music during reel assembly (`reelRenderer.ts`)

An unmuted `<video>` in the WebView takes audio focus, so music apps stopped
at every rest bell while the round's clips were assembled. On Android the
clips' sound is now decoded and played through Web Audio, which takes no
focus; the element stays muted.

## Share fixes (`imageUtils.ts`)

- Android words a dismissed share sheet "Share canceled", not AbortError, so
  closing it raised "Unable to share". Now silent.
- A session with every style picked made a card file name past Android's
  255-byte limit; styles are now cut at a word boundary.

## Test plan

- [x] Unit tests (new: `remuxFile.test.ts`, `imageUtils.test.ts` cases).
- [x] Pixel: 50 s full session saved, scrubbable, 1258 frames.
- [ ] Pixel: incoming call pauses and auto-resumes when declined.
- [ ] Pixel: music keeps playing through rest bells with recording on.
- [ ] iPhone: full session saves and plays (unindexed is expected).

## Store notes

The call and music fixes are Android-only, so the notes differ.

**Play (≤500 chars):**
Keep your whole session: alongside the highlight reel, Shot Caller now saves
the full, uncut video of your workout to your gallery. Start recording from
the new Rec button on the setup screen. Your music keeps playing while each
round's reel is put together, an incoming call pauses the session and picks
back up if you don't answer, and closing the share sheet no longer shows an
error.

**App Store:**
Keep your whole session: alongside the highlight reel, Shot Caller now saves
the full, uncut video of your workout to your photos. Start recording from
the new Rec button on the setup screen.
