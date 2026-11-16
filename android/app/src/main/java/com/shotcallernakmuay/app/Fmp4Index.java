package com.shotcallernakmuay.app;

import java.io.IOException;
import java.io.RandomAccessFile;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Where every sample of a fragmented MP4 is, read straight from its boxes
 * (moov for the tracks, then each moof/traf/trun).
 *
 * Why not MediaExtractor: the phone's MediaRecorder, filming a whole session
 * while the clip recorders also run, let the video fall ~40 s behind the
 * sound. Its first fragments hold the sound and an empty run for the video,
 * and MediaExtractor takes that empty run as the end of the video track: a
 * 13.9 MB session with 1258 frames came out of it with none (2026-11-16).
 * ffprobe, and this, read all of them.
 */
final class Fmp4Index {

  static final class Track {
    final int id;
    final String handler; // "vide", "soun", ...
    final long timescale;
    final List<Sample> samples = new ArrayList<>();
    long nextDts = 0;

    Track(int id, String handler, long timescale) {
      this.id = id;
      this.handler = handler;
      this.timescale = timescale;
    }
  }

  static final class Sample {
    final long offset;
    final int size;
    final long ptsUs;
    final boolean sync;

    Sample(long offset, int size, long ptsUs, boolean sync) {
      this.offset = offset;
      this.size = size;
      this.ptsUs = ptsUs;
      this.sync = sync;
    }
  }

  /** In the order of the trak boxes, which is MediaExtractor's track order. */
  final List<Track> tracks = new ArrayList<>();
  int fragments = 0;
  int maxSampleSize = 0;

  private final Map<Integer, Track> byId = new HashMap<>();
  private final Map<Integer, long[]> trex = new HashMap<>(); // id -> {duration, size, flags}

  static Fmp4Index read(RandomAccessFile f) throws IOException {
    Fmp4Index index = new Fmp4Index();
    long len = f.length();
    long at = 0;
    while (at + 8 <= len) {
      f.seek(at);
      long size = f.readInt() & 0xffffffffL;
      int type = f.readInt();
      int header = 8;
      if (size == 1) {
        size = f.readLong();
        header = 16;
      } else if (size == 0) {
        size = len - at;
      }
      if (size < header || at + size > len) break; // a torn tail
      if (type == fourcc("moov") || type == fourcc("moof")) {
        if (size > 64L * 1024 * 1024) throw new IOException("box too large");
        byte[] body = new byte[(int) (size - header)];
        f.readFully(body);
        if (type == fourcc("moov")) index.parseMoov(body);
        else index.parseMoof(body, at);
      }
      at += size;
    }
    return index;
  }

  // --- moov --------------------------------------------------------------

  private void parseMoov(byte[] b) {
    for (int[] box : children(b, 0, b.length)) {
      if (box[0] == fourcc("trak")) parseTrak(b, box[1], box[2]);
      else if (box[0] == fourcc("mvex")) {
        for (int[] t : children(b, box[1], box[2])) {
          if (t[0] != fourcc("trex")) continue;
          int p = t[1] + 4;
          int id = i32(b, p);
          trex.put(id, new long[] {u32(b, p + 8), u32(b, p + 12), u32(b, p + 16)});
        }
      }
    }
  }

  private void parseTrak(byte[] b, int from, int to) {
    int id = -1;
    long timescale = 0;
    String handler = "";
    for (int[] box : children(b, from, to)) {
      if (box[0] == fourcc("tkhd")) {
        int v = b[box[1]] & 0xff;
        id = i32(b, box[1] + (v == 1 ? 20 : 12));
      } else if (box[0] == fourcc("mdia")) {
        for (int[] m : children(b, box[1], box[2])) {
          if (m[0] == fourcc("mdhd")) {
            int v = b[m[1]] & 0xff;
            timescale = u32(b, m[1] + (v == 1 ? 20 : 12));
          } else if (m[0] == fourcc("hdlr")) {
            handler = new String(b, m[1] + 8, 4, java.nio.charset.StandardCharsets.ISO_8859_1);
          }
        }
      }
    }
    if (id < 0 || timescale <= 0) return;
    Track t = new Track(id, handler, timescale);
    tracks.add(t);
    byId.put(id, t);
  }

  // --- moof --------------------------------------------------------------

  private void parseMoof(byte[] b, long moofStart) {
    fragments++;
    long prevTrafEnd = -1;
    for (int[] box : children(b, 0, b.length)) {
      if (box[0] != fourcc("traf")) continue;
      prevTrafEnd = parseTraf(b, box[1], box[2], moofStart, prevTrafEnd);
    }
  }

