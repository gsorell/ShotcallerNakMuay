package com.shotcallernakmuay.app;

import android.content.Context;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.net.Uri;
import android.os.Handler;
import android.os.HandlerThread;
import androidx.media3.common.C;
import androidx.media3.common.Effect;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.audio.AudioProcessor;
import androidx.media3.common.audio.BaseAudioProcessor;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.effect.FrameDropEffect;
import androidx.media3.effect.Presentation;
import androidx.media3.transformer.Composition;
import androidx.media3.transformer.DefaultEncoderFactory;
import androidx.media3.transformer.EditedMediaItem;
import androidx.media3.transformer.EditedMediaItemSequence;
import androidx.media3.transformer.Effects;
import androidx.media3.transformer.ExportException;
import androidx.media3.transformer.ExportResult;
import androidx.media3.transformer.Transformer;
import androidx.media3.transformer.VideoEncoderSettings;
import java.io.File;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * ReelExport: the highlight reel, cut from the full-session recording after
 * the session.
 *
 * The chosen clips go back to back, in order, through Media3 Transformer: a
 * sequence of clipped items, each scaled and cropped to fill the output size
 * (Presentation) and held to the output frame rate (FrameDropEffect; the
 * source is never faster, so nothing is invented), re-encoded as H.264 at the
 * requested bitrate with AAC sound. Re-encoding is what makes the cuts
 * frame-accurate; a stream copy could only cut on keyframes.
 *
 * Sound: one gain for the whole reel, toward `targetLufs` and kept below a
 * −1 dBFS peak, plus a 20 ms fade in and out at every cut so the joins don't
 * click. The gain comes from a first pass that decodes the chosen ranges'
 * audio and measures RMS and peak. RMS dBFS stands in for LUFS: approximate,
 * no K-weighting, no limiter.
 *
 * Transformer wants a Looper thread; it gets its own HandlerThread, which
 * quits once the export ends either way.
 */
@UnstableApi
final class ReelExport {

  interface Callback {
    void done(String uri, String summary, long durationMs);

    void failed(String message);
  }

  static final class Options {
    int width = 1080;
    int height = 1920;
    float fps = 30;
    int videoBps = 10_000_000;
    double targetLufs = -14;
  }

  private static final double PEAK_CEILING_DB = -1;
  /** Never louder than this, whatever the measurement says (a near-silent session). */
  private static final double MAX_GAIN_DB = 24;
  private static final int FADE_MS = 20;

  private ReelExport() {}

