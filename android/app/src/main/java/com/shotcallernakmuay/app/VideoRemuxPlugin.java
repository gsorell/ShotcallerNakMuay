package com.shotcallernakmuay.app;

import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import android.net.Uri;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;

/**
 * VideoRemuxPlugin: rewrites a recorder-made video, on disk, as an ordinary
 * indexed MP4 that gallery apps can scrub.
 *
 * MediaRecorder writes fragmented MP4 (an empty header, then pieces with no
 * index). It plays, but the gallery can't seek in it. Reels are fixed in JS
 * (remux.ts) because they are small enough to hold in memory; the full
 * session runs to hundreds of MB, and the WebView can't read a file on disk a
 * piece at a time (Capacitor's local server answers a Range request with the
 * file from byte 0). So it is done here, file to file: Fmp4Index finds the
 * samples (MediaExtractor loses the video in a real session's file; see
 * there), MediaExtractor gives the track formats, and MediaMuxer writes it
 * all with full sample tables. Stream copy, no re-encode: under a second for
 * a 50 s session.
 *
 * Given `keep` (the stretches of the session that were work), only those
 * are written, back to back: the full session's rests are cut (KeepCut).
 * Still a stream copy. If the cut leaves a track empty or fails, the whole
 * file is written instead, uncut, rather than nothing.
 *
 * Runs on its own thread: Capacitor calls every plugin on one shared thread,
 * and a long session would hold up every other plugin call behind it.
 */
@CapacitorPlugin(name = "VideoRemux")
public class VideoRemuxPlugin extends Plugin {

  /** Largest sample expected; grown if a keyframe is bigger. */
  private static final int START_BUFFER = 4 * 1024 * 1024;

  /**
   * `{ from, to, keep? }`: file:// URIs (or paths), and the stretches to keep
   * as `[{ fromMs, toMs }]` from the first frame. Resolves `{ uri, summary }`
   * of the written file. Rejects on any failure, leaving `from` untouched and
   * removing a half-written `to`.
   */
  @PluginMethod
  public void remuxToMp4(PluginCall call) {
    String from = call.getString("from");
    String to = call.getString("to");
    if (from == null || to == null) {
      call.reject("from and to are required");
      return;
    }
    final String inPath = toPath(from);
    final String outPath = toPath(to);
    final long[][] keep = readSpans(call.getArray("keep", null));
    new Thread(
      () -> {
        try {
          String summary;
          if (keep != null) {
            try {
              summary = remux(inPath, outPath, keep);
            } catch (Throwable cutFailed) {
              //noinspection ResultOfMethodCallIgnored
              new File(outPath).delete();
              summary = remux(inPath, outPath, null) + ", uncut (" + cutFailed.getMessage() + ")";
            }
          } else {
            summary = remux(inPath, outPath, null);
          }
          JSObject result = new JSObject();
          result.put("uri", Uri.fromFile(new File(outPath)).toString());
          result.put("summary", summary);
          // Whether any sound made it in (see remux's summary: "audio/... N").
          result.put("audio", summary.matches("(?s).*audio/\\S+ [1-9].*"));
          call.resolve(result);
        } catch (Throwable e) {
          //noinspection ResultOfMethodCallIgnored
          new File(outPath).delete();
          call.reject("remux failed: " + e);
        }
      },
      "VideoRemux"
    ).start();
  }

  /** `[{ fromMs, toMs }]` as pairs; null if absent or empty. */
  private static long[][] readSpans(JSArray arr) {
    if (arr == null || arr.length() == 0) return null;
    List<long[]> out = new ArrayList<>();
    for (int i = 0; i < arr.length(); i++) {
      JSONObject o = arr.optJSONObject(i);
      if (o == null || !o.has("fromMs") || !o.has("toMs")) continue;
      out.add(new long[] { o.optLong("fromMs"), o.optLong("toMs") });
    }
    return out.isEmpty() ? null : out.toArray(new long[0][]);
  }

  private static String toPath(String uriOrPath) {
    if (uriOrPath.startsWith("file:")) {
      String p = Uri.parse(uriOrPath).getPath();
      if (p != null) return p;
    }
    return uriOrPath;
  }