  /** Returns where this traf's data ended, the next one's default base. */
  private long parseTraf(byte[] b, int from, int to, long moofStart, long prevEnd) {
    Track track = null;
    long base = prevEnd >= 0 ? prevEnd : moofStart;
    long defDuration = 0, defSize = 0, defFlags = 0;
    Long tfdt = null;
    List<int[]> truns = new ArrayList<>();
    for (int[] box : children(b, from, to)) {
      if (box[0] == fourcc("tfhd")) {
        int flags = i32(b, box[1]) & 0xffffff;
        int p = box[1] + 4;
        int id = i32(b, p);
        p += 4;
        track = byId.get(id);
        long[] d = trex.get(id);
        if (d != null) {
          defDuration = d[0];
          defSize = d[1];
          defFlags = d[2];
        }
        if ((flags & 0x1) != 0) {
          base = i64(b, p);
          p += 8;
        } else if ((flags & 0x20000) != 0) {
          base = moofStart;
        }
        if ((flags & 0x2) != 0) p += 4;
        if ((flags & 0x8) != 0) {
          defDuration = u32(b, p);
          p += 4;
        }
        if ((flags & 0x10) != 0) {
          defSize = u32(b, p);
          p += 4;
        }
        if ((flags & 0x20) != 0) defFlags = u32(b, p);
      } else if (box[0] == fourcc("tfdt")) {
        int v = b[box[1]] & 0xff;
        tfdt = v == 1 ? i64(b, box[1] + 4) : u32(b, box[1] + 4);
      } else if (box[0] == fourcc("trun")) {
        truns.add(box);
      }
    }
    if (track == null) return base;
    long dts = tfdt != null ? tfdt : track.nextDts;
    long pos = base;
    for (int[] box : truns) {
      int vf = i32(b, box[1]);
      int version = (vf >>> 24) & 0xff;
      int flags = vf & 0xffffff;
      int p = box[1] + 4;
      long count = u32(b, p);
      p += 4;
      if ((flags & 0x1) != 0) {
        pos = base + i32(b, p);
        p += 4;
      }
      Long firstFlags = null;
      if ((flags & 0x4) != 0) {
        firstFlags = u32(b, p);
        p += 4;
      }
      for (long i = 0; i < count; i++) {
        long duration = defDuration, size = defSize, sflags = defFlags, cts = 0;
        if ((flags & 0x100) != 0) {
          duration = u32(b, p);
          p += 4;
        }
        if ((flags & 0x200) != 0) {
          size = u32(b, p);
          p += 4;
        }
        if ((flags & 0x400) != 0) {
          sflags = u32(b, p);
          p += 4;
        } else if (i == 0 && firstFlags != null) {
          sflags = firstFlags;
        }
        if ((flags & 0x800) != 0) {
          cts = version == 0 ? u32(b, p) : i32(b, p);
          p += 4;
        }
        boolean sync = (sflags & 0x10000) == 0;
        long ptsUs = (dts + cts) * 1_000_000L / track.timescale;
        track.samples.add(new Sample(pos, (int) size, ptsUs, sync));
        maxSampleSize = Math.max(maxSampleSize, (int) size);
        pos += size;
        dts += duration;
      }
    }
    track.nextDts = dts;
    return pos;
  }

  // --- bytes -------------------------------------------------------------

  /** {type, contentStart, end} for each box directly inside [from, to). */
  private static List<int[]> children(byte[] b, int from, int to) {
    List<int[]> out = new ArrayList<>();
    int at = from;
    while (at + 8 <= to) {
      long size = u32(b, at);
      int type = i32(b, at + 4);
      int header = 8;
      if (size == 1) {
        size = i64(b, at + 8);
        header = 16;
      } else if (size == 0) {
        size = to - at;
      }
      if (size < header || at + size > to) break;
      out.add(new int[] {type, at + header, (int) (at + size)});
      at += (int) size;
    }
    return out;
  }

  static int fourcc(String s) {
    return (s.charAt(0) << 24) | (s.charAt(1) << 16) | (s.charAt(2) << 8) | s.charAt(3);
  }

  private static int i32(byte[] b, int p) {
    return ((b[p] & 0xff) << 24) | ((b[p + 1] & 0xff) << 16) | ((b[p + 2] & 0xff) << 8) | (b[p + 3] & 0xff);
  }

  private static long u32(byte[] b, int p) {
    return i32(b, p) & 0xffffffffL;
  }

  private static long i64(byte[] b, int p) {
    return (u32(b, p) << 32) | u32(b, p + 4);
  }
}
