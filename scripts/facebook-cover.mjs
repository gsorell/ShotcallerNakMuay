// ===========================================================================
// The Facebook Page cover photo.
// ---------------------------------------------------------------------------
// Same parts and the same layout as the App Store header
// (app-store-header.mjs): the hero gradient, the lockup, the page's tagline.
// Only the canvas differs, and the canvas is the whole problem.
//
// Facebook shows one upload two ways. Desktop crops it to 820x312, taking the
// top and bottom off; phones crop it to 640x360, taking the sides off. So the
// canvas is 820x360 - the union of the two - and everything that has to be
// read sits inside the 640x312 both of them keep. SAFE below is that box, and
// the run fails rather than write a cover that only works on one of them.
//
// Rendered at 2x, since Facebook recompresses and a 1x upload goes soft.
//
// Run:  node scripts/facebook-cover.mjs
//
// Output: assets-src/social/facebook-cover/
// ===========================================================================

import { chromium } from "playwright-core";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve();

const CANVAS = { w: 820, h: 360 };
const SAFE = { w: 640, h: 312 };
const SCALE = 2;

const OUTDIR = path.join(root, "assets-src/social/facebook-cover");
const GROUND = path.join(root, "public/assets/hero_desktop.webp");
const LOGO = path.join(root, "public/assets/logo-shotcaller.svg");

// Straight from :root in public/home.html.
const PALETTE = {
  bg: "#0c0710",
  accent: "#ff5fb0",
  heading: "#f4eef6",
};

const KICKER = "Muay Thai \u00b7 Kickboxing \u00b7 Boxing";
const TAGLINE_HEAD = "Someone in your corner,";
const TAGLINE_TAIL = "calling the shots.";

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

const FONTS = `
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=IBM+Plex+Mono:wght@500&display=block">`;

function html(ground, logo) {
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100vw; height: 100vh; overflow: hidden; }
body {
  background: ${PALETTE.bg};
  -webkit-font-smoothing: antialiased;
  position: relative;
}
.ground { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
/* Same job as the scrim in site-og-card.mjs: the gradient's magenta corner
   sits at the luminance of the wordmark's pink and swallows it. */
.scrim {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 78% 62% at 50% 50%, rgba(12,7,16,0.12) 0%, rgba(12,7,16,0.62) 100%),
    linear-gradient(180deg, rgba(12,7,16,0.44) 0%, rgba(12,7,16,0.26) 44%, rgba(12,7,16,0.52) 100%);
}
.card {
  position: relative; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  text-align: center;
}
.kicker {
  font-family: 'IBM Plex Mono', monospace; font-weight: 500;
  font-size: 3.4vh; letter-spacing: 0.22em; text-transform: uppercase;
  color: ${PALETTE.accent};
}
.logo { height: 24vh; margin: 5.5vh 0 6vh; display: block; }
.tagline {
  font-family: 'Anton', sans-serif; font-weight: 400;
  font-size: 8.6vh; line-height: 1.0; letter-spacing: 0.01em;
  color: ${PALETTE.heading}; white-space: nowrap;
}
.tagline em { font-style: normal; color: ${PALETTE.accent}; }
</style></head><body>
<img class="ground" src="${ground}" alt="">
<div class="scrim"></div>
<div class="card">
  <div class="kicker">${KICKER}</div>
  <img class="logo" src="${logo}" alt="">
  <div class="tagline">${TAGLINE_HEAD} <em>${TAGLINE_TAIL}</em></div>
</div>
</body></html>`;
}

const groundBuf = await sharp(GROUND).jpeg({ quality: 95 }).toBuffer();
const ground = `data:image/jpeg;base64,${groundBuf.toString("base64")}`;
const logo = `data:image/svg+xml;base64,${(await fs.readFile(LOGO)).toString("base64")}`;

await fs.mkdir(OUTDIR, { recursive: true });
const browser = await chromium.launch({ executablePath: await findChrome() });

const page = await browser.newPage({
  viewport: { width: CANVAS.w, height: CANVAS.h },
  deviceScaleFactor: SCALE,
});
await page.setContent(html(ground, logo), { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);

const got = await page.evaluate(() => ({
  anton: document.fonts.check('400 58px "Anton"'),
  mono: document.fonts.check('500 24px "IBM Plex Mono"'),
}));
const missing = Object.entries(got)
  .filter(([, ok]) => !ok)
  .map(([k]) => k);
if (missing.length) {
  await browser.close();
  throw new Error(
    `Webfonts did not load: ${missing.join(", ")}. Check the network and re-run.`
  );
}

// Everything readable has to sit inside the box both crops keep.
const box = await page.evaluate(() => {
  const rects = [".kicker", ".logo", ".tagline"].map((s) =>
    document.querySelector(s).getBoundingClientRect()
  );
  return {
    left: Math.min(...rects.map((r) => r.left)),
    right: Math.max(...rects.map((r) => r.right)),
    top: Math.min(...rects.map((r) => r.top)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
  };
});
const safe = {
  left: (CANVAS.w - SAFE.w) / 2,
  right: (CANVAS.w + SAFE.w) / 2,
  top: (CANVAS.h - SAFE.h) / 2,
  bottom: (CANVAS.h + SAFE.h) / 2,
};
if (
  box.left < safe.left ||
  box.right > safe.right ||
  box.top < safe.top ||
  box.bottom > safe.bottom
) {
  await browser.close();
  throw new Error(
    `Content ${JSON.stringify(box)} leaves the safe area ${JSON.stringify(safe)}.`
  );
}

const w = CANVAS.w * SCALE;
const h = CANVAS.h * SCALE;
const out = path.join(OUTDIR, `facebook-cover-${w}x${h}.png`);
await page.screenshot({ path: out, type: "png" });
await browser.close();

const meta = await sharp(out).metadata();
if (meta.width !== w || meta.height !== h) {
  throw new Error(`${out} is ${meta.width}x${meta.height}, wanted ${w}x${h}.`);
}
console.log(`Wrote ${path.relative(root, out)} - ${w}x${h}`);
