// ===========================================================================
// Landing-page imagery.
// ---------------------------------------------------------------------------
// Two jobs, because the page shows two different kinds of picture.
//
// 1. PHONE CAPTURES. Taken independently over months, they range from 828x1792
//    to 840x1880 - ratios 0.60 down to 0.45. Side by side on the landing page
//    that reads as sloppiness, the frames visibly disagreeing, so each is
//    cropped to one 840x1150 window here.
//
//    Cropped, never squashed: a screenshot stretched to fit a ratio is obvious
//    at a glance. Anything not already 840 wide is scaled to 840 first, which
//    is uniform and so costs nothing but a resample.
//
//    The window starts at y=250, where the app's logo banner ends. That banner
//    is pixel-identical in every capture and spent a fifth of each frame
//    repeating what the page header already says. Dropping it is also what
//    lets one window fit every source, the shortest of which is 1792 tall.
//
// 2. THE COMPLETION CARD. Not a screen - it is the image the app hands you to
//    post, so it keeps its own dimensions and its own rounded corners rather
//    than being forced into the phone frame. It was captured against a white
//    page, which leaves four white triangles outside that radius; masking them
//    back to transparent is the whole reason this needs code and not a crop.
//
// Originals under assets/blog are untouched; the blog posts use them at their
// own sizes.
//
// Run: node scripts/landing-shots.mjs
// ===========================================================================

import path from "node:path";
import sharp from "sharp";

const SRC = "public/assets/blog";
const OUT = "public/assets/landing";

/** The one frame every phone capture is cropped to. */
const W = 840;
const H = 1150;
/** Where the app's header banner ends, plus a little of its lower edge. */
const TOP = 250;

const CAPTURES = [
  "app-callout-combo.webp",    // mid-round, calling a combination
  "app-training-options.webp", // the ordered-callout toggle + round config
  "app-setup.webp",            // style picker, two styles selected
  "app-manage.webp",           // the technique manager / custom styles
  "roadmap-ladder.webp",       // the guided path
  "learn-shelf.webp",          // the technique shelf
];

for (const file of CAPTURES) {
  const src = path.join(SRC, file);
  const meta = await sharp(src).metadata();

  // Scale to the common width before cropping, so TOP and H mean the same
  // thing in every source regardless of the device it came off.
  const pipeline = meta.width === W ? sharp(src) : sharp(src).resize({ width: W });
  const scaledHeight = Math.round((meta.height * W) / meta.width);
  if (TOP + H > scaledHeight) {
    throw new Error(`${file}: ${meta.width}x${meta.height} is too short - a ${H}px window at y=${TOP} needs ${TOP + H}, got ${scaledHeight}`);
  }

  await pipeline
    .extract({ left: 0, top: TOP, width: W, height: H })
    .webp({ quality: 88 })
    .toFile(path.join(OUT, file));

  console.log(`[landing-shots] ${file}  ${meta.width}x${meta.height} -> ${W}x${H}`);
}

// --------------------------------------------------------------- the card
const CARD = "completion-card.webp";
/** Matches the radius the app itself draws; traced off the capture's corner arc. */
const CARD_RADIUS = 40;

const cardSrc = path.join(SRC, CARD);
const card = await sharp(cardSrc).metadata();
const mask = Buffer.from(
  `<svg width="${card.width}" height="${card.height}">
     <rect width="${card.width}" height="${card.height}" rx="${CARD_RADIUS}" ry="${CARD_RADIUS}" fill="#fff"/>
   </svg>`
);

await sharp(cardSrc)
  .ensureAlpha()
  // dest-in keeps the card only where the mask is opaque, so the white outside
  // the radius becomes transparent instead of showing as corner triangles.
  .composite([{ input: mask, blend: "dest-in" }])
  .webp({ quality: 92, alphaQuality: 100 })
  .toFile(path.join(OUT, CARD));

console.log(`[landing-shots] ${CARD}  ${card.width}x${card.height} -> unchanged, corners masked`);
