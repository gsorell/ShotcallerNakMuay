# Release Notes — v1.27.0

**Date:** 2026-11-18
**versionCode:** 118
**Type:** Minor. iPhone session video: full session with sound, no reel. Callout and playback fixes.
Commits `051f8b2`..`05a8ece` (branch `feat/ios-reel-sound`, fast-forwarded onto `70764a2`).

---

## iPhone: the full session with sound, no reel (`recordPreference.ts`, `reelRecorder.ts`, `AppDelegate.swift`)

The session's sound is recorded natively (`RecordingAudioPlugin`) and laid
under the full session when it's exported (`VideoRemuxPlugin`). Rests are
cut and the video is branded.

The highlight reel is **off on iOS** (`REEL_ON_IOS = false`). Re-filming
the clips through a canvas in the web view froze for 0.7 to 1.2 s at a time
(TestFlight builds 100 to 104). Those freezes were holes in the file: the
page itself stopped running, so no JS watchdog could catch them. On iOS,
clip recorders, the motion meter and the renderer are not started. The full
session is always kept, and the "Also keep the full session" switch is
hidden. Android is unchanged.

Still in the code and used on Android: reel sound laid natively
(`laySoundUnderReel`), clips that play before the recorder rolls, the hiccup
pause, and hole closing in `remuxToMp4` (`reelHoles.ts`) for reels with no
sound track of their own.

## Callouts died on the second session after a launch (`patches/@capacitor-community+text-to-speech+6.1.0.patch`, `ttsService.ts`)

iOS: after one filmed session, the next spoke nothing until the app was
restarted (`calls 4, spoken 0`). Each session switches the audio session to
recording and back. The one long-lived `AVSpeechSynthesizer` never started a
phrase again, its call never resolved, and every later callout queued
behind it.

- The plugin replaces the synthesizer before the next phrase after any
  audio category change.
- It keeps one call per utterance.
- If a phrase hasn't started within 2 s, it replaces the synthesizer and
  says the phrase once more.

JS gives up on any native phrase after 8 s (`NATIVE_SPEAK_TIMEOUT_MS`), on
both platforms, so one stuck phrase can't block the rest.

patch-package can't regenerate this patch on the Windows machine (the
`android/build` paths are too long). It was built with `git diff --no-index`
against `npm pack` output, then checked against a fresh copy.

## Bell, warning and clack silent from the second filmed session (`AppDelegate.swift`, `useSoundEffects.ts`)

iOS: from the second filmed session after a launch, the bell and the
clack were silent. They came out all at once when the app was left and
opened again (TestFlight 107-109). It was the app's own audio output that
stalled, not WebKit's. Rebuilding the AudioContext (108) and playing the
cues natively (109) each failed in the same way on their own.

The fix (110) is in `RecordingAudioPlugin.reactivate`: the session is
deactivated and activated again into the new category when recording
starts and stops, instead of only switching the category. The trace
showed that the deactivation at recording *start* succeeds and is the
part that matters. At stop it fails ("Session deactivation failed": the
camera is still running), which is harmless.

On iOS the cues also now play natively through `NativeSoundsPlugin`
(AVAudioPlayer, files from the bundle's `public/`, preloaded at workout
start), with Web Audio as the fallback. Android and the web are
unchanged.

## Watch and share the full session (`SessionReelCard.tsx`, `fullSession.ts`, `shareReel.ts`, `reelStore.ts`)

Once the full session is saved, the completion screen shows a "Watch your
session" row. It opens the reel's full-screen player, generalised as
`VideoViewer`, with Share (which sends the file URI) and Watch again. The
rewritten file stays in the app's cache after the gallery save (both
platforms copy it, never move it). Each save deletes older
`shotcaller-raw-*` files, so the cache holds one session. This applies on
Android too when the full session is kept.

The session trace was removed from the completion screen, both "Details"
and the reel failure's "Tap for details". It is still saved with the notes.

## Test plan

- [x] Unit tests: 453 passing (new: `reelHoles.test.ts`, `nativeSpeechTimeout.test.ts`, `reelSound.test.ts`).
- [x] iPhone (TestFlight 105): the full session saves to Photos with sound and no reel is made.
- [x] iPhone (TestFlight 106): watch and share the full session from the completion screen.
- [x] iPhone (TestFlight 110): bell, warning and callouts in a second filmed session without restarting the app.
- [ ] Pixel: a session with recording on still makes a reel; the full session row plays.

## Store notes

**App Store:**
On iPhone, Shot Caller now saves your whole session to Photos with sound: the rests are cut out and every round is labelled. Watch it or share it straight from the results screen when you finish. Callouts and the bell no longer go quiet when you train a second time without restarting the app.

**Play (≤500 chars):**
Watch your full session right from the results screen when you finish, and share it from there. Callouts are more reliable: one that gets stuck no longer silences the rest of your round.
