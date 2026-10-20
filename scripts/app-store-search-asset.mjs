// ===========================================================================
// The App Store search results asset.
// ---------------------------------------------------------------------------
// App Store Connect's "Search Results" slot takes one 3:2 image (1920x1280 up
// to 3840x2560). When it is empty the first screenshots stand in, and it is
// also the default creative for Apple Ads search results ads.
//
// It is NOT the header (app-store-header.mjs). In search results the icon and
// the full app name already sit directly above this image, so a logo here
// repeats what the viewer just read.
//
// It is seen about 360pt wide, roughly a tenth of this canvas, so anything
// under ~110px here is unreadable there. That is why it carries three things
// and no more: the headline, a stack of real callouts, and the figure that
// answers the last one. The stack is the point - the calls keep coming and
// keep changing, which is what the reviews actually praise (training
// reactions, "I don't have to think"). A single quote can't say that, and a
// screenshot of the timer looks like every other result for "boxing timer".
//
// The figure is the head kick sheet's landed frame, the same art the Learn
// section and the social cards use, unmirrored: mirrored, the kicking foot
// lands on the headline's comma.
//
// Same approach as the header: Chrome renders it, so the type is real and the
// script can check the webfonts actually loaded. Sized in vh so a smaller
// variant needs no numbers of its own.
//
// Run:  node scripts/app-store-search-asset.mjs
//
// Output: assets-src/store/appstore-search/  (gitignored with the rest of
//         assets-src/store)
// ===========================================================================

import { chromium } from "playwright-core";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve();

const SIZES = [{ w: 3840, h: 2560 }];
// Rendered at half size and doubled, as in app-store-header.mjs.
const SCALE = 2;

const OUTDIR = path.join(root, "assets-src/store/appstore-search");
const GROUND = path.join(root, "public/assets/hero_desktop.webp");
const SHEET = path.join(root, "public/assets/technique/head-kick.webp");
// LANDED_FRAME and SPRITE_FRAMES in src/features/learn/data/techniqueSprites.ts.
const LANDED_FRAME = 3;
const SPRITE_FRAMES = 6;

// Straight from :root in public/home.html, plus the logo's pink-to-cyan.
const PALETTE = {
  bg: "#0c0710",
  accent: "#ff5fb0",
  heading: "#f4eef6",
  muted: "#c9bcd4",
  cyan: "#5ad8ff",
};

// One line per array entry; the last line takes the accent.
const HEADLINE = ["Train reactions,", "not routines."];
// Oldest first. Every one is a real callout from the app's styles, written as
// the app writes them, and the last one is the technique the figure throws.
// No exclamation marks: docs/SOCIAL_VOICE.md rule 5.
const CALLS = ["1 2, Clinch, Double Knees", "1 4, Switch Knee, Elbow", "1 2, Head Kick"];

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
];

async function findChrome() {
  for (const p of CHROME) {
    try {
      await fs.access(p);
      return p;
    } catch {
      /* next */
    }
  }
  throw new Error(`No Chrome found. Looked in:\n  ${CHROME.join("\n  ")}`);
}

