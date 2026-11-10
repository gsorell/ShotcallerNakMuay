# Release Notes — v1.25.0

**Date:** 2026-11-10
**versionCode:** 113
**Type:** Feature. **Record My Session**: the front camera films the session
from a corner of the timer screen and the app cuts a highlight reel (and a
~15 s short) automatically, saved to the phone's gallery. Also: several
techniques can be picked to call between callouts, and the long pause after a
single-word callout is gone. Free, not Pro.

New native permissions this release: camera and microphone (both platforms),
add-to-Photos (iOS). **The store privacy forms must be updated before
submitting** — see "Store forms" below.

---

## 1. Record My Session (`src/features/session-video/`)

Turned on from the app menu ("Record My Session"). While a session runs, a
small mirrored camera preview sits in a corner of the timer screen; × turns it
off for that session.

**How the reel is made**
- Every callout is filmed as its own short clip (overlapping MediaRecorders,
  with a one-at-a-time fallback). A motion meter samples the camera 10×/s and
  an AudioWorklet hit detector counts strikes landing; hits heard while the
  app itself is speaking or playing a sound don't score.
- Each clip is trimmed to its movement (call + 300 ms, or the first movement,
  until motion settles) and scored: movement against the session median,
  plus clean hits, weighted by what was called (combinations and power
  strikes up, defence-only down). A clip with no movement is never kept.
- During each rest the round's best clips are picked — a technique at most
  once a round and never twice running — and assembled into the reel, so the
  final wait is about one round's share. The round's best clip gets half-speed
  slow motion around its peak.
- Follow-cam framing from a movement heat map, the true (un-mirrored) view,
  the Shot Caller watermark centred along the bottom.
- The title (logo, rounds × length, date) is drawn over the opening action
  from frame 0; an end card closes it with callouts and minutes worked.
- Sound: the built-in mic, mastered (compressor → limiter → soft clip, about
  −13 LUFS, peaks around −3.6 dBFS).
- Length: about 4 s per minute of work (12–60 s). Reels of 22 s or more also
  get an automatic short (~15 s, best clips in order, title and end card).
- The finished file is remuxed to fast-start MP4 (mediabunny) so galleries can
  scrub it, and saved automatically: Android to
  `Android/media/com.shotcallernakmuay.app/Shot Caller/`, iOS to Photos
  (add-only). The short is saved as `…_short`.
- The completion screen shows the result first, then a "Your reel is ready"
  row opening a full-screen player (with sound, Full/Short switch, Share).

**Guards**
- A stopped session keeps a reel only after about a round's work.
- Nothing is filmed at 15% battery or below while not charging (Android; iOS
  has no Battery API).
- Raw clips live only in memory and are released as soon as they are used or
  dropped; only the finished reel and short are written.

**Bluetooth speakers (Android).** A getUserMedia request for the default mic
put a connected Bluetooth speaker into hands-free call mode (narrowband
callouts, feedback), and the WebView never released it. The mic is now
opened by the built-in input's deviceId (`micChoice.ts`, remembered across
launches). The crackle that remained came from low-latency (MMAP) output
streams fighting the Pixel's Bluetooth mixer: the mic keeps AGC on, every
AudioContext — including the app's own `useSoundEffects` on Android — asks
for `latencyHint: "playback"`, and the preview element gets video tracks
only. Verified on a Pixel 9 Pro XL with a Bluetooth speaker: no SCO, no
low-latency streams, no mixer resyncs.

New analytics events: `session_reel_created`, `session_reel_short_created`,
`session_reel_saved`, `session_reel_error` (stage: camera / battery / …),
`session_reel_cut_switch`.

## 2. Several techniques between callouts (`fd3a3b4`)

"Between callouts" was one of Off / Jab / Check / Jab-Check. It is now a set
of toggles — Jab, Check, Teep, Block, Slip — and one of those picked is
called at random after each combination. Saved settings carry over ("either"
→ Jab + Check, "off" → none).

## 3. No long pause after a single technique (`98aa341`)

Voices trail on after they finish, so a single-word callout's measured length
earned it over two seconds of extra wait. The tail is now measured from the
shortest callout and taken out of both the work counted and the wait; a
between-callout gets a rest of its own.

---

## Store forms (before submitting)

- **App Store Connect → App Privacy:** the app now accesses the camera and
  microphone and saves to Photos. Video and audio are processed on device and
  never collected by us, so no new *collected* data type — but review the
  answers and make sure nothing claims the app doesn't use the camera.
- **Play Console → Data safety:** same reasoning (on-device only, not
  collected). Review the Photos and videos / Audio sections. Play may also
  ask about the new CAMERA / RECORD_AUDIO permissions.
- Privacy policy already covers Session Video (`docs/PRIVACY_POLICY.md`).

## Test plan

- 411 unit tests pass; `tsc -p tsconfig.app.json` clean.
- Pixel 9 Pro XL (debug builds, Bluetooth speaker): multi-round pad and
  shadowboxing sessions, reels saved and scrubbable in the gallery.
- Desktop Chrome: full reel and short rendered with the real renderer;
  duration matches the renderer's timing to ~20 ms; −12.8 LUFS.
- **Not yet tested on an iPhone.** The TestFlight build is the first iOS run
  of camera + mic + Photos save — smoke-test it before submitting for review.

## Store copy

**App Store "What's New":**

New: Record My Session. Turn it on in the menu and Shot Caller films your
session from the corner of the screen, then cuts a highlight reel of your
best moments automatically, with slow motion on the round's best strike and
a short version ready to post. Reels are saved straight to Photos and never
leave your phone unless you share them. Free for everyone.

You can also now pick several techniques to be called between combinations
(jab, check, teep, block, slip), and single-word callouts no longer leave a
long pause.

**Play Store (≤500 chars):**

New: Record My Session. Shot Caller films your session from the corner of the
screen and cuts a highlight reel of your best moments automatically, plus a
short version ready to post. Saved to your gallery, never uploaded. Free.

Also: pick several techniques to be called between combos, and no more long
pause after single-word callouts.
