package com.shotcallernakmuay.app;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Which stretches of a recording to keep, and where each sample lands once
 * the gaps between them are closed up: how the full session's rests are cut
 * (see fullSession.ts).
 *
 * Spans come in ms from the recording's first frame. A stretch can only
 * start on a video keyframe (the frames after it can't be decoded without
 * it), so each is moved back to the last keyframe at or before its start:
 * the recorder asks for one every 2 s, so a round opens on up to 2 s of the
 * rest before it. The sound is cut at the same moment, so the two stay in
 * step. Overlapping stretches (after that move) are merged.
 */
final class KeepCut {

  /** Kept stretches, in file time (µs), sorted and apart. */
  final long[] fromUs;
  final long[] toUs;
  /** What each stretch's samples move back by. */
  final long[] shiftUs;

  private KeepCut(long[] fromUs, long[] toUs, long[] shiftUs) {
    this.fromUs = fromUs;
    this.toUs = toUs;
    this.shiftUs = shiftUs;
  }

  /**
   * `spansMs`: {fromMs, toMs} pairs. `t0Us`: the file time of the first
   * frame. `syncUs`: the video's keyframe times, sorted; empty for a file
   * with no video. Null if nothing is left to keep.
   */
  static KeepCut plan(long[][] spansMs, long t0Us, long[] syncUs) {
    List<long[]> spans = new ArrayList<>();
    for (long[] s : spansMs) {
      if (s == null || s.length < 2 || s[1] <= s[0]) continue;
      long from = t0Us + s[0] * 1000L;
      long to = t0Us + s[1] * 1000L;
      spans.add(new long[] { snapBack(from, syncUs), to });
    }
    if (spans.isEmpty()) return null;
    spans.sort((a, b) -> Long.compare(a[0], b[0]));
    List<long[]> merged = new ArrayList<>();
    for (long[] s : spans) {
      long[] last = merged.isEmpty() ? null : merged.get(merged.size() - 1);
      if (last != null && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
      else merged.add(s);
    }
    int n = merged.size();
    long[] from = new long[n];
    long[] to = new long[n];
    long[] shift = new long[n];
    long cursor = 0;
    for (int i = 0; i < n; i++) {
      from[i] = merged.get(i)[0];
      to[i] = merged.get(i)[1];
      shift[i] = from[i] - cursor;
      cursor += to[i] - from[i];
    }
    return new KeepCut(from, to, shift);
  }

  /** The last keyframe at or before `t`; `t` itself if there's none. */
  static long snapBack(long t, long[] syncUs) {
    int i = Arrays.binarySearch(syncUs, t);
    if (i >= 0) return syncUs[i];
    int before = -i - 2;
    return before >= 0 ? syncUs[before] : t;
  }

  /** Where a sample at `ptsUs` lands, or -1 if it's cut. */
  long map(long ptsUs) {
    for (int i = 0; i < fromUs.length; i++) {
      if (ptsUs < fromUs[i]) return -1;
      if (ptsUs < toUs[i]) return ptsUs - shiftUs[i];
    }
    return -1;
  }

  /** How long the cut file runs, in µs. */
  long keptUs() {
    long n = 0;
    for (int i = 0; i < fromUs.length; i++) n += toUs[i] - fromUs[i];
    return n;
  }
}
