package com.shotcallernakmuay.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Rect;
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
import androidx.media3.effect.BitmapOverlay;
import androidx.media3.effect.Crop;
import androidx.media3.effect.FrameDropEffect;
import androidx.media3.effect.OverlayEffect;
import androidx.media3.effect.Presentation;
import androidx.media3.effect.StaticOverlaySettings;
import androidx.media3.effect.TextureOverlay;
import androidx.media3.transformer.Composition;
import androidx.media3.transformer.DefaultEncoderFactory;
import androidx.media3.transformer.EditedMediaItem;
import androidx.media3.transformer.EditedMediaItemSequence;
import androidx.media3.transformer.Effects;
import androidx.media3.transformer.ExportException;
import androidx.media3.transformer.ExportResult;
import androidx.media3.transformer.ProgressHolder;
import androidx.media3.transformer.Transformer;
import androidx.media3.transformer.VideoEncoderSettings;
import java.io.File;
import java.io.InputStream;
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
 * A clip may carry a crop (in millionths of the frame, after its from/to):
 * Crop before Presentation, so the fighter fills more of the reel. The
 * watermark burned into the recording sits below every crop, so a cropped
 * clip gets it drawn back on (OverlayEffect) where watermark.ts draws it:
 * centred along the bottom, 45% of the width, a 3.5% margin, a soft shadow.
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

    /** How far the export has got, 0 to 100; from the export's thread. */
    default void progress(int percent) {}
  }

  /** How often progress is read while the export runs. */
  private static final long PROGRESS_EVERY_MS = 250;
  /** A clip left shorter than this by the picture's end is dropped. */
  private static final long MIN_CLIP_MS = 300;

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

  /** A clip's crop is given in millionths of the frame. */
  static final double CROP_UNIT = 1_000_000;
  /** The banner the app draws over its recordings (watermark.ts). */
  private static final String WATERMARK_ASSET = "public/assets/Logo_Header_Banner_Smooth.webp";

  private ReelExport() {}

  /** Measures, then exports; reports through `cb` from another thread. */
  static void run(Context context, String inPath, long[][] asked, String outPath, Options o, Callback cb) {
    // Never past the picture's end. Where the sound runs on beyond it (the
    // recording's last seconds can have sound and no frames), Transformer
    // holds the last frame for the rest of the clip: the reel froze on it.
    final long[][] clips;
    try {
      clips = withinPicture(asked, videoEndMs(inPath));
    } catch (Throwable e) {
      cb.failed("reading the recording failed: " + e);
      return;
    }
    if (clips.length == 0) {
      cb.failed("no clip falls within the picture");
      return;
    }
    final Level level;
    try {
      level = measure(inPath, clips);
    } catch (Throwable e) {
      cb.failed("measuring the sound failed: " + e);
      return;
    }
    final double gainDb = level.gainDb(o.targetLufs);
    final float gain = (float) Math.pow(10, gainDb / 20);

    final Bitmap mark = hasCrop(clips) ? watermark(context, o.width, o.height) : null;

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
          Crop crop = cropOf(c);
          if (crop != null) video.add(crop);
          video.add(Presentation.createForWidthAndHeight(o.width, o.height, Presentation.LAYOUT_SCALE_TO_FIT_WITH_CROP));
          if (crop != null && mark != null) video.add(watermarkEffect(mark, o.width, o.height));
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
                  "%d clips%s, %.1fs, %dx%d@%.0f, gain %+.1f dB (rms %.1f, peak %.1f dBFS), %s",
                  clips.length,
                  trimmedNote(asked, clips),
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
        // Read on the export's own thread (Transformer insists), until the
        // thread quits with the export.
        final ProgressHolder holder = new ProgressHolder();
        handler.postDelayed(
          new Runnable() {
            int last = -1;

            @Override
            public void run() {
              int state = transformer.getProgress(holder);
              if (state == Transformer.PROGRESS_STATE_NOT_STARTED) return;
              if (state == Transformer.PROGRESS_STATE_AVAILABLE && holder.progress != last) {
                last = holder.progress;
                cb.progress(last);
              }
              handler.postDelayed(this, PROGRESS_EVERY_MS);
            }
          },
          PROGRESS_EVERY_MS
        );
      } catch (Throwable e) {
        //noinspection ResultOfMethodCallIgnored
        new File(outPath).delete();
        cb.failed("export failed: " + e);
        thread.quitSafely();
      }
    });
  }

  /**
   * Where the picture ends, in ms from the file's first sample (the clips'
   * zero, as in remuxToMp4): the last video frame's time plus one frame.
   * Long.MAX_VALUE if the file has no picture to measure.
   */
  static long videoEndMs(String path) throws Exception {
    MediaExtractor ex = new MediaExtractor();
    try {
      ex.setDataSource(path);
      int video = -1;
      for (int i = 0; i < ex.getTrackCount(); i++) {
        String mime = ex.getTrackFormat(i).getString(MediaFormat.KEY_MIME);
        if (mime != null && (mime.startsWith("video/") || mime.startsWith("audio/"))) ex.selectTrack(i);
        if (video < 0 && mime != null && mime.startsWith("video/")) video = i;
      }
      if (video < 0) return Long.MAX_VALUE;
      ex.seekTo(0, MediaExtractor.SEEK_TO_PREVIOUS_SYNC);
      long t0Us = Math.max(0, ex.getSampleTime());
      for (int i = 0; i < ex.getTrackCount(); i++) if (i != video) ex.unselectTrack(i);
      // From the last keyframe (seconds from the end) to the last frame.
      ex.seekTo(Long.MAX_VALUE / 2, MediaExtractor.SEEK_TO_PREVIOUS_SYNC);
      long lastUs = -1;
      long frameUs = 33_333;
      while (ex.getSampleTrackIndex() >= 0) {
        long t = ex.getSampleTime();
        if (t > lastUs) {
          if (lastUs >= 0) frameUs = t - lastUs;
          lastUs = t;
        }
        if (!ex.advance()) break;
      }
      if (lastUs < 0) return Long.MAX_VALUE;
      return (lastUs + Math.max(frameUs, 1) - t0Us) / 1000;
    } finally {
      ex.release();
    }
  }

  /** " (last cut at the picture's end)" and the like, for the log; "" if nothing changed. */
  static String trimmedNote(long[][] asked, long[][] kept) {
    long askedMs = 0;
    long keptMs = 0;
    for (long[] c : asked) askedMs += c[1] - c[0];
    for (long[] c : kept) keptMs += c[1] - c[0];
    if (askedMs == keptMs) return "";
    return String.format(
      Locale.ROOT,
      " (%d dropped, %.1fs cut past the picture's end)",
      asked.length - kept.length,
      (askedMs - keptMs) / 1000.0
    );
  }

  /** `clips` cut off at `endMs`; any left shorter than MIN_CLIP_MS dropped. */
  static long[][] withinPicture(long[][] clips, long endMs) {
    List<long[]> out = new ArrayList<>(clips.length);
    for (long[] c : clips) {
      long to = Math.min(c[1], endMs);
      if (to - c[0] < MIN_CLIP_MS) continue;
      long[] kept = c.clone(); // a crop, if any, stays with its clip
      kept[1] = to;
      out.add(kept);
    }
    return out.toArray(new long[0][]);
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

  static boolean hasCrop(long[][] clips) {
    for (long[] c : clips) if (c.length >= 6) return true;
    return false;
  }

  /**
   * A clip's crop as Media3 wants it (normalised device coordinates, -1 to
   * 1, y up), or null for the whole frame.
   */
  static Crop cropOf(long[] c) {
    if (c.length < 6) return null;
    float x = (float) (c[2] / CROP_UNIT);
    float y = (float) (c[3] / CROP_UNIT);
    float w = (float) (c[4] / CROP_UNIT);
    float h = (float) (c[5] / CROP_UNIT);
    if (!(w > 0.05f && h > 0.05f) || x < 0 || y < 0 || x + w > 1.0001f || y + h > 1.0001f) return null;
    if (w > 0.999f && h > 0.999f) return null;
    return new Crop(2 * x - 1, 2 * (x + w) - 1, 1 - 2 * (y + h), 1 - 2 * y);
  }

  /** Space around the banner for its shadow, as a share of the banner's height. */
  private static final float SHADOW_PAD = 0.25f;

  /**
   * The watermark at its size in the reel, with its shadow, as watermark.ts
   * draws it: 45% of the width. Null if the banner can't be read.
   */
  static Bitmap watermark(Context context, int width, int height) {
    try (InputStream in = context.getAssets().open(WATERMARK_ASSET)) {
      Bitmap src = BitmapFactory.decodeStream(in);
      if (src == null) return null;
      int markW = Math.round(width * 0.45f);
      int markH = Math.round((float) markW * src.getHeight() / src.getWidth());
      int pad = Math.round(markH * SHADOW_PAD);
      Bitmap out = Bitmap.createBitmap(markW + 2 * pad, markH + 2 * pad, Bitmap.Config.ARGB_8888);
      Canvas canvas = new Canvas(out);
      Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
      paint.setShadowLayer(Math.max(1, markH * 0.12f), 0, 0, 0xB3000000);
      canvas.drawBitmap(src, new Rect(0, 0, src.getWidth(), src.getHeight()), new Rect(pad, pad, pad + markW, pad + markH), paint);
      src.recycle();
      return out;
    } catch (Throwable e) {
      return null;
    }
  }

  /** The watermark, centred along the bottom with watermark.ts's margin. */
  static OverlayEffect watermarkEffect(Bitmap mark, int width, int height) {
    float margin = Math.min(width, height) * 0.035f;
    // Padded evenly for the shadow, so the bitmap's centre is the banner's.
    float bannerH = mark.getHeight() / (1 + 2 * SHADOW_PAD);
    float centreFromBottom = margin + bannerH / 2;
    StaticOverlaySettings settings = new StaticOverlaySettings.Builder()
      .setOverlayFrameAnchor(0, 0)
      .setBackgroundFrameAnchor(0, -1 + 2 * centreFromBottom / height)
      .build();
    List<TextureOverlay> overlays = new ArrayList<>(1);
    overlays.add(BitmapOverlay.createStaticBitmapOverlay(mark, settings));
    return new OverlayEffect(overlays);
  }
}
