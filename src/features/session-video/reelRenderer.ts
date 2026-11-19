import { loadWatermark } from "./watermark";

/**
 * What the recording opens and closes on, drawn onto its canvas: the title
 * over the opening action and the end card (see fullSession.ts), and the
 * recorder's format.
 *
 * This was the reel's renderer, which re-filmed each picked clip onto a
 * canvas during the rests. The reel is now cut from the recording natively
 * after the session (reelPlan.ts, remux.ts: exportReel).
 */

/** A card: a few lines of text under the logo, on the brand's dark. */
export interface Card {
  lines: string[];
  durationMs: number;
}

/**
 * MP4 first: it plays everywhere and Photos takes it. WebM where it's not.
 * With sound, AAC where the recorder offers it (iOS), Opus otherwise.
 */
export const pickMime = (withAudio = false): string => {
  const candidates = withAudio
    ? [
        "video/mp4;codecs=avc1,mp4a.40.2",
        "video/mp4;codecs=avc1,opus",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ]
    : [
        "video/mp4;codecs=avc1",
        "video/mp4",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
  for (const m of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* try the next */
    }
  }
  return "";
};

/**
 * The title over the opening action: a band of shade across the upper
 * middle, and in it the logo, the session and the day. In full from the
 * first frame.
 */
export const drawTitleOverlay = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  card: Card
): void => {
  ctx.save();
  const band = ctx.createLinearGradient(0, h * 0.12, 0, h * 0.62);
  band.addColorStop(0, "rgba(12,7,16,0)");
  band.addColorStop(0.3, "rgba(12,7,16,0.72)");
  band.addColorStop(0.7, "rgba(12,7,16,0.72)");
  band.addColorStop(1, "rgba(12,7,16,0)");
  ctx.fillStyle = band;
  ctx.fillRect(0, h * 0.12, w, h * 0.5);
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = Math.round(Math.min(w, h) * 0.02);
  drawCardContent(ctx, w, h, card, h * 0.33, "#e6dcef");
  ctx.restore();
};

/** The logo above `baseY`, then the card's lines under it. */
const drawCardContent = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  card: Card,
  baseY: number,
  secondary: string
): void => {
  const unit = Math.min(w, h);
  const logo = loadWatermark();
  let y = baseY;
  if (logo && logo.complete && logo.naturalWidth > 0) {
    const lw = Math.min(w * 0.82, unit * 0.9);
    const lh = (lw * logo.naturalHeight) / logo.naturalWidth;
    ctx.drawImage(logo, (w - lw) / 2, y - lh, lw, lh);
  }
  y += unit * 0.1;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  card.lines.forEach((line, i) => {
    const size = i === 0 ? unit * 0.075 : unit * 0.045;
    ctx.font = `${i === 0 ? 900 : 700} ${Math.round(size)}px Poppins, system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = i === 0 ? "#f4eef6" : secondary;
    ctx.fillText(line, w / 2, y);
    y += size * 1.6;
  });
};

/**
 * A card on the brand's near-black: the logo, then a big first line and
 * smaller ones under it. No fade-in: on screen in full from the first frame,
 * because the title card's first frame is the reel's thumbnail in a gallery
 * and a feed, and faded it read as an empty reel.
 */
export const drawCard = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  card: Card
): void => {
  ctx.save();
  ctx.fillStyle = "#0c0710";
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, h * 0.5);
  glow.addColorStop(0, "#2a1030");
  glow.addColorStop(1, "#0c0710");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  drawCardContent(ctx, w, h, card, h * 0.36, "#9d8fa9");
  ctx.restore();
};

/** An error as one short line. */
export const errText = (e: unknown): string =>
  e instanceof Error ? `${e.name}: ${e.message}` : String(e);