/** The alpha bounding box of a decoded cell, as in social-cards.mjs. */
function inkBox(data, info) {
  let minX = info.width,
    maxX = -1,
    minY = info.height,
    maxY = -1;
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
  if (maxX < 0) throw new Error("sheet cell is entirely transparent");
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** The landed frame, cropped to its ink, upscaled once in sharp. */
async function figureDataUri() {
  const meta = await sharp(SHEET).metadata();
  const cell = meta.height;
  if (meta.width !== cell * SPRITE_FRAMES) {
    throw new Error(`${SHEET}: expected ${cell * SPRITE_FRAMES}x${cell}, got ${meta.width}x${meta.height}`);
  }
  const cellBuf = await sharp(SHEET)
    .extract({ left: LANDED_FRAME * cell, top: 0, width: cell, height: cell })
    .ensureAlpha()
    .toBuffer();
  const { data, info } = await sharp(cellBuf).raw().toBuffer({ resolveWithObject: true });
  const png = await sharp(cellBuf)
    .extract(inkBox(data, info))
    // Drawn about 2000px tall on the canvas. Scaling here with lanczos, not
    // in the browser, keeps the edge clean under the glow.
    .resize({ height: 2000, kernel: "lanczos3" })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

const FONTS = `
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&display=block">`;

// Sound arcs on the live call: it is heard, not read.
const WAVES = `<svg class="waves" viewBox="0 0 48 64" aria-hidden="true">
  <path d="M6 20c4 3 6 7.3 6 12s-2 9-6 12" fill="none" stroke="${PALETTE.cyan}" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M18 11c7 5.2 10.6 12.4 10.6 21S25 47.8 18 53" fill="none" stroke="${PALETTE.cyan}" stroke-width="4.5" stroke-linecap="round" opacity="0.75"/>
  <path d="M30 2c9.6 7.4 14.6 17.4 14.6 30S39.6 54.6 30 62" fill="none" stroke="${PALETTE.cyan}" stroke-width="4.5" stroke-linecap="round" opacity="0.45"/>
</svg>`;

function html(ground, figure) {
  const lines = HEADLINE.map(
    (l, i) => `<span${i === HEADLINE.length - 1 ? ' class="em"' : ""}>${l}</span>`
  ).join("");
  const calls = CALLS.map((c, i) => {
    const age = CALLS.length - 1 - i; // 0 is the live call
    return `<div class="call age${age}">${age === 0 ? WAVES : ""}<span>${c}</span></div>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100vw; height: 100vh; overflow: hidden; }
body { background: ${PALETTE.bg}; -webkit-font-smoothing: antialiased; position: relative; }
.ground { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.scrim {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 34% 52% at 76% 52%, rgba(90,20,80,0.55) 0%, rgba(12,7,16,0) 70%),
    linear-gradient(90deg, rgba(12,7,16,0.78) 0%, rgba(12,7,16,0.5) 55%, rgba(12,7,16,0.35) 100%);
}

/* One column, centred on the canvas's height: the headline, then the calls
   that prove it, on one left edge. */
.copy {
  position: absolute; left: 5.5vw; top: 50%; transform: translateY(-50%);
  display: flex; flex-direction: column; align-items: flex-start; gap: 7vh;
}
.headline {
  font-family: 'Anton', sans-serif; font-weight: 400;
  font-size: 10vh; line-height: 1.0; letter-spacing: 0.005em;
  color: ${PALETTE.heading};
  display: flex; flex-direction: column; white-space: nowrap;
}
.headline .em { color: ${PALETTE.accent}; }

/* The calls, oldest at the top, growing and brightening toward the live one,
   like a feed. */
.calls { display: flex; flex-direction: column; align-items: flex-start; gap: 2vh; }
.call {
  position: relative; display: flex; align-items: center; gap: 2vh;
  border-radius: 3vh; white-space: nowrap;
  font-family: 'Anton', sans-serif; line-height: 1; text-transform: uppercase; letter-spacing: 0.01em;
}
.call.age2 {
  padding: 1.5vh 2.6vh; font-size: 3.8vh;
  background: rgba(244,238,246,0.06); border: 0.25vh solid rgba(244,238,246,0.16);
  color: rgba(244,238,246,0.42);
}
.call.age1 {
  padding: 1.7vh 2.9vh; font-size: 4.6vh;
  background: rgba(244,238,246,0.09); border: 0.25vh solid rgba(244,238,246,0.24);
  color: rgba(244,238,246,0.7);
}
.call.age0 {
  padding: 2.4vh 4vh 2.4vh 3vh; font-size: 7.4vh;
  background: linear-gradient(120deg, ${PALETTE.accent}, #c46bff);
  color: ${PALETTE.bg};
  box-shadow: 0 2vh 6vh rgba(0,0,0,0.5), 0 0 9vh rgba(255,95,176,0.45);
}
.call .waves { width: 5vh; height: 6.6vh; flex: none; }
.call .waves path { stroke: ${PALETTE.bg}; }

/* Standing on something: a pool of light where the foot lands, so the
   figure is grounded instead of floating. */
.floor {
  position: absolute; right: 2vw; bottom: 6vh; width: 36vw; height: 9vh;
  background: radial-gradient(ellipse 50% 50% at 42% 50%, rgba(255,95,176,0.38) 0%, rgba(196,107,255,0.12) 45%, rgba(12,7,16,0) 75%);
}
.figure {
  position: absolute; right: 3vw; bottom: 9vh;
  height: 72vh;
  filter: drop-shadow(0 0 2.6vh rgba(255,95,176,0.6)) drop-shadow(0 0 8vh rgba(255,95,176,0.25));
}
</style></head><body>
<img class="ground" src="${ground}" alt="">
<div class="scrim"></div>
<div class="copy"><div class="headline">${lines}</div><div class="calls">${calls}</div></div>
<div class="floor"></div>
<img class="figure" src="${figure}" alt="">
</body></html>`;
}

const groundBuf = await sharp(GROUND).jpeg({ quality: 95 }).toBuffer();
const ground = `data:image/jpeg;base64,${groundBuf.toString("base64")}`;
const figure = await figureDataUri();

await fs.mkdir(OUTDIR, { recursive: true });
const browser = await chromium.launch({ executablePath: await findChrome() });

for (const { w, h } of SIZES) {
  const page = await browser.newPage({
    viewport: { width: w / SCALE, height: h / SCALE },
    deviceScaleFactor: SCALE,
  });
  await page.setContent(html(ground, figure), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);

  if (!(await page.evaluate(() => document.fonts.check('400 58px "Anton"')))) {
    await browser.close();
    throw new Error("Webfont Anton did not load. Check the network and re-run.");
  }

  // Nothing may overlap: the headline and the calls must clear each other and
  // the figure, and everything must sit inside the canvas.
  const r = await page.evaluate(() => {
    const box = (s) => document.querySelector(s).getBoundingClientRect();
    const live = box(".call.age0");
    return {
      head: box(".headline"),
      calls: box(".calls"),
      liveRight: live.right,
      fig: box(".figure"),
      w: innerWidth,
      h: innerHeight,
    };
  });
  const fail = [];
  if (r.head.bottom > r.calls.top - 16) fail.push(`headline (bottom ${Math.round(r.head.bottom)}) runs into the calls (top ${Math.round(r.calls.top)})`);
  // The figure's box starts with empty air above the hip; its head sits
  // about a tenth of the way in.
  if (r.head.right > r.fig.left + 0.1 * r.fig.width - 160) fail.push(`headline (right ${Math.round(r.head.right)}) runs into the figure (left ${Math.round(r.fig.left)})`);
  if (r.liveRight > r.fig.left + 0.12 * r.fig.width - 16) fail.push(`the live call (right ${Math.round(r.liveRight)}) runs into the figure (left ${Math.round(r.fig.left)})`);
  if (r.fig.top < 0 || r.fig.bottom > r.h || r.fig.right > r.w) fail.push("the figure runs off the canvas");
  if (r.calls.bottom > r.h * 0.95) fail.push("the calls run too close to the bottom edge");
  if (fail.length) {
    await browser.close();
    throw new Error(fail.join("; "));
  }
  console.log(`Live call ends ${Math.round(r.fig.left - r.liveRight)}px left of the figure box; headline clears the calls by ${Math.round(r.calls.top - r.head.bottom)}px.`);

  const out = path.join(OUTDIR, `search-${w}x${h}.png`);
  await page.screenshot({ path: out, type: "png" });
  await page.close();

  const meta = await sharp(out).metadata();
  if (meta.width !== w || meta.height !== h) {
    await browser.close();
    throw new Error(`${out} is ${meta.width}x${meta.height}, wanted ${w}x${h}.`);
  }
  const bytes = (await fs.stat(out)).size;
  console.log(`Wrote ${path.relative(root, out)} - ${w}x${h}, ${(bytes / 1048576).toFixed(1)} MB`);
}

await browser.close();
