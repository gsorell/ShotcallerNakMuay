package com.shotcallernakmuay.app;

import android.graphics.Bitmap;
import android.graphics.PointF;
import android.media.MediaMetadataRetriever;
import android.os.Build;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.pose.Pose;
import com.google.mlkit.vision.pose.PoseDetection;
import com.google.mlkit.vision.pose.PoseDetector;
import com.google.mlkit.vision.pose.PoseLandmark;
import com.google.mlkit.vision.pose.defaults.PoseDetectorOptions;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * ReelProbe: is the fighter in the picture at these moments of the session?
 *
 * The reel planner (reelPlan.ts) scores clips on motion, which can't tell a
 * fighter behind the bag or half out of the frame from a good shot. So for
 * each candidate it asks for a few frames, and this decodes each one
 * (MediaMetadataRetriever, closest frame, not the nearest keyframe), shrinks
 * it to about 360 px wide and runs ML Kit pose detection on it (bundled
 * model, single-image mode).
 *
 * `visible` is the share of 13 core body points (nose, shoulders, elbows,
 * wrists, hips, knees, ankles) that ML Kit is at least 50% sure are in the
 * frame and that also lie inside it, a 1% border counting as outside. `box`
 * is those points' bounding box as fractions of the frame.
 *
 * One retriever and one detector serve every frame; call on a worker thread
 * (Tasks.await blocks).
 */
final class ReelProbe {

  static final class Frame {
    final long tMs;
    final boolean person;
    final double visible;
    /** x, y, w, h as fractions of the frame; null without a person. */
    final double[] box;

    Frame(long tMs, boolean person, double visible, double[] box) {
      this.tMs = tMs;
      this.person = person;
      this.visible = visible;
      this.box = box;
    }
  }

  private static final int[] CORE = {
    PoseLandmark.NOSE,
    PoseLandmark.LEFT_SHOULDER,
    PoseLandmark.RIGHT_SHOULDER,
    PoseLandmark.LEFT_ELBOW,
    PoseLandmark.RIGHT_ELBOW,
    PoseLandmark.LEFT_WRIST,
    PoseLandmark.RIGHT_WRIST,
    PoseLandmark.LEFT_HIP,
    PoseLandmark.RIGHT_HIP,
    PoseLandmark.LEFT_KNEE,
    PoseLandmark.RIGHT_KNEE,
    PoseLandmark.LEFT_ANKLE,
    PoseLandmark.RIGHT_ANKLE,
  };

  private static final float MIN_LIKELIHOOD = 0.5f;
  private static final double MARGIN = 0.01;
  private static final int PROBE_WIDTH = 360;

  private ReelProbe() {}

  static List<Frame> probe(String path, long[] timesMs) throws Exception {
    List<Frame> out = new ArrayList<>(timesMs.length);
    MediaMetadataRetriever retriever = new MediaMetadataRetriever();
    PoseDetector detector = PoseDetection.getClient(
      new PoseDetectorOptions.Builder().setDetectorMode(PoseDetectorOptions.SINGLE_IMAGE_MODE).build()
    );
    try {
      retriever.setDataSource(path);
      int[] size = probeSize(retriever);
      for (long tMs : timesMs) {
        Bitmap frame = grab(retriever, tMs * 1000L, size);
        if (frame == null) {
          out.add(new Frame(tMs, false, 0, null));
          continue;
        }
        try {
          Pose pose = Tasks.await(detector.process(InputImage.fromBitmap(frame, 0)), 10, TimeUnit.SECONDS);
          out.add(measure(tMs, pose, frame.getWidth(), frame.getHeight()));
        } finally {
          frame.recycle();
        }
      }
    } finally {
      detector.close();
      try {
        retriever.release();
      } catch (Throwable ignored) {
        /* nothing to keep */
      }
    }
    return out;
  }

  /** Target size about PROBE_WIDTH wide, aspect kept (rotation applied). */
  private static int[] probeSize(MediaMetadataRetriever r) {
    int w = parse(r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH), 720);
    int h = parse(r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT), 1280);
    int rot = parse(r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION), 0);
    if (rot == 90 || rot == 270) {
      int t = w;
      w = h;
      h = t;
    }
    int tw = Math.min(PROBE_WIDTH, w);
    int th = Math.max(1, Math.round((float) h * tw / w));
    return new int[] { tw, th };
  }

  private static Bitmap grab(MediaMetadataRetriever r, long us, int[] size) {
    if (Build.VERSION.SDK_INT >= 27) {
      Bitmap b = r.getScaledFrameAtTime(us, MediaMetadataRetriever.OPTION_CLOSEST, size[0], size[1]);
      if (b != null) return b;
    }
    Bitmap full = r.getFrameAtTime(us, MediaMetadataRetriever.OPTION_CLOSEST);
    if (full == null) return null;
    if (full.getWidth() <= size[0]) return full;
    int th = Math.max(1, Math.round((float) full.getHeight() * size[0] / full.getWidth()));
    Bitmap small = Bitmap.createScaledBitmap(full, size[0], th, true);
    if (small != full) full.recycle();
    return small;
  }

  private static Frame measure(long tMs, Pose pose, int w, int h) {
    if (pose == null || pose.getAllPoseLandmarks().isEmpty()) return new Frame(tMs, false, 0, null);
    int seen = 0;
    double minX = Double.MAX_VALUE, minY = Double.MAX_VALUE, maxX = -Double.MAX_VALUE, maxY = -Double.MAX_VALUE;
    for (int type : CORE) {
      PoseLandmark lm = pose.getPoseLandmark(type);
      if (lm == null || lm.getInFrameLikelihood() < MIN_LIKELIHOOD) continue;
      PointF p = lm.getPosition();
      double x = p.x / w;
      double y = p.y / h;
      if (x < MARGIN || x > 1 - MARGIN || y < MARGIN || y > 1 - MARGIN) continue;
      seen++;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    if (seen == 0) return new Frame(tMs, true, 0, null);
    return new Frame(tMs, true, (double) seen / CORE.length, new double[] { minX, minY, maxX - minX, maxY - minY });
  }

  private static int parse(String s, int fallback) {
    if (s == null) return fallback;
    try {
      return Integer.parseInt(s.trim());
    } catch (NumberFormatException e) {
      return fallback;
    }
  }
}
