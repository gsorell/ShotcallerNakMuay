# Release Notes — v1.28.2

**Date:** 2026-11-27
**versionCode:** 122 (1.28.1 / 121 went only to TestFlight)
**Type:** Patch. Reels and full-session videos film smoothly again.

---

## Choppy reels: the session was filmed at about 10 fps

A reel from a 5-round session on a Pixel 9 Pro XL (2026-11-27) played at
10.5 fps. The camera was delivering 30 fps; frames were lost on the way into
the full-session recording, which the reel is cut from. Two causes, both on
the page's main thread, both made worse by the move to 1080p in 1.28.1:

### The motion meter read a full 1080p frame back off the GPU (`motion.ts`)

Ten times a second it drew the preview video into a `willReadFrequently`
canvas and read the pixels. Drawing the 1080x1920 video into that canvas
copies the whole frame off the GPU, and that stalled the camera's pipeline:
preview and recording dropped from 30 to about 13-18 fps. It now asks for a
bitmap already shrunk to the 48 px sample (`createImageBitmap` with
`resizeWidth`/`resizeHeight`) and reads that. Same sample size, timing and
thresholds. Where the bitmap can't be made, it reads the old way.

### The recording was written in 2 MB pieces every 10 s (`reelFile.ts`, `fullSession.ts`)

Each 10 s chunk (about 10 MB) went across the native bridge as 2 MB base64
pieces, each holding up the page; drawing stalled for up to 190 ms every
10 s. While filming, pieces are now 256 KB (`LIVE_PIECE`); other writes keep
2 MB.

## Measured on the Pixel 9 Pro XL (2-minute sessions)

| | Before | After |
|---|---|---|
| Frames drawn | 13.3 fps | 29.1 fps |
| Full-session recording | 10.3 fps, 3.5 Mbps | 26.5 fps, 8.7 Mbps |
| Reel | 10.5 fps | 27.3 fps |

The rest of the gap to 30 fps is single frames the encoder skips under load;
not traced further.

## Not yet checked

- A full-length (5-round) session on the new build.
- iPhone: the same code runs there, not measured. Safari falling back to the
  old read keeps the meter working either way.

## Test plan

Film a session with the reel on. In `files/reel-notes.txt`,
`full session drew N frames, X fps` should be near 30; probe the reel with
`ffprobe` and count frames over its length.
