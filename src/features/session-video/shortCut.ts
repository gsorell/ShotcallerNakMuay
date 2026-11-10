import { ReelRenderer, type RenderClip, type ReelSegment } from "./reelRenderer";
import type { SessionReel } from "./reelStore";
import { remuxToMp4 } from "./remux";

/**
 * The short cut: the reel's best stretches in about 15 seconds, for feeds
 * where short posts do best. Cut from the finished reel itself — already
 * framed, slowed, watermarked and loudness-matched — so it costs one more
 * pass at playback speed after the session, and nothing during it.
 *
 *   picked   the highest-scoring clips that fit SHORT_BODY_MS
 *   order    as they happened (the reel already builds to each round's best)
 *   opens    with the title over the first clip, like the full reel
 *   closes   on the reel's own end card
 *
 * Only for reels long enough for a shorter one to be different.
 */
export const SHORT_BODY_MS = 12000;
export const MIN_REEL_FOR_SHORT_MS = 22000;
/** Trimmed off each end of a stretch: the reel's cuts aren't frame-exact. */
const EDGE_MS = 60;

/** The stretches the short is made of, in reel order. */
export const pickShortSegments = (
  segments: ReelSegment[],
  bodyMs = SHORT_BODY_MS
): ReelSegment[] => {
  const byScore = [...segments].sort((a, b) => b.score - a.score);
  const picked: ReelSegment[] = [];
  let used = 0;
  for (const s of byScore) {
    const len = s.toMs - s.fromMs;
    if (used + len > bodyMs && picked.length) continue;
    picked.push(s);
    used += len;
  }
  return picked.sort((a, b) => a.fromMs - b.fromMs);
};

/** Builds the short from `reel`, or resolves null if it shouldn't have one. */
export const buildShortCut = async (reel: SessionReel): Promise<SessionReel | null> => {
  const cut = reel.cut;
  if (!cut || reel.durationMs < MIN_REEL_FOR_SHORT_MS || !cut.segments.length) {
    return null;
  }
  const picks = pickShortSegments(cut.segments);
  const renderer = new ReelRenderer({
    withAudio: cut.withAudio,
    watermark: false, // already on every frame of the source
    master: false, // already mastered
  });
  // The reel's opening carries its title already; anywhere else gets one.
  if (picks[0] !== cut.segments[0]) renderer.setTitle(cut.title);
  const clips: RenderClip[] = picks.map((s) => ({
    url: reel.url,
    startMs: s.fromMs + EDGE_MS,
    endMs: s.toMs - EDGE_MS,
    still: true,
    seek: true,
  }));
  if (cut.endCardFromMs !== null) {
    clips.push({
      url: reel.url,
      startMs: cut.endCardFromMs + EDGE_MS,
      endMs: reel.durationMs,
      still: true,
      seek: true,
    });
  }
  try {
    await renderer.add(clips, () => undefined);
    const out = await renderer.finish();
    if (!out) return null;
    const { blob, remuxed } = await remuxToMp4(out.blob);
    return {
      blob,
      url: URL.createObjectURL(blob),
      ext: remuxed || out.type.includes("mp4") ? "mp4" : "webm",
      durationMs: Math.round(renderer.renderedMs),
      clips: picks.length,
    };
  } catch (e) {
    console.warn("Short cut not made:", e);
    renderer.dispose();
    return null;
  }
};
