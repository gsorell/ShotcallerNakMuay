/**
 * The header's own banner (icon, SHOT CALLER, MUAY THAI TIMER) on a
 * transparent background. Loaded once; until it has, the reel falls back to
 * the wordmark drawn as text, so no frame goes out unbranded.
 */
const WATERMARK_SRC = "/assets/Logo_Header_Banner_Smooth.webp";
let watermarkImg: HTMLImageElement | null = null;

const loadWatermark = (): HTMLImageElement | null => {
  if (typeof Image === "undefined") return null;
  if (!watermarkImg) {
    watermarkImg = new Image();
    watermarkImg.decoding = "async";
    watermarkImg.src = WATERMARK_SRC;
  }
  return watermarkImg;
};

// Fetched with the module, so it is decoded before the first clip opens.
loadWatermark();

/** The banner in the bottom-right corner, about 45% of the frame's width. */
export const drawWatermark = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void => {
  const img = loadWatermark();
  if (img && img.complete && img.naturalWidth > 0) {
    const margin = Math.round(Math.min(w, h) * 0.035);
    const markW = Math.round(Math.min(w * 0.45, 560));
    const markH = Math.round((markW * img.naturalHeight) / img.naturalWidth);
    ctx.save();
    // A soft shadow lifts the neon off a bright room behind it.
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = Math.round(markH * 0.12);
    ctx.drawImage(img, w - markW - margin, h - markH - margin, markW, markH);
    ctx.restore();
    return;
  }
  drawTextWatermark(ctx, w, h);
};

/** The wordmark's magenta-to-cyan ramp as text: the fallback. */
const drawTextWatermark = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void => {
  const fs = Math.round(Math.min(w, h) * 0.045);
  ctx.save();
  ctx.font = `900 ${fs}px Poppins, system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  const x = w - fs * 0.7;
  const y = h - fs * 0.6;
  const textW = ctx.measureText("SHOT CALLER").width;
  const ramp = ctx.createLinearGradient(x - textW, 0, x, 0);
  ramp.addColorStop(0, "#f838f8");
  ramp.addColorStop(0.5, "#8898f8");
  ramp.addColorStop(1, "#18f8f8");
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = fs * 0.3;
  ctx.fillStyle = ramp;
  ctx.fillText("SHOT CALLER", x, y);
  ctx.restore();
};
