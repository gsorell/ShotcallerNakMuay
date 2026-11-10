/**
 * The header's own banner (icon, SHOT CALLER, MUAY THAI TIMER) on a
 * transparent background. Loaded once; until it has, the reel falls back to
 * the wordmark drawn as text, so no frame goes out unbranded.
 */
const WATERMARK_SRC = "/assets/Logo_Header_Banner_Smooth.webp";
let watermarkImg: HTMLImageElement | null = null;

export const loadWatermark = (): HTMLImageElement | null => {
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

/**
 * Resolves once the banner and the cards' font can be drawn, or after a
 * short wait if they can't: the reel's first frame is its thumbnail in a
 * gallery and a feed, so it must not go out without the logo or in a
 * fallback font.
 */
export const cardAssetsReady = async (): Promise<void> => {
  const img = loadWatermark();
  const timeout = new Promise<void>((r) => setTimeout(r, 1500));
  const logo =
    img && !(img.complete && img.naturalWidth > 0)
      ? img.decode().catch(() => undefined)
      : Promise.resolve();
  const fonts =
    typeof document !== "undefined" && document.fonts
      ? Promise.all([
          document.fonts.load("900 40px Poppins"),
          document.fonts.load("700 40px Poppins"),
        ]).catch(() => undefined)
      : Promise.resolve();
  await Promise.race([Promise.all([logo, fonts]), timeout]);
};

/** The banner centred along the bottom, about 45% of the frame's width. */
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
    ctx.drawImage(img, Math.round((w - markW) / 2), h - markH - margin, markW, markH);
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
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const x = w / 2;
  const y = h - fs * 0.6;
  const textW = ctx.measureText("SHOT CALLER").width;
  const ramp = ctx.createLinearGradient(x - textW / 2, 0, x + textW / 2, 0);
  ramp.addColorStop(0, "#f838f8");
  ramp.addColorStop(0.5, "#8898f8");
  ramp.addColorStop(1, "#18f8f8");
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = fs * 0.3;
  ctx.fillStyle = ramp;
  ctx.fillText("SHOT CALLER", x, y);
  ctx.restore();
};