  /** Measures, then exports; reports through `cb` from another thread. */
  static void run(Context context, String inPath, long[][] clips, String outPath, Options o, Callback cb) {
    final Level level;
    try {
      level = measure(inPath, clips);
    } catch (Throwable e) {
      cb.failed("measuring the sound failed: " + e);
      return;
    }
    final double gainDb = level.gainDb(o.targetLufs);
    final float gain = (float) Math.pow(10, gainDb / 20);

    HandlerThread thread = new HandlerThread("ReelExport");
    thread.start();
    Handler handler = new Handler(thread.getLooper());
    handler.post(() -> {
      try {
        List<EditedMediaItem> items = new ArrayList<>(clips.length);
        Uri uri = Uri.fromFile(new File(inPath));
        long totalMs = 0;
        for (long[] c : clips) {
          long ms = c[1] - c[0];
          totalMs += ms;
          MediaItem item = new MediaItem.Builder()
            .setUri(uri)
            .setClippingConfiguration(
              new MediaItem.ClippingConfiguration.Builder().setStartPositionMs(c[0]).setEndPositionMs(c[1]).build()
            )
            .build();
          List<AudioProcessor> audio = new ArrayList<>();
          audio.add(new GainFade(gain, ms));
          List<Effect> video = new ArrayList<>();
          video.add(Presentation.createForWidthAndHeight(o.width, o.height, Presentation.LAYOUT_SCALE_TO_FIT_WITH_CROP));
          video.add(FrameDropEffect.createDefaultFrameDropEffect(o.fps));
          items.add(new EditedMediaItem.Builder(item).setEffects(new Effects(audio, video)).build());
        }
        Composition composition = new Composition.Builder(new EditedMediaItemSequence.Builder(items).build()).build();

        final long plannedMs = totalMs;
        Transformer transformer = new Transformer.Builder(context)
          .setLooper(thread.getLooper())
          .setVideoMimeType(MimeTypes.VIDEO_H264)
          .setAudioMimeType(MimeTypes.AUDIO_AAC)
          .setEncoderFactory(
            new DefaultEncoderFactory.Builder(context)
              .setRequestedVideoEncoderSettings(new VideoEncoderSettings.Builder().setBitrate(o.videoBps).build())
              .setEnableFallback(true)
              .build()
          )
          .addListener(
            new Transformer.Listener() {
              @Override
              public void onCompleted(Composition c, ExportResult r) {
                long durationMs = r.durationMs != C.TIME_UNSET ? r.durationMs : plannedMs;
                String bitrate = r.averageVideoBitrate != C.RATE_UNSET_INT
                  ? String.format(Locale.ROOT, "%.1f Mbps", r.averageVideoBitrate / 1e6)
                  : String.format(Locale.ROOT, "%.1f Mbps requested", o.videoBps / 1e6);
                String summary = String.format(
                  Locale.ROOT,
                  "%d clips, %.1fs, %dx%d@%.0f, gain %+.1f dB (rms %.1f, peak %.1f dBFS), %s",
                  clips.length,
                  durationMs / 1000.0,
                  o.width,
                  o.height,
                  o.fps,
                  gainDb,
                  level.rmsDb(),
                  level.peakDb(),
                  bitrate
                );
                cb.done(Uri.fromFile(new File(outPath)).toString(), summary, durationMs);
                thread.quitSafely();
              }

              @Override
              public void onError(Composition c, ExportResult r, ExportException e) {
                //noinspection ResultOfMethodCallIgnored
                new File(outPath).delete();
                cb.failed("export failed: " + e.getErrorCodeName() + " " + e.getMessage());
                thread.quitSafely();
              }
            }
          )
          .build();
        //noinspection ResultOfMethodCallIgnored
        new File(outPath).delete();
        transformer.start(composition, outPath);
      } catch (Throwable e) {
        //noinspection ResultOfMethodCallIgnored
        new File(outPath).delete();
        cb.failed("export failed: " + e);
        thread.quitSafely();
      }
    });
  }

  /** RMS and peak of the chosen ranges' sound, as fractions of full scale. */
  static final class Level {
    double sumSquares;
    long samples;
    double peak;

    double rmsDb() {
      return samples == 0 || sumSquares <= 0 ? Double.NEGATIVE_INFINITY : 10 * Math.log10(sumSquares / samples);
    }

    double peakDb() {
      return peak <= 0 ? Double.NEGATIVE_INFINITY : 20 * Math.log10(peak);
    }

    /** Toward `target`, held so the peak stays at or under the ceiling; 0 with no sound. */
    double gainDb(double target) {
      if (samples == 0 || peak <= 0) return 0;
      double g = target - rmsDb();
      g = Math.min(g, PEAK_CEILING_DB - peakDb());
      return Math.min(g, MAX_GAIN_DB);
    }
  }

  /** Decodes each range's audio (MediaExtractor + MediaCodec) and folds it into a Level. */
  static Level measure(String path, long[][] clips) throws Exception {
    Level level = new Level();
    MediaExtractor extractor = new MediaExtractor();
    try {
      extractor.setDataSource(path);
      int track = -1;
      MediaFormat format = null;
      for (int i = 0; i < extractor.getTrackCount(); i++) {
        MediaFormat f = extractor.getTrackFormat(i);
        String mime = f.getString(MediaFormat.KEY_MIME);
        if (mime != null && mime.startsWith("audio/")) {
          track = i;
          format = f;
          break;
        }
      }
      if (track < 0) return level; // no sound: gain 0
      extractor.selectTrack(track);
      String mime = format.getString(MediaFormat.KEY_MIME);
      for (long[] c : clips) {
        MediaCodec codec = MediaCodec.createDecoderByType(mime);
        try {
          codec.configure(format, null, null, 0);
          codec.start();
          decodeRange(extractor, codec, c[0] * 1000L, c[1] * 1000L, level);
        } finally {
          try {
            codec.stop();
          } catch (Throwable ignored) {
            /* already failing */
          }
          codec.release();
        }
      }
    } finally {
      extractor.release();
    }
    return level;
  }

