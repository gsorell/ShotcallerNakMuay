// ===========================================================================
// Social preview card for the animated technique reference post.
// ---------------------------------------------------------------------------
// A blog link with no og:image is a bare grey box in a Reddit or Discord feed,
// and this is the one post written to be pasted into those. So: the logo, and
// five silhouettes lifted straight off the sheets the post is about.
//
// Every figure is cell index LANDED_FRAME (3) of its sheet - the extension,
// the frame the whole library is cut around - so the card is literally the
// page with its Frozen toggle on.
//
// Deliberately no text beyond the logo art. Rendering type here would mean
// depending on whatever fonts sharp's SVG rasteriser happens to find on the
// machine that runs this, and a card whose headline silently falls back to
// Times is worse than a card with no headline.
//
// Run: node scripts/technique-reference-og.mjs
// Only needs re-running if the sheets or the layout change.
// ===========================================================================

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const CELL = 256;
/** Matches LANDED_FRAME in src/features/learn/data/techniqueSprites.ts. */
const LANDED_FRAME = 3;

const W = 1200;
const H = 630;
/**
 * The logo banner is not transparent - it ships with a flat rgb(10,0,25)
 * ground baked in. Painting the card that same colour is what stops the
 * banner reading as a visible rectangle pasted onto a different dark. The
 * blog page's --bg (#0c0710) is a near neighbour but not a match, and at this
 * size the seam shows.
 */
const BG = { r: 10, g: 0, b: 25 };
const ACCENT = "#ff5fb0"; // --accent, the silhouettes' own pink

/**
 * One per limb, plus a defense. All five are sheets whose figure is centred in
 * its cell - none of them appear in INK_CENTRE - so a straight crop needs no
 * correcting. Swapping in jab, cross or either hook would need that nudge.
 */
const FIGURES = [
    "roundhouse-kick",
    "teep-lead",
    "straight-knee-rear",
    "horizontal-elbow-lead",
    "check-lead",
];

/** Height of the tallest figure's ink, before it is shrunk to fit the width. */
const TARGET_INK_HEIGHT = 300;
/** Everything the row is allowed to use, leaving a margin either side. */
const ROW_MAX_WIDTH = 1090;
/** Clear space between one figure's ink and the next one's. */
const MIN_INK_GAP = 26;
/** Where the figures stand. */
const GROUND = 556;
const LOGO_W = 470;
const LOGO_TOP = 62;

const root = path.resolve();
const sheetDir = path.join(root, "public/assets/technique");
const outFile = path.join(root, "public/assets/blog/technique-reference-og.png");

/**
 * The alpha bounding box of one cell.
 *
 * Measured rather than assumed, because a cell is mostly empty and by very
 * different amounts: a teep reaches nearly to the edge, a check barely leaves
 * the middle. Laying the row out on cell boundaries would put a lake of
 * nothing between the narrow figures and crowd the wide ones. Laying it out on
 * ink boundaries puts the same visible gap between every pair.
 */
const inkBox = (data, info) => {
    let minX = info.width, maxX = -1, minY = info.height, maxY = -1;
    for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
            if (data[(y * info.width + x) * info.channels + 3] > 8) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    return { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 };
};

const cells = await Promise.all(
    FIGURES.map(async (slug) => {
        const { data, info } = await sharp(path.join(sheetDir, `${slug}.webp`))
            .extract({ left: LANDED_FRAME * CELL, top: 0, width: CELL, height: CELL })
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
        return { slug, box: inkBox(data, info) };
    })
);

// One scale for all five, so their relative sizes survive - a head-high teep
// really is taller than a check, and normalising them would say otherwise.
// Start from the tallest, then give the width a veto.
const tallest = Math.max(...cells.map((c) => c.box.height));
let scale = TARGET_INK_HEIGHT / tallest;
const inkWidthAt = (s) => cells.reduce((sum, c) => sum + c.box.width * s, 0);
const gapsWidth = MIN_INK_GAP * (cells.length - 1);
if (inkWidthAt(scale) + gapsWidth > ROW_MAX_WIDTH) {
    scale = (ROW_MAX_WIDTH - gapsWidth) / inkWidthAt(1);
}

const scaledCell = Math.round(CELL * scale);
const rowInkWidth = inkWidthAt(scale);
const gap = (ROW_MAX_WIDTH - rowInkWidth) / (cells.length - 1);

const figures = [];
let cursor = (W - ROW_MAX_WIDTH) / 2;
for (const { slug, box } of cells) {
    const input = await sharp(path.join(sheetDir, `${slug}.webp`))
        .extract({ left: LANDED_FRAME * CELL, top: 0, width: CELL, height: CELL })
        .resize(scaledCell, scaledCell)
        .toBuffer();
    figures.push({
        input,
        // Placed by where the INK sits inside the resized cell, not by the
        // cell's own corner: left edge of the ink at the cursor, and the
        // bottom of the ink on the ground line, so all five stand on the
        // same floor whatever the cell's internal padding does.
        left: Math.round(cursor - box.minX * scale),
        top: Math.round(GROUND - (box.minY + box.height) * scale),
    });
    cursor += box.width * scale + gap;
}

const logo = await sharp(path.join(root, "public/assets/Logo_Header_Banner_Smooth.png"))
    .resize({ width: LOGO_W })
    .toBuffer();
const logoHeight = (await sharp(logo).metadata()).height;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
await sharp({ create: { width: W, height: H, channels: 3, background: BG } })
    .composite([
        { input: logo, left: Math.round((W - LOGO_W) / 2), top: LOGO_TOP },
        ...figures,
        // A rule along the bottom edge, so the card has a floor rather than
        // fading into whatever the feed puts underneath it.
        {
            input: { create: { width: W, height: 6, channels: 3, background: ACCENT } },
            left: 0,
            top: H - 6,
        },
    ])
    .png()
    .toFile(outFile);

console.log(
    `Wrote ${path.relative(root, outFile)} - ${W}x${H}, logo ${LOGO_W}x${logoHeight}, ` +
    `${FIGURES.length} figures at frame ${LANDED_FRAME}, ` +
    `scale ${scale.toFixed(3)}, ink gap ${gap.toFixed(1)}px`
);