  /** Returns what was copied, e.g. "video/avc 1500, audio/mp4a-latm 2400 from 16.2MB". */
  private static String remux(String inPath, String outPath, long[][] keep) throws Exception {
    MediaExtractor extractor = new MediaExtractor();
    MediaMuxer muxer = null;
    boolean started = false;
    try {
      extractor.setDataSource(inPath);
      muxer = new MediaMuxer(outPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);

      int count = extractor.getTrackCount();
      int[] trackMap = new int[count];
      String[] mimes = new String[count];
      long[] perTrack = new long[count];
      int bufferSize = START_BUFFER;
      int kept = 0;
      for (int i = 0; i < count; i++) {
        trackMap[i] = -1;
        MediaFormat format = extractor.getTrackFormat(i);
        String mime = format.getString(MediaFormat.KEY_MIME);
        mimes[i] = mime;
        if (mime == null || !(mime.startsWith("video/") || mime.startsWith("audio/"))) continue;
        extractor.selectTrack(i);
        trackMap[i] = muxer.addTrack(format);
        kept++;
        if (mime.startsWith("video/") && format.containsKey(MediaFormat.KEY_ROTATION)) {
          muxer.setOrientationHint(format.getInteger(MediaFormat.KEY_ROTATION));
        }
        if (format.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)) {
          bufferSize = Math.max(bufferSize, format.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE));
        }
      }
      if (kept == 0) throw new IllegalStateException("no audio or video tracks");

      muxer.start();
      started = true;