  private static void decodeRange(MediaExtractor ex, MediaCodec codec, long fromUs, long toUs, Level level) {
    ex.seekTo(fromUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC);
    MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
    boolean inputDone = false;
    boolean floatPcm = false;
    while (true) {
      if (!inputDone) {
        int in = codec.dequeueInputBuffer(10_000);
        if (in >= 0) {
          long t = ex.getSampleTime();
          ByteBuffer buf = codec.getInputBuffer(in);
          int size = t < 0 || t > toUs || buf == null ? -1 : ex.readSampleData(buf, 0);
          if (size < 0) {
            codec.queueInputBuffer(in, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM);
            inputDone = true;
          } else {
            codec.queueInputBuffer(in, 0, size, t, 0);
            ex.advance();
          }
        }
      }
      int out = codec.dequeueOutputBuffer(info, 10_000);
      if (out == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
        MediaFormat f = codec.getOutputFormat();
        floatPcm = f.containsKey(MediaFormat.KEY_PCM_ENCODING) &&
          f.getInteger(MediaFormat.KEY_PCM_ENCODING) == android.media.AudioFormat.ENCODING_PCM_FLOAT;
      } else if (out >= 0) {
        ByteBuffer buf = codec.getOutputBuffer(out);
        if (buf != null && info.size > 0 && info.presentationTimeUs >= fromUs && info.presentationTimeUs <= toUs) {
          buf.position(info.offset);
          buf.limit(info.offset + info.size);
          ByteBuffer b = buf.slice().order(ByteOrder.nativeOrder());
          if (floatPcm) {
            while (b.remaining() >= 4) fold(level, b.getFloat());
          } else {
            while (b.remaining() >= 2) fold(level, b.getShort() / 32768.0);
          }
        }
        codec.releaseOutputBuffer(out, false);
        if ((info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) return;
      }
    }
  }

  private static void fold(Level level, double s) {
    level.sumSquares += s * s;
    level.samples++;
    double a = Math.abs(s);
    if (a > level.peak) level.peak = a;
  }

  /**
   * One clip's sound: the reel's gain, faded in over its first 20 ms and out
   * over its last. One per clip, so its position counts from the clip start.
   */
  static final class GainFade extends BaseAudioProcessor {

    private final float gain;
    private final long clipMs;
    private long totalFrames;
    private long fadeFrames;
    private long frame;

    GainFade(float gain, long clipMs) {
      this.gain = gain;
      this.clipMs = clipMs;
    }

    @Override
    protected AudioFormat onConfigure(AudioFormat in) throws UnhandledAudioFormatException {
      if (in.encoding != C.ENCODING_PCM_16BIT && in.encoding != C.ENCODING_PCM_FLOAT) {
        throw new UnhandledAudioFormatException(in);
      }
      totalFrames = clipMs * in.sampleRate / 1000;
      fadeFrames = Math.max(1, (long) FADE_MS * in.sampleRate / 1000);
      return in;
    }

    @Override
    public void queueInput(ByteBuffer input) {
      int channels = inputAudioFormat.channelCount;
      boolean isFloat = inputAudioFormat.encoding == C.ENCODING_PCM_FLOAT;
      int bytesPerFrame = channels * (isFloat ? 4 : 2);
      int frames = input.remaining() / bytesPerFrame;
      ByteBuffer out = replaceOutputBuffer(frames * bytesPerFrame);
      ByteBuffer src = input.order(ByteOrder.nativeOrder());
      for (int f = 0; f < frames; f++) {
        float g = gain * envelope(frame++);
        for (int ch = 0; ch < channels; ch++) {
          if (isFloat) {
            float v = src.getFloat() * g;
            out.putFloat(Math.max(-1f, Math.min(1f, v)));
          } else {
            float v = src.getShort() * g;
            out.putShort((short) Math.max(Short.MIN_VALUE, Math.min(Short.MAX_VALUE, Math.round(v))));
          }
        }
      }
      // Any partial frame left over is dropped (never happens with whole PCM frames).
      input.position(input.limit());
      out.flip();
    }

    private float envelope(long f) {
      float e = 1f;
      if (f < fadeFrames) e = (float) f / fadeFrames;
      if (totalFrames > 0) {
        long left = totalFrames - f;
        if (left < fadeFrames) e = Math.min(e, Math.max(0f, (float) left / fadeFrames));
      }
      return e;
    }

    @Override
    protected void onFlush() {
      frame = 0;
    }

    @Override
    protected void onReset() {
      frame = 0;
      totalFrames = 0;
      fadeFrames = 0;
    }
  }
}