      long samples;
      KeepCut cut = null;
      try (RandomAccessFile file = new RandomAccessFile(inPath, "r")) {
        Fmp4Index index = Fmp4Index.read(file);
        if (index.fragments > 0) {
          cut = keep != null ? planCut(index, trackMap, keep) : null;
          if (keep != null && cut == null) throw new IllegalStateException("nothing to keep");
          samples = copyFromIndex(index, file, extractor, trackMap, perTrack, muxer, cut);
        } else {
          // Not what MediaRecorder writes; copied whole.
          if (keep != null) throw new IllegalStateException("can't cut an unfragmented file");
          samples = copyFromExtractor(extractor, trackMap, perTrack, muxer, bufferSize);
        }
      }
      StringBuilder summary = new StringBuilder();
      boolean emptyTrack = false;
      for (int i = 0; i < count; i++) {
        if (trackMap[i] < 0) continue;
        if (summary.length() > 0) summary.append(", ");
        summary.append(mimes[i]).append(' ').append(perTrack[i]);
        if (perTrack[i] == 0) emptyTrack = true;
      }
      summary.append(String.format(java.util.Locale.ROOT, " from %.1fMB", new File(inPath).length() / 1e6));
      if (cut != null) {
        summary.append(String.format(java.util.Locale.ROOT, ", %d spans kept (%.0fs)", cut.fromUs.length, cut.keptUs() / 1e6));
      }
      // A track with nothing in it makes a file the gallery won't show (a
      // full session once came out as sound only): keep the original instead.
      if (samples == 0 || emptyTrack) throw new IllegalStateException("empty track: " + summary);
      muxer.stop();
      started = false;
      return summary.toString();
    } finally {
      if (muxer != null) {
        if (started) {
          try {
            muxer.stop();
          } catch (Throwable ignored) {
            /* already failing */
          }
        }
        muxer.release();
      }
      extractor.release();
    }
  }

  /**
   * Fragmented MP4 (what MediaRecorder writes): the samples as Fmp4Index
   * found them, interleaved by time. MediaExtractor is still what read the
   * track formats (codec config and all); see Fmp4Index for why not the
   * samples.
   */
  private static long copyFromIndex(
    Fmp4Index index,
    RandomAccessFile file,
    MediaExtractor extractor,
    int[] trackMap,
    long[] perTrack,
    MediaMuxer muxer,
    KeepCut cut
  ) throws Exception {
    // Extractor track i is the i-th trak; checked against its kind.
    int n = extractor.getTrackCount();
    if (index.tracks.size() != n) throw new IllegalStateException("track count " + index.tracks.size() + " vs " + n);
    for (int i = 0; i < n; i++) {
      String mime = extractor.getTrackFormat(i).getString(MediaFormat.KEY_MIME);
      String handler = index.tracks.get(i).handler;
      boolean video = mime != null && mime.startsWith("video/");
      boolean audio = mime != null && mime.startsWith("audio/");
      if ((video && !handler.equals("vide")) || (audio && !handler.equals("soun"))) {
        throw new IllegalStateException("track " + i + " is " + mime + " but " + handler);
      }
    }
    // MP4 stores H.264/H.265 as length-prefixed NAL units; MediaMuxer wants
    // them as MediaExtractor hands them over, with start codes (it adds the
    // lengths back itself). Fed as stored, every frame failed to decode.
    boolean[] toAnnexB = new boolean[n];
    for (int i = 0; i < n; i++) {
      String mime = extractor.getTrackFormat(i).getString(MediaFormat.KEY_MIME);
      toAnnexB[i] = "video/avc".equals(mime) || "video/hevc".equals(mime);
    }
    byte[] bytes = new byte[Math.max(index.maxSampleSize, 1)];
    ByteBuffer buffer = ByteBuffer.wrap(bytes);
    MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
    int[] next = new int[n];
    long samples = 0;
    while (true) {
      // The track whose next sample is earliest.
      int pick = -1;
      long pickUs = Long.MAX_VALUE;
      for (int i = 0; i < n; i++) {
        if (trackMap[i] < 0) continue;
        List<Fmp4Index.Sample> list = index.tracks.get(i).samples;
        if (next[i] < list.size() && list.get(next[i]).ptsUs < pickUs) {
          pick = i;
          pickUs = list.get(next[i]).ptsUs;
        }
      }
      if (pick < 0) break;
      Fmp4Index.Sample s = index.tracks.get(pick).samples.get(next[pick]++);
      if (s.size <= 0) continue;
      long ptsUs = cut != null ? cut.map(s.ptsUs) : s.ptsUs;
      if (ptsUs < 0) continue;
      file.seek(s.offset);
      file.readFully(bytes, 0, s.size);
      if (toAnnexB[pick]) lengthsToStartCodes(bytes, s.size);
      buffer.clear();
      buffer.limit(s.size);
      info.offset = 0;
      info.size = s.size;
      info.presentationTimeUs = ptsUs;
      info.flags = s.sync ? MediaCodec.BUFFER_FLAG_KEY_FRAME : 0;
      muxer.writeSampleData(trackMap[pick], buffer, info);
      samples++;
      perTrack[pick]++;
    }
    return samples;
  }

  /**
   * The cut for `keep`: the file's first frame is the earliest sample of any
   * kept track, and stretches start on the first video track's keyframes.
   */
  private static KeepCut planCut(Fmp4Index index, int[] trackMap, long[][] keep) {
    long t0 = Long.MAX_VALUE;
    long[] sync = new long[0];
    boolean haveVideo = false;
    for (int i = 0; i < index.tracks.size(); i++) {
      if (trackMap[i] < 0) continue;
      Fmp4Index.Track t = index.tracks.get(i);
      for (Fmp4Index.Sample s : t.samples) t0 = Math.min(t0, s.ptsUs);
      if (!haveVideo && t.handler.equals("vide")) {
        haveVideo = true;
        List<Long> keys = new ArrayList<>();
        for (Fmp4Index.Sample s : t.samples) if (s.sync) keys.add(s.ptsUs);
        sync = new long[keys.size()];
        for (int k = 0; k < sync.length; k++) sync[k] = keys.get(k);
        java.util.Arrays.sort(sync);
      }
    }
    if (t0 == Long.MAX_VALUE) return null;
    return KeepCut.plan(keep, t0, sync);
  }

  /**
   * Rewrites 4-byte NAL lengths as 00 00 00 01, in place (the same size).
   * Left alone if the lengths don't add up to the sample exactly, which
   * would mean another length size or data already in start-code form.
   */
  static void lengthsToStartCodes(byte[] b, int size) {
    int p = 0;
    while (p + 4 <= size) {
      long len = ((b[p] & 0xffL) << 24) | ((b[p + 1] & 0xff) << 16) | ((b[p + 2] & 0xff) << 8) | (b[p + 3] & 0xff);
      if (len == 0 || p + 4 + len > size) return;
      p += 4 + (int) len;
    }
    if (p != size) return;
    p = 0;
    while (p + 4 <= size) {
      int len = ((b[p] & 0xff) << 24) | ((b[p + 1] & 0xff) << 16) | ((b[p + 2] & 0xff) << 8) | (b[p + 3] & 0xff);
      b[p] = 0;
      b[p + 1] = 0;
      b[p + 2] = 0;
      b[p + 3] = 1;
      p += 4 + len;
    }
  }

  /** An ordinary MP4 (or anything not fragmented): MediaExtractor reads it. */
  private static long copyFromExtractor(
    MediaExtractor extractor,
    int[] trackMap,
    long[] perTrack,
    MediaMuxer muxer,
    int bufferSize
  ) {
    ByteBuffer buffer = ByteBuffer.allocateDirect(bufferSize);
    MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
    long samples = 0;
    while (true) {
      int track = extractor.getSampleTrackIndex();
      if (track < 0) break;
      int size;
      try {
        size = extractor.readSampleData(buffer, 0);
      } catch (IllegalArgumentException tooSmall) {
        buffer = ByteBuffer.allocateDirect(buffer.capacity() * 2);
        continue;
      }
      if (size < 0) break;
      info.offset = 0;
      info.size = size;
      info.presentationTimeUs = extractor.getSampleTime();
      info.flags =
        (extractor.getSampleFlags() & MediaExtractor.SAMPLE_FLAG_SYNC) != 0
          ? MediaCodec.BUFFER_FLAG_KEY_FRAME
          : 0;
      if (trackMap[track] >= 0) {
        muxer.writeSampleData(trackMap[track], buffer, info);
        samples++;
        perTrack[track]++;
      }
      extractor.advance();
    }
    return samples;
  }
}
